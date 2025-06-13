// services/orderService.ts
import admin from '../config/firebase';
import {
    OrderWithId,
    OrderItemWithId,
    Order,
    OrderItem,
    CartItem,
    // CartItemWithId, // Tidak dipakai langsung di getOrder atau listOrders
    Product,
    QueryResult,
    User,
    BuyerOrderSummary,
    ProductWithId
} from '../interfaces';

const db = admin.firestore();
const productsCollection = db.collection('products');
const ordersCollection = db.collection('orders');
const usersCollection = db.collection('users');
const FieldValue = admin.firestore.FieldValue;

export interface AdminEnrichedOrder extends OrderWithId {
    buyerInfo?: {
        id: string;
        username: string;
        email: string;
    }
    itemsSummary?: {
        totalItems: number;
        productNames: string[]; // Daftar nama produk dalam pesanan
    }
}

export const listAllOrders = async (
    page: number = 1,
    limit: number = 10
): Promise<QueryResult<AdminEnrichedOrder>> => {
    const offset = (page - 1) * limit;

    const totalSnap = await ordersCollection.get();
    const total = totalSnap.size;

    const dataSnap = await ordersCollection
        .orderBy('created_at', 'desc')
        .offset(offset)
        .limit(limit)
        .get();

    const enrichmentPromises = dataSnap.docs.map(async (doc): Promise<AdminEnrichedOrder> => {
        const orderData = doc.data() as Order;
        const orderId = doc.id;
        
        let buyerInfo;
        if (orderData.buyer_id && typeof orderData.buyer_id === 'string' && orderData.buyer_id.length > 0) {
            try {
                const userSnap = await usersCollection.doc(orderData.buyer_id).get();
                if (userSnap.exists) {
                    const userData = userSnap.data() as User;
                    buyerInfo = {
                        id: orderData.buyer_id,
                        username: userData.username,
                        email: userData.email
                    };
                }
            } catch (e) { console.error(`Failed to fetch buyer info for order ${orderId}`, e); }
        }

        let itemsSummary;
        try {
            const itemsSnap = await ordersCollection.doc(orderId).collection('items').get();
            if (!itemsSnap.empty) {
                const productIds = itemsSnap.docs.map(itemDoc => (itemDoc.data() as OrderItem).product_id);
                
                const productNames: string[] = [];
                if (productIds.length > 0) {
                    const productSnaps = await db.collection('products').where(admin.firestore.FieldPath.documentId(), 'in', productIds).get();
                    const productDataMap = new Map(productSnaps.docs.map(pDoc => [pDoc.id, pDoc.data() as Product]));
                    productIds.forEach(pId => {
                        const product = productDataMap.get(pId);
                        if (product) {
                            productNames.push(product.name);
                        } else {
                            productNames.push("[Product Not Found]");
                        }
                    });
                }
                
                itemsSummary = {
                    totalItems: itemsSnap.size,
                    productNames: productNames
                };
            } else {
                itemsSummary = { totalItems: 0, productNames: [] };
            }
        } catch (e) { console.error(`Failed to fetch items for order ${orderId}`, e); }

        return {
            id: orderId,
            ...orderData,
            buyerInfo: buyerInfo,
            itemsSummary: itemsSummary
        };
    });

    const data = await Promise.all(enrichmentPromises);

    return { data, total, page, limit };
};

export interface EnrichedOrderItem extends OrderItemWithId {
    productDetails?: { // Informasi produk yang disematkan
        name: string;
        images: string[]; // Atau hanya gambar utama
    };
}

export interface EnrichedOrderWithId extends OrderWithId {
    items?: EnrichedOrderItem[]; // Menggunakan item yang sudah diperkaya
}


export const listOrders = async (
    buyerId: string,
    page: number = 1,
    limit: number = 10
): Promise<QueryResult<BuyerOrderSummary>> => {
    const offset = (page - 1) * limit;

    // Query dasar untuk mengambil order milik buyer
    const baseQuery = ordersCollection.where('buyer_id', '==', buyerId);

    // Query untuk menghitung total dokumen yang cocok
    const totalSnap = await baseQuery.get();
    const total = totalSnap.size;

    // Query untuk mengambil data dengan paginasi dan urutan
    const dataSnap = await baseQuery
        .orderBy('created_at', 'desc')
        .offset(offset)
        .limit(limit)
        .get();

    if (dataSnap.empty) {
        return { data: [], total: 0, page, limit };
    }

    // Proses untuk memperkaya setiap order dengan ringkasan item
    const enrichmentPromises = dataSnap.docs.map(async (doc): Promise<BuyerOrderSummary> => {
        const orderData = doc.data() as Order;
        const orderId = doc.id;
        
        let itemsSummary: BuyerOrderSummary['itemsSummary'];

        try {
            // Ambil hanya satu item pertama dari sub-koleksi untuk mendapatkan nama dan gambar
            const firstItemSnap = await ordersCollection.doc(orderId).collection('items').limit(1).get();
            // Ambil semua item untuk mendapatkan jumlah total
            const allItemsSnap = await ordersCollection.doc(orderId).collection('items').get();

            if (!firstItemSnap.empty) {
                const firstItemData = firstItemSnap.docs[0].data() as OrderItem;
                const productId = firstItemData.product_id;
                
                let productName = "[Product Deleted]";
                let productImage: string | undefined = undefined;

                if (productId) {
                    const productSnap = await productsCollection.doc(productId).get();
                    if (productSnap.exists) {
                        const productData = productSnap.data() as Product;
                        productName = productData.name;
                        productImage = productData.images?.[0]; // Ambil gambar pertama
                    }
                }
                
                itemsSummary = {
                    totalItems: allItemsSnap.size,
                    firstProductName: productName,
                    firstProductImage: productImage
                };

            } else {
                itemsSummary = { totalItems: 0, firstProductName: "No items", firstProductImage: undefined };
            }
        } catch (e) { 
            console.error(`Failed to fetch items summary for order ${orderId}`, e); 
            itemsSummary = { totalItems: 0, firstProductName: "[Error]", firstProductImage: undefined };
        }

        return {
            id: orderId,
            ...orderData,
            itemsSummary: itemsSummary
        };
    });

    const data = await Promise.all(enrichmentPromises);

    return { data, total, page, limit };
};

export const getOrder = async (
    orderId: string
): Promise<EnrichedOrderWithId | null> => {
    const docSnap = await db.collection('orders').doc(orderId).get();
    if (!docSnap.exists) return null;

    const orderData = docSnap.data() as Order;
    const itemsSnap = await db
        .collection('orders')
        .doc(orderId)
        .collection('items')
        .get();

    let enrichedItems: EnrichedOrderItem[] = [];
    if (!itemsSnap.empty) {
        const itemsPromises = itemsSnap.docs.map(async (itemDoc): Promise<EnrichedOrderItem> => {
            const orderItemData = itemDoc.data() as OrderItem;
            const orderItemWithId: OrderItemWithId = {
                id: itemDoc.id,
                order_id: orderId,
                ...orderItemData
            };

            let productDetails;
            if (orderItemData.product_id) {
                try {
                    const productSnap = await productsCollection.doc(orderItemData.product_id).get();
                    if (productSnap.exists) {
                        const productData = productSnap.data() as Product;
                        productDetails = {
                            name: productData.name,
                            images: productData.images,
                        };
                    } else {
                        console.warn(`Product with ID ${orderItemData.product_id} not found for order item ${itemDoc.id}`);
                    }
                } catch (error) {
                    console.error(`Error fetching product details for order item ${itemDoc.id}:`, error);
                }
            }
            return { ...orderItemWithId, productDetails };
        });
        enrichedItems = await Promise.all(itemsPromises);
    }

    return {
        id: docSnap.id,
        ...orderData,
        items: enrichedItems // Menyertakan item yang sudah diperkaya
    };
};

export interface CheckoutData {
    shipping_address: string;
    subtotal_items: number;
    shipping_cost: number;
    shipping_insurance_fee: number;
    application_fee: number;
    product_discount?: number;
    shipping_discount?: number;
    total_amount: number;
}

export const createOrderFromCart = async (
  buyerId: string,
  checkoutData: CheckoutData
): Promise<OrderWithId> => {
  const cartItemsRef = db.collection('carts').doc(buyerId).collection('items');
  const cartItemsSnap = await cartItemsRef.get();

  if (cartItemsSnap.empty) {
    throw new Error('Cart is empty. Cannot create order.');
  }

  const cartItemsData = cartItemsSnap.docs.map(doc => doc.data() as CartItem);
  const newOrderId = db.collection('orders').doc().id;

  await db.runTransaction(async (tx) => {
    
    // --- FASE 1: BACA SEMUA DATA TERLEBIH DAHULU ---
    
    const productRefs = cartItemsData.map(item => productsCollection.doc(item.product_id));
    // tx.getAll() lebih efisien untuk membaca beberapa dokumen sekaligus
    const productSnaps = await tx.getAll(...productRefs);

    // --- FASE 2: VALIDASI DATA YANG SUDAH DIBACA ---

    let serverCalculatedSubtotal = 0;
    const sellerIdsInOrder = new Set<string>();

    for (let i = 0; i < productSnaps.length; i++) {
      const productSnap = productSnaps[i];
      const cartItem = cartItemsData[i];

      if (!productSnap.exists) {
        throw new Error(`Product with ID ${cartItem.product_id} not found.`);
      }

      const product = productSnap.data() as Product;

      if (product.stock < cartItem.quantity) {
        throw new Error(`Insufficient stock for product "${product.name}".`);
      }
      
      sellerIdsInOrder.add(product.seller_id);
      serverCalculatedSubtotal += product.price * cartItem.quantity;
    }
    
    // Validasi subtotal dan total (logika ini tetap sama)
    if (serverCalculatedSubtotal !== checkoutData.subtotal_items) {
      throw new Error(`Subtotal mismatch. Client: ${checkoutData.subtotal_items}, Server: ${serverCalculatedSubtotal}.`);
    }

    const calculatedTotal = 
        checkoutData.subtotal_items + 
        checkoutData.shipping_cost + 
        checkoutData.shipping_insurance_fee + 
        checkoutData.application_fee -
        (checkoutData.product_discount || 0) -
        (checkoutData.shipping_discount || 0);

    if (Math.abs(calculatedTotal - checkoutData.total_amount) > 0.01) {
        throw new Error(`Total amount mismatch. Client: ${checkoutData.total_amount}, Server: ${calculatedTotal}.`);
    }

    // --- FASE 3: LAKUKAN SEMUA OPERASI TULIS ---
    
    // a. Update stok untuk semua produk
    productSnaps.forEach((snap, index) => {
      const cartItem = cartItemsData[index];
      tx.update(snap.ref, { stock: FieldValue.increment(-cartItem.quantity) });
    });

    // b. Buat dokumen Order utama
    const orderRef = db.collection('orders').doc(newOrderId);
    const orderPayload: Order = {
      buyer_id: buyerId,
      seller_ids: Array.from(sellerIdsInOrder),
      shipping_address: checkoutData.shipping_address,
      order_status: 'pending',
      subtotal_items: checkoutData.subtotal_items,
      shipping_cost: checkoutData.shipping_cost,
      shipping_insurance_fee: checkoutData.shipping_insurance_fee,
      application_fee: checkoutData.application_fee,
      product_discount: checkoutData.product_discount || 0,
      shipping_discount: checkoutData.shipping_discount || 0,
      total_amount: checkoutData.total_amount,
      created_at: FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };
    tx.set(orderRef, orderPayload);

    // c. Buat dokumen OrderItem
    const orderItemsForCreation: OrderItem[] = cartItemsData.map(cartItem => ({
        product_id: cartItem.product_id,
        quantity: cartItem.quantity,
        price_per_item: cartItem.price_per_item,
    }));

    for (const orderItemData of orderItemsForCreation) {
      const orderItemRef = orderRef.collection('items').doc();
      tx.set(orderItemRef, orderItemData);
    }
    
    // d. Hapus item dari keranjang
    for (const doc of cartItemsSnap.docs) {
      tx.delete(doc.ref);
    }
  });

  const createdOrder = await db.collection('orders').doc(newOrderId).get();
  return { id: newOrderId, ...(createdOrder.data() as Order) } as OrderWithId;
};

export const listOrdersForSeller = async (
    sellerId: string,
    page: number = 1,
    limit: number = 10
): Promise<QueryResult<AdminEnrichedOrder>> => {
    const offset = (page - 1) * limit;

    // Buat query dasar untuk mengambil order yang mengandung sellerId
    const baseQuery = ordersCollection.where('seller_ids', 'array-contains', sellerId);

    // Query untuk menghitung total dokumen yang cocok
    const totalSnap = await baseQuery.get();
    const total = totalSnap.size;

    // Query untuk mengambil data dengan paginasi dan urutan
    const dataSnap = await baseQuery
        .orderBy('created_at', 'desc')
        .offset(offset)
        .limit(limit)
        .get();

    // Proses pengayaan data (enrichment) untuk menyertakan info buyer dan item
    // Logika ini sama persis dengan yang ada di listAllOrders
    const enrichmentPromises = dataSnap.docs.map(async (doc): Promise<AdminEnrichedOrder> => {
        // ... (salin seluruh logika map dari fungsi listAllOrders untuk memperkaya data)
        const orderData = doc.data() as Order;
        const orderId = doc.id;
        
        let buyerInfo;
        if (orderData.buyer_id && typeof orderData.buyer_id === 'string' && orderData.buyer_id.length > 0) {
            // ... (logika ambil info buyer)
        }

        let itemsSummary;
        try {
            // ... (logika ambil ringkasan item)
        } catch (e) { console.error(`Failed to fetch items for order ${orderId}`, e); }

        return {
            id: orderId,
            ...orderData,
            buyerInfo: buyerInfo,
            itemsSummary: itemsSummary
        };
    });

    const data = await Promise.all(enrichmentPromises);

    return { data, total, page, limit };
};
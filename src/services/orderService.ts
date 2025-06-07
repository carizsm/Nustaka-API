// services/orderService.ts
import admin from '../config/firebase';
import {
    OrderWithId,
    OrderItemWithId,
    Order,
    OrderItem,
    CartItem,
    // CartItemWithId, // Tidak dipakai langsung di getOrder atau listOrders
    Product, // Tambahkan Product
    QueryResult,
    ProductWithId // Tambahkan ProductWithId
} from '../interfaces';

const db = admin.firestore();
const productsCollection = db.collection('products'); // Referensi ke koleksi produk
const FieldValue = admin.firestore.FieldValue;

export const listAllOrders = async (
    page: number = 1,
    limit: number = 10
): Promise<QueryResult<OrderWithId>> => {
    const offset = (page - 1) * limit;

    // Query untuk menghitung total semua dokumen
    const totalSnap = await productsCollection.get();
    const total = totalSnap.size;

    // Query untuk mengambil data dengan paginasi dan diurutkan dari yang terbaru
    const dataSnap = await productsCollection
        .orderBy('created_at', 'desc')
        .offset(offset)
        .limit(limit)
        .get();

    const data: OrderWithId[] = dataSnap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Order)
    }));

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


export const listOrders = async (buyerId: string): Promise<OrderWithId[]> => { // Belum menyertakan item
    const snap = await db
        .collection('orders')
        .where('buyer_id', '==', buyerId)
        .orderBy('created_at', 'desc')
        .get();

    // Jika ingin menyertakan preview item di sini, perlu query tambahan per order
    // Untuk saat ini, listOrders hanya mengembalikan data order utama
    return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Order)
    }));
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

export const createOrderFromCart = async (
  buyerId: string,
  shippingAddress: string // Parameter baru
): Promise<OrderWithId> => {
  const cartItemsRef = db.collection('carts').doc(buyerId).collection('items');
  const cartItemsSnap = await cartItemsRef.get();

  if (cartItemsSnap.empty) {
    throw new Error('Cart is empty. Cannot create order.');
  }

  // Data OrderItem dan referensi dokumen keranjang untuk dihapus nanti
  const cartItemsData: { id: string, data: CartItem }[] = cartItemsSnap.docs.map(doc => ({
    id: doc.id,
    data: doc.data() as CartItem
  }));

  const newOrderId = db.collection('orders').doc().id; // Generate ID order di awal

  await db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(newOrderId);
    let totalAmount = 0;
    const orderItemsForCreation: OrderItem[] = [];

    // Iterasi 1: Validasi stok dan siapkan data order item
    for (const cartDoc of cartItemsData) {
      const cartItem = cartDoc.data;
      const productRef = db.collection('products').doc(cartItem.product_id);
      const productSnap = await tx.get(productRef);

      if (!productSnap.exists) {
        throw new Error(`Product with ID ${cartItem.product_id} not found.`);
      }

      const product = productSnap.data() as Product;

      if (product.stock < cartItem.quantity) {
        throw new Error(
          `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${cartItem.quantity}.`
        );
      }
      
      // Periksa apakah harga per item di keranjang masih valid atau perlu diambil ulang
      // Untuk implementasi ini, kita asumsikan price_per_item di keranjang sudah final saat ditambahkan
      if (typeof cartItem.price_per_item !== 'number' || cartItem.price_per_item < 0) {
        throw new Error(`Invalid price_per_item for product "${product.name}" in cart.`);
      }


      // Update stok produk
      tx.update(productRef, {
        stock: FieldValue.increment(-cartItem.quantity)
      });

      // Akumulasi total
      totalAmount += cartItem.quantity * cartItem.price_per_item;

      // Siapkan OrderItem
      orderItemsForCreation.push({
        product_id: cartItem.product_id,
        quantity: cartItem.quantity,
        price_per_item: cartItem.price_per_item
      });
    }

    // Buat dokumen Order utama
    const orderPayload: Order = {
      buyer_id: buyerId,
      total_amount: totalAmount,
      shipping_address: shippingAddress, // Gunakan parameter
      order_status: 'pending',
      created_at: FieldValue.serverTimestamp() as admin.firestore.Timestamp, // Gunakan server timestamp
    };
    tx.set(orderRef, orderPayload);

    // Buat dokumen OrderItem dalam subcollection
    for (const orderItemData of orderItemsForCreation) {
      const orderItemRef = orderRef.collection('items').doc();
      tx.set(orderItemRef, orderItemData);
    }

    // Kosongkan keranjang (hapus item-item dari subcollection cart)
    for (const cartDoc of cartItemsData) {
      tx.delete(cartItemsRef.doc(cartDoc.id));
    }
  });

  return {
    id: newOrderId,
    buyer_id: buyerId,
    total_amount: (await db.collection('orders').doc(newOrderId).get()).data()?.total_amount, // Re-fetch to be sure, or manage state better
    shipping_address: shippingAddress,
    order_status: 'pending',

  } as OrderWithId;
};
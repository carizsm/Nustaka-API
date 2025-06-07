// services/cartService.ts
import admin from '../config/firebase';
import { FieldPath } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore'; 
import { CartItemWithId, CartItem, Product, QueryResult, ProductWithId } from '../interfaces'; // Tambahkan Product, ProductWithId

const db = admin.firestore();
const productsCollection = db.collection('products');

export interface EnrichedCartItem extends CartItemWithId {
    productDetails?: { // Informasi produk yang disematkan
        name: string;
        images: string[]; 
    };
    buyerId?: string; 
}

export const listAllCartItems = async (
    page: number = 1,
    limit: number = 10
): Promise<QueryResult<EnrichedCartItem>> => {
    const offset = (page - 1) * limit;

    const itemsCollectionGroup = db.collectionGroup('items');

    const totalSnap = await itemsCollectionGroup.get();
    const total = totalSnap.size;

    const dataQuery = itemsCollectionGroup
        .where('quantity', '>', 0)
        .orderBy('quantity', 'asc')
        .orderBy('added_at', 'desc')
        .offset(offset)
        .limit(limit);

    const dataSnap = await dataQuery.get();

    // Proses untuk memperkaya setiap item dengan detail produk dan buyerId
    const enrichedItemsPromises = dataSnap.docs.map(async (doc): Promise<EnrichedCartItem> => {
        const itemData = doc.data() as CartItem;
        // Untuk mendapatkan buyerId, kita ambil ID dari dokumen parent dari sub-koleksi 'items'
        const buyerId = doc.ref.parent.parent!.id; 

        const enrichedItem: EnrichedCartItem = {
            id: doc.id,
            cart_id: buyerId,
            buyerId: buyerId, 
            ...itemData,
        };

        if (itemData.product_id) {
            try {
                const productSnap = await productsCollection.doc(itemData.product_id).get();
                if (productSnap.exists) {
                    const productData = productSnap.data() as Product;
                    enrichedItem.productDetails = {
                        name: productData.name,
                        images: productData.images,
                    };
                }
            } catch (error) {
                console.error(`Error fetching product details for cart item ${doc.id}:`, error);
            }
        }
        return enrichedItem;
    });

    const data = await Promise.all(enrichedItemsPromises);

    return { data, total, page, limit };
};

export const getCart = async (buyerId: string): Promise<EnrichedCartItem[]> => {
    const itemsSnap = await db
        .collection('carts')
        .doc(buyerId)
        .collection('items')
        //.orderBy('added_at', 'desc') // Urutkan berdasarkan kapan ditambahkan
        .get();

    if (itemsSnap.empty) {
        return [];
    }

    const enrichedItemsPromises = itemsSnap.docs.map(async (doc): Promise<EnrichedCartItem> => {
        const cartItemData = doc.data() as CartItem;
        const cartItemWithId: CartItemWithId = {
            id: doc.id,
            cart_id: buyerId,
            ...cartItemData
        };

        let productDetails;
        if (cartItemData.product_id) {
            try {
                const productSnap = await productsCollection.doc(cartItemData.product_id).get();
                if (productSnap.exists) {
                    const productData = productSnap.data() as Product;
                    productDetails = {
                        name: productData.name,
                        images: productData.images,
                    };
                } else {
                    console.warn(`Product with ID ${cartItemData.product_id} not found for cart item ${doc.id}`);
                }
            } catch (error) {
                console.error(`Error fetching product details for cart item ${doc.id}:`, error);
            }
        }
        return { ...cartItemWithId, productDetails };
    });

    return Promise.all(enrichedItemsPromises);
};

export const addToCart = async (
  buyerId: string,
  productId: string,
  qty: number
): Promise<CartItemWithId> => {
  const prodDoc = await productsCollection.doc(productId).get();
  if (!prodDoc.exists) {
    throw new Error('Product not found');
  }
  const product = prodDoc.data() as Product;
  const pricePerItem = product.price;

  // Kita akan cek apakah item ini sudah ada di keranjang untuk di-update, bukan membuat duplikat
  const itemsCollectionRef = db.collection('carts').doc(buyerId).collection('items');
  const existingItemQuery = await itemsCollectionRef.where('product_id', '==', productId).limit(1).get();

  if (!existingItemQuery.empty) {
    // Jika item sudah ada, update kuantitasnya
    const existingItemDoc = existingItemQuery.docs[0];
    const existingItemData = existingItemDoc.data() as CartItem;
    const newQuantity = existingItemData.quantity + qty;
    
    await existingItemDoc.ref.update({ quantity: newQuantity });
    
    return {
      id: existingItemDoc.id,
      cart_id: buyerId,
      ...existingItemDoc.data(),
      quantity: newQuantity, // Kembalikan kuantitas baru
    } as CartItemWithId;
  }

  // Jika item belum ada, buat baru
  const payload: Omit<CartItem, 'id'> = { // Gunakan Omit untuk kejelasan tipe
    product_id: productId,
    quantity: qty,
    price_per_item: pricePerItem,
    added_at: Timestamp.now() // WAJIB ADA: Gunakan Timestamp.now() dari 'firebase-admin/firestore'
  };

  const docRef = await itemsCollectionRef.add(payload);

  return {
    id: docRef.id,
    cart_id: buyerId,
    ...(payload as CartItem)
  };
};

// Update quantity of an existing cart item
export const updateCartItem = async (
  buyerId: string,
  itemId: string,
  qty: number
): Promise<boolean> => {
  await db
    .collection('carts')
    .doc(buyerId)
    .collection('items')
    .doc(itemId)
    .update({ quantity: qty });
  return true;
};

// Delete an item from cart
export const deleteCartItem = async (
  buyerId: string,
  itemId: string
): Promise<boolean> => {
  await db
    .collection('carts')
    .doc(buyerId)
    .collection('items')
    .doc(itemId)
    .delete();
  return true;
};
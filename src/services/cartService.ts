// services/cartService.ts
import admin from '../config/firebase';
import { CartItemWithId, CartItem, Product, ProductWithId } from '../interfaces'; // Tambahkan Product, ProductWithId

const db = admin.firestore();
const productsCollection = db.collection('products');

export interface EnrichedCartItem extends CartItemWithId {
    productDetails?: { // Informasi produk yang disematkan
        name: string;
        images: string[]; 
    };
}

export const getCart = async (buyerId: string): Promise<EnrichedCartItem[]> => {
    const itemsSnap = await db
        .collection('carts')
        .doc(buyerId)
        .collection('items')
        .orderBy('added_at', 'desc') // Urutkan berdasarkan kapan ditambahkan
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

// Add item to cart: automatically fetches product price
export const addToCart = async (
  buyerId: string,
  productId: string,
  qty: number
): Promise<CartItemWithId> => {
  // Ambil data produk untuk mendapatkan price_per_item
  const prodDoc = await db.collection('products').doc(productId).get();
  if (!prodDoc.exists) {
    throw new Error('Product not found');
  }
  const product = prodDoc.data() as Product;
  const pricePerItem = product.price;

  const payload: CartItem = {
    product_id: productId,
    quantity: qty,
    price_per_item: pricePerItem,
    added_at: new Date() as any
  };

  const docRef = await db
    .collection('carts')
    .doc(buyerId)
    .collection('items')
    .add(payload);

  return {
    id: docRef.id,
    cart_id: buyerId,
    ...payload
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
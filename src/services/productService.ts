import { firestore } from "../config/firebase";
import { Product, ProductWithId, ProductHistory, ProductHistoryWithId, QueryResult } from "../interfaces";

// Collection References
const productCollection = firestore.collection("products");
const historyCollection = firestore.collection("product_histories");

// Get All Products with pagination
export const getAllProducts = async (
  page: number = 1, 
  limit: number = 10
): Promise<QueryResult<ProductWithId>> => {
  const offset = (page - 1) * limit;
  
  // Get total count
  const countSnapshot = await productCollection.count().get();
  const total = countSnapshot.data().count;
  
  // Get paginated data
  const snapshot = await productCollection
    .orderBy("created_at", "desc")
    .offset(offset)
    .limit(limit)
    .get();
  
  const products: ProductWithId[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data() as Product
  }));
  
  return {
    data: products,
    total,
    page,
    limit
  };
};

// Get Product By ID
export const getProductById = async (id: string): Promise<ProductWithId | null> => {
  const doc = await productCollection.doc(id).get();
  return doc.exists ? { id: doc.id, ...(doc.data() as Product) } : null;
};

// Get Products By Seller ID
export const getProductsBySellerId = async (sellerId: string): Promise<ProductWithId[]> => {
  const snapshot = await productCollection.where("seller_id", "==", sellerId).get();
  
  const products: ProductWithId[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data() as Product
  }));
  
  return products;
};

// Create Product and its History
export const createProduct = async (
  productData: Product, 
  historyData: ProductHistory
): Promise<ProductWithId> => {
  // Use transaction to ensure both documents are created
  const result = await firestore.runTransaction(async (transaction) => {
    // Create product document
    const productRef = productCollection.doc();
    transaction.set(productRef, productData);
    
    // Create history document with reference to product
    const historyRef = historyCollection.doc();
    transaction.set(historyRef, {
      ...historyData,
      product_id: productRef.id
    });
    
    // Return the product with ID
    return {
      id: productRef.id,
      ...productData
    };
  });
  
  return result;
};

// Get Product History
export const getProductHistory = async (productId: string): Promise<ProductHistoryWithId | null> => {
  const snapshot = await historyCollection.where("product_id", "==", productId).limit(1).get();
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return { 
    id: doc.id, 
    ...(doc.data() as ProductHistory),
    product_id: productId
  };
};

// Update Product
export const updateProduct = async (id: string, productData: Partial<Product>): Promise<boolean> => {
  try {
    await productCollection.doc(id).update(productData);
    return true;
  } catch (error) {
    console.error("Error updating product:", error);
    return false;
  }
};

// Delete Product and its History
export const deleteProduct = async (id: string): Promise<boolean> => {
  try {
    await firestore.runTransaction(async (transaction) => {
      // Find and delete product history
      const historySnapshot = await historyCollection.where("product_id", "==", id).limit(1).get();
      if (!historySnapshot.empty) {
        transaction.delete(historySnapshot.docs[0].ref);
      }
      
      // Delete product
      transaction.delete(productCollection.doc(id));
    });
    
    return true;
  } catch (error) {
    console.error("Error deleting product:", error);
    return false;
  }
};

// Search Products
export const searchProducts = async (query: string): Promise<ProductWithId[]> => {
  // This is a simple implementation. In a real-world scenario, 
  // you might want to use Firebase extensions or a separate search service like Algolia
  const nameSnapshot = await productCollection
    .where("name", ">=", query)
    .where("name", "<=", query + "\uf8ff")
    .get();
  
  const descSnapshot = await productCollection
    .where("description", ">=", query)
    .where("description", "<=", query + "\uf8ff")
    .get();
  
  // Combine results and remove duplicates
  const combinedDocs = [...nameSnapshot.docs, ...descSnapshot.docs];
  const uniqueIds = new Set();
  const products: ProductWithId[] = [];
  
  combinedDocs.forEach(doc => {
    if (!uniqueIds.has(doc.id)) {
      uniqueIds.add(doc.id);
      products.push({
        id: doc.id,
        ...doc.data() as Product
      });
    }
  });
  
  return products;
};
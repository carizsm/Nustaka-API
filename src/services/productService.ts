// services/productService.ts
import admin from '../config/firebase';
import {
    Product,
    ProductWithId,
    ProductHistory,
    ProductHistoryWithId,
    QueryResult,
    User, 
    Review
} from '../interfaces';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const productsCollection = db.collection('products');
const productHistoriesCollection = db.collection('product_histories');
const usersCollection = db.collection('users'); // Referensi ke koleksi user
const reviewsCollection = db.collection('reviews'); // Referensi ke koleksi review

// Definisikan tipe baru untuk produk yang diperkaya sepenuhnya
export interface FullyEnrichedProduct extends ProductWithId {
    history?: ProductHistoryWithId; // Sudah ada
    sellerInfo?: { // Informasi penjual yang disematkan
        id: string;
        username: string;
        // Tambahkan field lain yang relevan, misal 'store_name' jika ada di User interface
    };
    reviewSummary?: { // Ringkasan ulasan yang disematkan
        averageRating: number | null;
        reviewCount: number;
        // latestReviews?: Review[]; // Opsional: beberapa ulasan terbaru
    };
}

// Tipe data untuk filter di listProducts
export interface ProductListFilters {
    categoryId?: string;
    regionId?: string;
    sellerId?: string;
    status?: string;
}

export const listProducts = async (
    page: number = 1,
    limit: number = 10,
    filters: ProductListFilters = {}
): Promise<QueryResult<ProductWithId>> => {
    const offset = (page - 1) * limit;

    let dataQuery: admin.firestore.Query = productsCollection;
    let countQuery: admin.firestore.Query = productsCollection;

    if (filters.categoryId) {
        dataQuery = dataQuery.where('category_id', '==', filters.categoryId);
        countQuery = countQuery.where('category_id', '==', filters.categoryId);
    }
    if (filters.regionId) {
        dataQuery = dataQuery.where('region_id', '==', filters.regionId);
        countQuery = countQuery.where('region_id', '==', filters.regionId);
    }
    if (filters.sellerId) {
        dataQuery = dataQuery.where('seller_id', '==', filters.sellerId);
        countQuery = countQuery.where('seller_id', '==', filters.sellerId);
        if (filters.status) { // Seller bisa filter status produknya
            dataQuery = dataQuery.where('status', '==', filters.status);
            countQuery = countQuery.where('status', '==', filters.status);
        }
    } else { // Publik atau tidak spesifik seller
        const statusToFilter = filters.status || 'available'; // Default 'available' untuk publik
        dataQuery = dataQuery.where('status', '==', statusToFilter);
        countQuery = countQuery.where('status', '==', statusToFilter);
    }

    dataQuery = dataQuery.orderBy('created_at', 'desc'); // Indeks mungkin diperlukan

    try {
        const totalSnap = await countQuery.get();
        const total = totalSnap.size;

        const dataSnap = await dataQuery.offset(offset).limit(limit).get();
        const data: ProductWithId[] = dataSnap.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Product)
        }));

        return { data, total, page, limit };
    } catch (error: any) {
        console.error("Service Error - listProducts:", error);
        throw new Error(`Failed to retrieve products: ${error.message}`);
    }
};

// Tipe input untuk service dari controller
export type ProductServiceCreationInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>;
export type ProductHistoryServiceCreationInput = Omit<ProductHistory, 'id' | 'product_id'>;

export const createProduct = async (
    productInput: ProductServiceCreationInput,
    historyInput: ProductHistoryServiceCreationInput
): Promise<ProductWithId> => {
    const productRef = productsCollection.doc(); // Generate ref untuk ID baru
    const historyRef = productHistoriesCollection.doc();

    const productDataForFirestore: Product = { // Data yang akan disimpan di Firestore (tanpa ID internal)
        ...productInput,
        created_at: FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updated_at: FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    };

    const historyDataForFirestore: ProductHistory & { product_id: string } = {
        ...historyInput,
        product_id: productRef.id, // Link ke ID produk yang baru
    };

    try {
        await db.runTransaction(async (tx) => {
            tx.set(productRef, productDataForFirestore);
            tx.set(historyRef, historyDataForFirestore);
        });

        const createdDocSnap = await productRef.get();
        if (!createdDocSnap.exists) {
            throw new Error("Critical: Created product document not found immediately after transaction.");
        }
        return { id: createdDocSnap.id, ...(createdDocSnap.data() as Product) };
    } catch (error: any) {
        console.error("Service Error - createProduct:", error);
        throw new Error(`Failed to create product: ${error.message}`);
    }
};

export type ProductServiceUpdateInput = Partial<Omit<Product, 'id' | 'created_at' | 'updated_at' | 'seller_id'>>;
export type ProductHistoryServiceUpdateInput = Partial<Omit<ProductHistory, 'id' | 'product_id'>>;

export const updateProduct = async (
    productId: string,
    productUpdate: ProductServiceUpdateInput,
    historyUpdate?: ProductHistoryServiceUpdateInput
): Promise<boolean> => {
    const productRef = productsCollection.doc(productId);

    if (Object.keys(productUpdate).length === 0 && (!historyUpdate || Object.keys(historyUpdate).length === 0)) {
        console.warn(`No data provided to update product ID: ${productId}`);
        return false; // Tidak ada yang diupdate
    }

    try {
        await db.runTransaction(async (tx) => {
            const productDoc = await tx.get(productRef); // Ambil dalam transaksi
            if (!productDoc.exists) {
                throw new Error("Product not found."); // Akan ditangkap oleh catch di bawah
            }

            if (Object.keys(productUpdate).length > 0) {
                const productPayloadWithTimestamp = {
                    ...productUpdate,
                    updated_at: FieldValue.serverTimestamp(),
                };
                tx.update(productRef, productPayloadWithTimestamp);
            }

            if (historyUpdate && Object.keys(historyUpdate).length > 0) {
                const historyQuery = productHistoriesCollection.where('product_id', '==', productId).limit(1);
                const historySnap = await tx.get(historyQuery);

                if (!historySnap.empty) {
                    const existingHistoryRef = historySnap.docs[0].ref;
                    tx.update(existingHistoryRef, historyUpdate);
                } else {
                    // Jika ingin membuat history baru saat update jika belum ada
                    const newHistoryRef = productHistoriesCollection.doc();
                    tx.set(newHistoryRef, { ...historyUpdate, product_id: productId });
                }
            }
        });
        return true;
    } catch (error: any) {
        console.error(`Service Error - updateProduct for ${productId}:`, error);
        if (error.message === "Product not found.") { // Error dari check di dalam transaksi
            throw error;
        }
        throw new Error(`Failed to update product: ${error.message}`);
    }
};

export const getProduct = async (productId: string): Promise<FullyEnrichedProduct | null> => {
    try {
        const productDoc = await productsCollection.doc(productId).get();
        if (!productDoc.exists) {
            return null;
        }

        const productData = productDoc.data() as Product;
        let enrichedProduct: FullyEnrichedProduct = { 
            id: productDoc.id, 
            ...productData 
        };

        // 1. Ambil Product History (seperti sebelumnya)
        const historySnap = await productHistoriesCollection.where('product_id', '==', productId).limit(1).get();
        if (!historySnap.empty) {
            const historyDocData = historySnap.docs[0];
            enrichedProduct.history = {
                id: historyDocData.id,
                ...(historyDocData.data() as ProductHistory),
                product_id: productId,
            };
        }

        // 2. Ambil Informasi Penjual
        if (productData.seller_id) {
            try {
                const sellerDoc = await usersCollection.doc(productData.seller_id).get();
                if (sellerDoc.exists) {
                    const sellerData = sellerDoc.data() as User; // Asumsikan User interface punya username
                    enrichedProduct.sellerInfo = {
                        id: sellerDoc.id,
                        username: sellerData.username,
                        // Jika ada 'store_name' atau field relevan lain di User atau SellerProfile:
                        // store_name: sellerData.store_name || sellerData.username, 
                    };
                } else {
                     console.warn(`Seller with ID ${productData.seller_id} not found for product ${productId}`);
                }
            } catch (error) {
                console.error(`Error fetching seller info for product ${productId}:`, error);
            }
        }

        // 3. Ambil Ringkasan Ulasan
        try {
            const reviewsQuerySnap = await reviewsCollection.where('product_id', '==', productId).get();
            const reviewCount = reviewsQuerySnap.size;
            let totalRating = 0;
            // Jika ingin mengambil beberapa ulasan terbaru, bisa tambahkan .orderBy().limit() di sini
            // const latestReviewsData: Review[] = []; 

            if (reviewCount > 0) {
                reviewsQuerySnap.forEach(doc => {
                    const review = doc.data() as Review;
                    totalRating += review.rating;
                    // if (latestReviewsData.length < 3) { latestReviewsData.push(review); }
                });
                enrichedProduct.reviewSummary = {
                    averageRating: parseFloat((totalRating / reviewCount).toFixed(1)), // Bulatkan ke 1 desimal
                    reviewCount: reviewCount,
                    // latestReviews: latestReviewsData, // Jika diimplementasikan
                };
            } else {
                enrichedProduct.reviewSummary = {
                    averageRating: null,
                    reviewCount: 0,
                    // latestReviews: [],
                };
            }
        } catch (error) {
            console.error(`Error fetching review summary for product ${productId}:`, error);
            // Tetap kembalikan produknya, ringkasan ulasan bisa kosong/default
             enrichedProduct.reviewSummary = { averageRating: null, reviewCount: 0 };
        }

        return enrichedProduct;
    } catch (error: any) {
        console.error(`Service Error - getProduct for ${productId}:`, error);
        throw new Error(`Failed to retrieve product details: ${error.message}`);
    }
};

export const searchProducts = async (query: string, limit: number = 15): Promise<ProductWithId[]> => {
    // Memerlukan indeks Firestore: status ASC, name ASC
    try {
        const snap = await productsCollection
            .where('status', '==', 'available') // Hanya cari produk yang available
            .orderBy('name')
            .startAt(query)
            .endAt(query + '\uf8ff')
            .limit(limit)
            .get();

        return snap.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Product)
        }));
    } catch (error: any) {
        console.error("Service Error - searchProducts:", error);
        throw new Error(`Product search failed: ${error.message}`);
    }
};

export const deleteProduct = async (productId: string): Promise<boolean> => {
    const productRef = productsCollection.doc(productId);
    try {
        await db.runTransaction(async (tx) => {
            const productDoc = await tx.get(productRef); // Ambil dalam transaksi
            if (!productDoc.exists) {
                throw new Error("Product not found.");
            }

            const historyQuery = productHistoriesCollection.where('product_id', '==', productId);
            const historySnap = await tx.get(historyQuery);
            historySnap.docs.forEach(doc => tx.delete(doc.ref));

            tx.delete(productRef);
        });
        return true;
    } catch (error: any) {
        console.error(`Service Error - deleteProduct for ${productId}:`, error);
         if (error.message === "Product not found.") {
            throw error;
        }
        throw new Error(`Failed to delete product: ${error.message}`);
    }
};
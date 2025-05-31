// src/services/reviewService.ts
import admin from '../config/firebase'; // Firestore admin
import { Review, ReviewWithId } from '../interfaces';
import { Timestamp } from 'firebase-admin/firestore';

const db = admin.firestore();
const reviewsCollection = db.collection('reviews');

export const listReviews = async (productId: string): Promise<ReviewWithId[]> => {
  try {
    const snap = await reviewsCollection
      .where('product_id', '==', productId)
      .orderBy('created_at', 'desc')
      .get();

    return snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Review)
    }));
  } catch (error: any) {
    console.error("Service Error - listReviews:", error);
    throw new Error(`Failed to retrieve reviews: ${error.message}`);
  }
};

export const createReview = async (
  productId: string,
  buyerId: string,
  rating: number,
  comment: string,
  imageUrl?: string
): Promise<ReviewWithId> => {
  try {
    if (!productId || !buyerId || rating === undefined || !comment) {
      throw new Error("Missing required review fields.");
    }
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5.");
    }

    // Definisikan data inti tanpa timestamp atau id terlebih dahulu
    const coreReviewData: Omit<Review, 'id' | 'created_at' | 'image_url'> & { image_url?: string } = {
      product_id: productId,
      buyer_id: buyerId,
      rating: Math.round(rating),
      comment: comment,
    };
    
    if (imageUrl) {
      coreReviewData.image_url = imageUrl;
    }

    // Buat objek final yang akan disimpan, sekarang termasuk created_at
    // Tipe objek ini adalah 'Review' tanpa 'id' karena 'id' akan digenerate Firestore
    const reviewToSave: Omit<Review, 'id'> = {
        ...(coreReviewData as Omit<Review, 'id' | 'created_at'>), // Cast untuk spread
        created_at: Timestamp.now(), // Tambahkan created_at di sini
    };


    const docRef = await reviewsCollection.add(reviewToSave); // Simpan objek yang sudah benar tipenya
    
    const createdDoc = await docRef.get();
    if (!createdDoc.exists) {
        throw new Error("Failed to retrieve created review after saving.");
    }

    return { 
        id: docRef.id, 
        ...(createdDoc.data() as Review) 
    };

  } catch (error: any) {
    console.error("Service Error - createReview:", error);
    throw new Error(`Failed to create review: ${error.message}`);
  }
};
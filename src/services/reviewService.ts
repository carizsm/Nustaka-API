import admin from '../config/firebase';
import { ReviewWithId, Review } from '../interfaces';

const db = admin.firestore();

export const listReviews = async (productId: string): Promise<ReviewWithId[]> => {
  const snap = await db
    .collection('reviews')
    .where('product_id', '==', productId)
    .get();

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Review)
  }));
};

export const createReview = async (
  productId: string,
  buyerId: string,
  rating: number,
  comment: string
): Promise<ReviewWithId> => {
  const payload: Review = {
    product_id: productId,
    buyer_id: buyerId,
    rating,
    comment,
    created_at: new Date() as any
  };

  const ref = await db.collection('reviews').add(payload);
  return { id: ref.id, ...payload };
};

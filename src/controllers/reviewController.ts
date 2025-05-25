import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as svc from '../services/reviewService';

// GET /api/reviews/product/:productId
export const getReviewsByProduct = async (
  req: AuthRequest,
  res: Response
) => {
  const productId = req.params.productId;
  const list = await svc.listReviews(productId);
  res.json(list);
};

// POST /api/reviews
export const createReview = async (
  req: AuthRequest,
  res: Response
) => {
  const buyerId = req.userId!;  // non-null after authenticateUser
  const { product_id, rating, comment } = req.body;
  
  const r = await svc.createReview(
    product_id,
    buyerId,
    rating,
    comment
  );
  res.status(201).json(r);
};

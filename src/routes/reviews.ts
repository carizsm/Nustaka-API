// routes/reviews.ts
import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import * as ctl from '../controllers/reviewController';
const r = Router();
r.get('/product/:productId', ctl.getReviewsByProduct);
r.use(authenticateUser);
r.post('/', ctl.createReview);
export default r;
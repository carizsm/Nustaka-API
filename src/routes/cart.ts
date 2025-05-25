
// routes/cart.ts
import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import * as ctl from '../controllers/cartController';
const r = Router();
r.use(authenticateUser);
r.get('/', ctl.getCart);
r.post('/', ctl.addToCart);
r.put('/:itemId', ctl.updateCartItem);
r.delete('/:itemId', ctl.deleteCartItem);
export default r;
// routes/orders.ts
import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import * as ctl from '../controllers/orderController';
const r = Router();
r.use(authenticateUser);
r.get('/', ctl.getOrders);
r.get('/:id', ctl.getOrderById);
r.post('/', ctl.createOrder);
export default r;
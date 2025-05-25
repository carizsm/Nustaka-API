// controllers/orderController.ts
import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as svc from '../services/orderService';

export const getOrders = async (req: AuthRequest, res: Response) => {
  const buyerId = req.userId!;  
  const orders = await svc.listOrders(buyerId);
  res.json(orders);
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  const orderId = req.params.id;
  // Tambahkan pengecekan apakah order milik buyerId atau user adalah admin
  // Untuk sekarang, kita asumsikan service akan menangani ini atau akan diperbaiki nanti
  const order = await svc.getOrder(orderId /*, req.userId, req.userRole */);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }
  // Pastikan order.buyer_id === req.userId || req.userRole === 'admin'
  if (order.buyer_id !== req.userId && req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: You do not have access to this order' });
  }
  res.json(order);
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  const buyerId = req.userId!;
  const { shipping_address } = req.body;

  if (!shipping_address || typeof shipping_address !== 'string' || shipping_address.trim() === '') {
    return res.status(400).json({ message: 'Shipping address is required and must be a non-empty string' });
  }

  try {
    const newOrder = await svc.createOrderFromCart(buyerId, shipping_address.trim());
    res.status(201).json(newOrder);
  } catch (error: any) {
    console.error('Create Order Error:', error);
    if (error.message.startsWith('Insufficient stock') || error.message.startsWith('Product not found')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to create order. ' + error.message });
  }
};
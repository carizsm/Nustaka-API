import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as svc from '../services/cartService';

export const getCart = async (req: AuthRequest, res: Response) => {
  // Setelah authenticateUser, userId pasti terisi
  const buyerId = req.userId!;  
  const items = await svc.getCart(buyerId);
  res.json(items);
};

export const addToCart = async (req: AuthRequest, res: Response) => {
  const buyerId = req.userId!;
  const { product_id, quantity } = req.body;
  const item = await svc.addToCart(buyerId, product_id, quantity);
  res.status(201).json(item);
};

export const updateCartItem = async (req: AuthRequest, res: Response) => {
  const buyerId = req.userId!;
  const itemId = req.params.itemId;
  const { quantity } = req.body;
  const success = await svc.updateCartItem(buyerId, itemId, quantity);
  res.json({ success });
};

export const deleteCartItem = async (req: AuthRequest, res: Response) => {
  const buyerId = req.userId!;
  const itemId = req.params.itemId;
  const success = await svc.deleteCartItem(buyerId, itemId);
  res.json({ success });
};

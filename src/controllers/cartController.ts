import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as svc from '../services/cartService';

export const getCart = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.userRole;
        const userId = req.userId;

        if (userRole === 'admin') {
            const { page, limit } = req.query;
            const allCartItemsResult = await svc.listAllCartItems(
                Number(page) || 1,
                Number(limit) || 10
            );
            return res.status(200).json(allCartItemsResult);
        } else {
            if (!userId) {
                // Pengaman, meskipun middleware seharusnya sudah memastikan userId ada
                return res.status(401).json({ message: "Authentication error: User ID not found in token." });
            }
            const userCartItems = await svc.getCart(userId);
            return res.status(200).json(userCartItems);
        }
    } catch (error: any) {
        console.error("Controller Error - getCart:", error);
        res.status(500).json({ message: error.message || "Failed to fetch cart data." });
    }
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

// controllers/orderController.ts
import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as svc from '../services/orderService';
import { CheckoutData } from '../services/orderService';

export const getOrders = async (req: AuthRequest, res: Response) => {
    try {
        const userRole = req.userRole;
        const userId = req.userId;
        const { page, limit } = req.query; // Ambil paginasi dari query params

        if (userRole === 'admin') {
            const allOrders = await svc.listAllOrders(
                Number(page) || 1, 
                Number(limit) || 10
            );
            return res.json(allOrders);
        } else {
            if (!userId) {
                return res.status(401).json({ message: "User ID not found in token." });
            }
            // --- MODIFIKASI PEMANGGILAN SERVICE ---
            // Teruskan parameter paginasi ke fungsi listOrders
            const userOrders = await svc.listOrders(
                userId,
                Number(page) || 1,
                Number(limit) || 10
            );
            // ------------------------------------
            return res.json(userOrders);
        }
    } catch (error: any) {
        console.error("Controller Error - getOrders:", error);
        res.status(500).json({ message: error.message || "Failed to fetch orders." });
    }
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
  const { 
    shipping_address,
    subtotal_items,
    shipping_cost,
    shipping_insurance_fee,
    application_fee,
    product_discount,
    shipping_discount,
    total_amount
  } = req.body;

  // Validasi dasar bahwa field-field numerik yang wajib ada
  if (
    !shipping_address ||
    subtotal_items === undefined ||
    shipping_cost === undefined ||
    shipping_insurance_fee === undefined ||
    application_fee === undefined ||
    total_amount === undefined
  ) {
    return res.status(400).json({ message: "Missing required checkout data fields." });
  }

  // Buat objek checkoutData
  const checkoutData: CheckoutData = {
    shipping_address,
    subtotal_items: Number(subtotal_items),
    shipping_cost: Number(shipping_cost),
    shipping_insurance_fee: Number(shipping_insurance_fee),
    application_fee: Number(application_fee),
    product_discount: product_discount ? Number(product_discount) : undefined,
    shipping_discount: shipping_discount ? Number(shipping_discount) : undefined,
    total_amount: Number(total_amount),
  };
  
  try {
    const newOrder = await svc.createOrderFromCart(buyerId, checkoutData);
    res.status(201).json(newOrder);
  } catch (error: any) {
    console.error('Create Order Error:', error);
    // Kirim pesan error yang lebih spesifik dari validasi service
    if (error.message.includes("mismatch")) {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || 'Failed to create order.' });
  }
};

export const getSellerOrders = async (req: AuthRequest, res: Response) => {
    try {
        const sellerId = req.userId;
        if (!sellerId) {
            return res.status(401).json({ message: "Authentication required: Seller ID not found." });
        }

        const { page, limit } = req.query;
        const sellerOrders = await svc.listOrdersForSeller(
            sellerId,
            Number(page) || 1,
            Number(limit) || 10
        );
        
        res.status(200).json(sellerOrders);

    } catch (error: any) {
        console.error("Controller Error - getSellerOrders:", error);
        res.status(500).json({ message: error.message || "Failed to fetch seller orders." });
    }
};
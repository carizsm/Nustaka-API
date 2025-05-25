// routes/products.ts
import { Router } from 'express';
import {
  getProducts,
  getProductById,
  searchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getMyProducts // Impor controller baru
} from '../controllers/productController';
import { authenticateUser, isSeller } from '../middlewares/authMiddleware';

const router = Router();

// Buyer-accessible routes (dan filter umum)
router.get('/', getProducts); // Tetap, sekarang dengan kemampuan filter
router.get('/search', searchProducts);

// Seller-only route: Melihat produk miliknya sendiri
// Harus didefinisikan SEBELUM /:id agar '/my' tidak dianggap sebagai ID produk
router.get(
  '/my',
  authenticateUser,
  isSeller,
  getMyProducts
);

// Buyer-accessible: Melihat detail produk spesifik
router.get('/:id', getProductById);

// Seller-only routes: CRUD produk
router.post(
  '/',
  authenticateUser,
  isSeller,
  createProduct
);

router.put(
  '/:id',
  authenticateUser,
  isSeller,
  updateProduct
);

router.delete(
  '/:id',
  authenticateUser,
  isSeller,
  deleteProduct
);

export default router;
// src/routes/reviews.ts
import { Router } from 'express';
import { authenticateUser } from '../middlewares/authMiddleware';
import * as reviewController from '../controllers/reviewController'; // Ubah cara impor jika perlu
import multer from 'multer';

const router = Router();

// Konfigurasi Multer
// Simpan file di memori sebagai Buffer, bukan ke disk server sementara
const storage = multer.memoryStorage(); 
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Batas ukuran file, misal 5MB
    fileFilter: (req, file, cb) => { // Filter tipe file (opsional)
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
            cb(null, true);
        } else {
            cb(null, false);
            // Anda bisa juga melempar error di sini jika tipe file tidak valid
            // return cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
        }
    }
});

// GET /api/reviews/product/:productId - Tidak perlu auth untuk melihat review
router.get('/product/:productId', reviewController.getReviewsByProduct);

// POST /api/reviews - Membuat review baru (memerlukan auth dan menangani upload gambar)
// Gunakan upload.single('namaFieldFile') dari multer
// 'reviewImage' adalah nama field di form-data yang akan dikirim dari client
router.post(
    '/', 
    authenticateUser, 
    upload.single('reviewImage'), // Middleware Multer untuk satu file dengan field 'reviewImage'
    reviewController.createReview
);

export default router;
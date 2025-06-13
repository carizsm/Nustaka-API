// src/routes/userRoutes.ts
import { Router } from 'express';
// Impor semua fungsi controller yang dibutuhkan
import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import {
  getUsers,
  getUserProfile,
  getCurrentUser,
  registerUser,
  updateUserProfile,
  deleteUserAccount,
  login,
  logoutUser,
  uploadAvatar
} from '../controllers/userController'; 

// Impor middleware
import { authenticateUser, isAdmin } from '../middlewares/authMiddleware'; 
const router = Router();

const storage = multer.memoryStorage();
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        // Terima file jika tipenya adalah gambar
        cb(null, true);
    } else {
        // Tolak file dan kirim error jika bukan gambar
        // Panggil callback HANYA dengan objek Error
        cb(new Error('Hanya file gambar yang diizinkan!'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Batas 2MB
    fileFilter: fileFilter
});

// Rute Publik
router.post('/register', registerUser);
router.post('/login', login);

router.post('/logout', authenticateUser, logoutUser); 

// Rute Terproteksi
router.get('/me', authenticateUser, getCurrentUser);
router.put('/me', authenticateUser, updateUserProfile);
router.delete('/me', authenticateUser, deleteUserAccount);

router.post(
    '/me/avatar', 
    authenticateUser,
    upload.single('avatar'), 
    uploadAvatar
);


// Update profil sendiri (menggunakan req.userId dari token)
router.put(
  '/me',
  authenticateUser,
  updateUserProfile 
);

// Delete akun sendiri
router.delete(
  '/me',
  authenticateUser,
  deleteUserAccount
);


// Rute Khusus Admin (dikelompokkan setelah middleware admin)
router.use(authenticateUser, isAdmin); // Middleware ini berlaku untuk semua route di bawahnya

router.get('/', getUsers); // Admin mendapatkan semua user
router.get('/:id', getUserProfile); // Admin mendapatkan profil user spesifik
router.put('/:id', updateUserProfile); // Admin mengupdate profil user spesifik
router.delete('/:id', deleteUserAccount); // Admin menghapus user spesifik

export default router;
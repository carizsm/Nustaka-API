// src/routes/userRoutes.ts
import { Router } from 'express';
// Impor semua fungsi controller yang dibutuhkan
import {
  getUsers,
  getUserProfile,
  getCurrentUser,
  registerUser,
  updateUserProfile,
  deleteUserAccount,
  login,
  logoutUser
} from '../controllers/userController'; 

// Impor middleware
import { authenticateUser, isAdmin } from '../middlewares/authMiddleware'; 
const router = Router();

// Rute Publik
router.post('/register', registerUser);
router.post('/login', login);

router.post('/logout', authenticateUser, logoutUser); 

// Rute Terproteksi untuk semua user yang terautentikasi
router.get('/me', authenticateUser, getCurrentUser);

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
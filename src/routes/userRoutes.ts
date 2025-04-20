import { Router } from 'express';
import { Response, NextFunction } from 'express';
import { 
  getUsers, 
  getUserProfile, 
  getCurrentUser, 
  registerUser, 
  updateUserProfile, 
  deleteUserAccount,
  AuthRequest, 
  login
} from '../controllers/userController';
import { authenticateUser, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

// TODO error while login/register
// Public routes
router.post('/register', registerUser);
router.post('/login', login)

// Protected routes
router.get('/me', authenticateUser, getCurrentUser);
router.put(
  '/me',
  authenticateUser,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    // Set req.params.id ke userId dari autentikasi
    req.params.id = req.userId as string; // userId dijamin ada setelah authenticateUser
    next();
  },
  updateUserProfile
);

// Admin routes
router.get('/', authenticateUser, isAdmin, getUsers);
router.get('/:id', authenticateUser, isAdmin, getUserProfile);
router.put('/:id', authenticateUser, isAdmin, updateUserProfile);
router.delete('/:id', authenticateUser, isAdmin, deleteUserAccount);

export default router;
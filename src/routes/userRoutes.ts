import { Router } from 'express';
import { Response, NextFunction } from 'express';

import {
  getUsers,
  getUserProfile,
  getCurrentUser,
  registerUser,
  updateUserProfile,
  deleteUserAccount,
  login
} from '../controllers/userController';

import { authenticateUser, isAdmin, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', login);

// Protected routes for any authenticated user
router.get('/me', authenticateUser, getCurrentUser);

// Update own profile
router.put(
  '/me',
  authenticateUser,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    req.params.id = req.userId!;
    next();
  },
  updateUserProfile
);

// Delete own account
router.delete(
  '/me',
  authenticateUser,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    req.params.id = req.userId!;
    next();
  },
  deleteUserAccount
);

// Admin-only routes
router.use(authenticateUser, isAdmin);
router.get('/', getUsers);
router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);
router.delete('/:id', deleteUserAccount);

export default router;
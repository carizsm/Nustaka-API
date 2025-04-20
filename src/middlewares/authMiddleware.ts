import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';
import { getUserById } from '../services/userService';
import { User } from '../interfaces';

// Define AuthRequest interface
export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
  userRole?: string;
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token with Firebase
    const decodedToken = await auth.verifyIdToken(token);
    
    // Set user data in request
    const authReq = req as AuthRequest;
    authReq.userId = decodedToken.uid;
    
    // Optionally fetch full user data
    const user = await getUserById(decodedToken.uid);
    if (user) {
      authReq.user = user;
      authReq.userRole = user.role;
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
};
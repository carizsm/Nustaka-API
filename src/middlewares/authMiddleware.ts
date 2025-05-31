// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// Middleware untuk memverifikasi JWT dan mengekstrak userId + role
export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required: No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentication required: Token is missing after Bearer.' });
  }

  try {
    const jwtSecretToVerify: jwt.Secret = process.env.JWT_SECRET || 'yourDefaultSecureSecretFallback'; // <--- PASTIKAN SAMA
    
    const payload = jwt.verify(
      token,
      jwtSecretToVerify 
    ) as { id: string; role: string; iat: number; exp: number }; // Tambahkan iat dan exp untuk debugging jika perlu

    // Jika Anda ingin memeriksa apakah payload memiliki struktur yang diharapkan
    if (!payload.id || !payload.role) {
        return res.status(401).json({ message: 'Invalid token: Payload structure incorrect.' });
    }

    const authReq = req as AuthRequest;
    authReq.userId = payload.id;
    authReq.userRole = payload.role;
    next();
  } catch (err: any) {
    console.error('Token verification error:', err.name, err.message); // Log error untuk debugging
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Invalid or expired token: Token has expired.' });
    }
    if (err instanceof jwt.JsonWebTokenError) { // Termasuk NotBeforeError, dll.
      return res.status(401).json({ message: 'Invalid or expired token: Token is malformed or invalid.' });
    }
    // Fallback untuk error lain yang tidak terduga
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Middleware untuk membatasi akses hanya untuk admin
export const isAdmin = (
  req: Request, // Seharusnya AuthRequest karena authenticateUser harus dijalankan sebelumnya
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthRequest;
  if (authReq.userRole !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Admin access required.' });
  }
  next();
};

// Middleware untuk membatasi akses hanya untuk seller
export const isSeller = (
  req: Request, // Seharusnya AuthRequest
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthRequest;
  if (authReq.userRole !== 'seller') {
    return res.status(403).json({ message: 'Forbidden: Seller access required.' });
  }
  next();
};
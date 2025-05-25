import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserByEmail
} from '../services/userService';
import { User } from '../interfaces';
import { Timestamp } from 'firebase-admin/firestore';
import { AuthRequest } from '../middlewares/authMiddleware';

// GET  /api/users          — admin only
export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await getAllUsers();
    const safe = users.map(({ password, ...u }) => u);
    res.status(200).json(safe);
  } catch (err) {
    console.error('Error getting users:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET  /api/users/:id
export const getUserProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error('Error getting user:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET  /api/users/me
export const getCurrentUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error('Error getting current user:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email & password required' });
    }
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '1h' }
    );
    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/register
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, username, phone_number, address, role } =
      req.body;
    if (!email || !password || !username) {
      return res
        .status(400)
        .json({ message: 'Email, password & username required' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const now = Timestamp.now();
    const userData: User = {
      username,
      email,
      password: hashed,
      phone_number,
      address,
      role: role || 'buyer',
      status: 'active',
      created_at: now
      // updated_at omitted on register
    };

    const newUser = await createUser(userData);
    const { password: _, ...safe } = newUser;

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'User registered',
      user: safe,
      token
    });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/users/:id
export const updateUserProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const targetId = req.params.id;
    if (req.userId !== targetId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { username, phone_number, address } = req.body;
    const updateData: Partial<User> = {
      username,
      phone_number,
      address,
      updated_at: Timestamp.now()
    };

    const ok = await updateUser(targetId, updateData);
    if (!ok) {
      return res.status(400).json({ message: 'Update failed' });
    }
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/users/:id
export const deleteUserAccount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const targetId = req.params.id;
    if (req.userId !== targetId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const ok = await deleteUser(targetId);
    if (!ok) {
      return res.status(400).json({ message: 'Delete failed' });
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

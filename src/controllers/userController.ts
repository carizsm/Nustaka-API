import { Request, Response } from 'express';
import { auth } from '../config/firebase';
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

// Define custom request interface for authenticated routes
export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
  userRole?: string;
}

// Get all users (Admin only)
export const getUsers = async (req: Request | AuthRequest, res: Response) => {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by ID
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Don't return password in response
    const { password, ...userWithoutPassword } = user;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current user profile
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    // User data is attached to request by auth middleware
    if (!req.user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Don't return password in response
    const { password, ...userWithoutPassword } = req.user;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Buat custom token
    const customToken = await auth.createCustomToken(user.id);
    
    res.status(200).json({
      token: customToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register new user
export const registerUser = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, username, phone_number, address, role } = req.body;
    
    // Check if email already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: username
    });
    
    // Create user in Firestore
    const userData: User = {
      username,
      email,
      password: '', // Don't store actual password in Firestore
      phone_number,
      address,
      role: role || 'buyer', // Default to buyer
      status: 'active',
      created_at: Timestamp.now()
    };
    
    const newUser = await createUser(userData);
    
    // Don't return password in response
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    
    // Ensure user can only update their own profile unless they're admin
    if (req.userId !== userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Cannot update other users' });
    }
    
    const { username, phone_number, address } = req.body;
    
    // Don't allow updating email, password or role here
    const updateData = {
      username,
      phone_number,
      address
    };
    
    const updated = await updateUser(userId, updateData);
    
    if (!updated) {
      return res.status(400).json({ message: 'Failed to update user' });
    }
    
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user (Admin only)
export const deleteUserAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    
    // Delete from Firebase Auth
    await auth.deleteUser(userId);
    
    // Delete from Firestore
    const deleted = await deleteUser(userId);
    
    if (!deleted) {
      return res.status(400).json({ message: 'Failed to delete user' });
    }
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
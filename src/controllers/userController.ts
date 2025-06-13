// src/controllers/userController.ts
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
import { supabase } from '../config/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const AVATAR_BUCKET = 'avatars';

// Helper function untuk konversi string durasi ke detik (jika belum ada dari sebelumnya)
const parseDurationToSeconds = (durationStr: string): number => {
  if (!isNaN(Number(durationStr))) {
    return parseInt(durationStr, 10);
  }
  const unit = durationStr.charAt(durationStr.length - 1).toLowerCase();
  const value = parseInt(durationStr.substring(0, durationStr.length - 1), 10);
  if (isNaN(value)) return 24 * 60 * 60; // Default 1 hari
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 24 * 60 * 60;
  }
};

// --- Fungsi getUsers, getUserProfile, getCurrentUser tetap sama ---
export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await getAllUsers();
    const safeUsers = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
    res.status(200).json(safeUsers);
  } catch (err: any) {
    console.error('Error getting users:', err);
    res.status(500).json({ message: 'Server error while fetching users.', error: err.message });
  }
};

export const getUserProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userIdToFetch = req.params.id;
    const user = await getUserById(userIdToFetch);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err: any) {
    console.error('Error getting user profile:', err);
    res.status(500).json({ message: 'Server error while fetching user profile.', error: err.message });
  }
};

export const getCurrentUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Not authenticated: User ID missing.' });
    }
    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err: any) {
    console.error('Error getting current user:', err);
    res.status(500).json({ message: 'Server error while fetching current user data.', error: err.message });
  }
};


// POST /api/users/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password: plainPassword } = req.body;
    if (!email || !plainPassword) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(plainPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const jwtPayload = { id: user.id, role: user.role };
    const jwtSecret: jwt.Secret = process.env.JWT_SECRET || 'yourDefaultSecureSecretFallback';
    const expiresInDurationString = process.env.JWT_EXPIRES_IN || '1d';
    const expiresInSeconds = parseDurationToSeconds(expiresInDurationString);
    const jwtOptions: jwt.SignOptions = {
      expiresIn: expiresInSeconds,
    };
    const token = jwt.sign(jwtPayload, jwtSecret, jwtOptions);
    const { password, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err: any) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
};

// POST /api/users/register
export const registerUser = async (req: Request, res: Response) => {
  try {
    const {
      email, password: plainPassword, username, phone_number, address, role,
    } = req.body;

    if (!email || !plainPassword || !username) {
      return res.status(400).json({ message: 'Email, password, and username are required.' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use. Please use a different email.' });
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    const newUserInput: Omit<User, 'id' | 'created_at' | 'updated_at' | 'password'> & { password?: string } = {
      username, email, password: hashedPassword, phone_number: phone_number || '',
      address: address || '', role: (role === 'seller' || role === 'admin') ? role : 'buyer',
      status: 'active',
    };

    const createdUser = await createUser(newUserInput as User); // Service akan handle created_at/updated_at
    const { password, ...safeUser } = createdUser;

    const jwtPayload = { id: createdUser.id, role: createdUser.role };
    const jwtSecret: jwt.Secret = process.env.JWT_SECRET || 'yourDefaultSecureSecretFallback';
    const expiresInDurationString = process.env.JWT_EXPIRES_IN || '1d';
    const expiresInSeconds = parseDurationToSeconds(expiresInDurationString);
    const jwtOptions: jwt.SignOptions = {
      expiresIn: expiresInSeconds,
    };
    const token = jwt.sign(jwtPayload, jwtSecret, jwtOptions);

    res.status(201).json({
      message: 'User registered successfully.', user: safeUser, token
    });
  } catch (err: any) {
    console.error('Register Error:', err);
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
};

// --- FUNGSI BARU UNTUK LOGOUT ---
export const logoutUser = async (req: AuthRequest, res: Response) => {
    // Untuk sistem JWT stateless murni, backend tidak perlu melakukan banyak hal.
    // Klien bertanggung jawab untuk menghapus token.
    // Endpoint ini bisa digunakan untuk:
    // 1. Konfirmasi.
    // 2. Jika ada mekanisme server-side (misal, token denylist, refresh token), bisa dihandle di sini.
    //    Untuk saat ini, kita buat sederhana.
    try {
        // Jika Anda ingin mencatat aktivitas logout, bisa dilakukan di sini.
        // Contoh: await userService.logUserActivity(req.userId, 'logout');
        
        // Tidak ada token yang perlu dihapus di sisi server untuk JWT access token biasa.
        // Jika Anda menggunakan refresh token yang disimpan di DB, Anda bisa menghapusnya di sini.

        res.status(200).json({ message: 'Logout successful. Please clear your token on the client-side.' });
    } catch (err: any) {
        console.error('Logout Error:', err);
        res.status(500).json({ message: 'Server error during logout.', error: err.message });
    }
};
// --- AKHIR FUNGSI BARU ---


// PUT /api/users/me (atau /api/users/:id oleh admin)
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const targetId = req.params.id || req.userId; 

    if (!targetId) {
        return res.status(400).json({ message: 'Target user ID is missing.' });
    }
    if (req.userId !== targetId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
    }

    const {
        username,
        phone_number,
        address,
        latitude,
        longitude,
        // --- Ambil field baru dari body ---
        name,
        bio,
        gender,
        birth_date // Asumsi dikirim sebagai string ISO 8601, misal "1998-06-14"
    } = req.body;

    const updateData: Partial<User> = {};

    // Data yang sudah ada
    if (username !== undefined) updateData.username = username;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;

    // --- Tambahkan field baru ke objek update ---
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (gender !== undefined) {
        // Validasi sederhana untuk gender
        const validGenders = ['male', 'female', 'other', 'private'];
        if (validGenders.includes(gender)) {
            updateData.gender = gender;
        } else {
            return res.status(400).json({ message: 'Invalid gender value.' });
        }
    }
    if (birth_date !== undefined) {
        // Konversi string tanggal ke Firestore Timestamp
        const date = new Date(birth_date);
        if (!isNaN(date.getTime())) {
            updateData.birth_date = Timestamp.fromDate(date);
        } else {
            return res.status(400).json({ message: 'Invalid birth_date format. Use YYYY-MM-DD.' });
        }
    }
    // ... (logika untuk latitude/longitude tetap sama)
    if (latitude !== undefined && longitude !== undefined) {
        // ... validasi lat/lon ...
        updateData.latitude = parseFloat(latitude);
        updateData.longitude = parseFloat(longitude);
    }
    
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }
    
    const success = await updateUser(targetId, updateData); // Service akan handle updated_at

    if (!success) {
      return res.status(400).json({ message: 'Update failed. Please check input data or user existence.' });
    }

    const updatedUser = await getUserById(targetId); 
    if (updatedUser) {
        const { password, ...safeUser } = updatedUser;
        return res.json({ message: 'User profile updated successfully.', user: safeUser });
    }
    
    res.json({ message: 'User profile updated successfully' });

  } catch (err: any) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ message: 'Server error while updating profile.', error: err.message });
  }
};

// DELETE /api/users/:id
export const deleteUserAccount = async ( req: AuthRequest, res: Response ) => {
  try {
    const targetId = req.params.id || req.userId;
    if (!targetId) {
        return res.status(400).json({ message: 'Target user ID is missing.' });
    }
    if (req.userId !== targetId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You can only delete your own account.' });
    }
    const success = await deleteUser(targetId);
    if (!success) {
      const userExists = await getUserById(targetId);
      if (!userExists) {
          return res.status(404).json({ message: 'User not found, delete failed.' });
      }
      return res.status(400).json({ message: 'Delete operation failed.' });
    }
    res.json({ message: 'User account deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting user account:', err);
    res.status(500).json({ message: 'Server error while deleting account.', error: err.message });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided.' });
        }

        const file = req.file;
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${userId}-${uuidv4()}.${fileExtension}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(filePath, file.buffer, { contentType: file.mimetype });

        if (uploadError) {
            throw new Error(`Failed to upload avatar: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(filePath);
        
        if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Failed to get public URL for avatar.');
        }

        const avatarUrl = publicUrlData.publicUrl;

        // Update field profile_picture_url di dokumen user
        await updateUser(userId, { profile_picture_url: avatarUrl });

        res.status(200).json({ 
            message: 'Avatar uploaded successfully.',
            avatarUrl: avatarUrl 
        });

    } catch (error: any) {
        console.error('Controller Error - uploadAvatar:', error);
        res.status(500).json({ message: error.message || 'Failed to upload avatar.' });
    }
};
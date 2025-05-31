// src/controllers/reviewController.ts
import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as svc from '../services/reviewService';
import { supabase } from '../config/supabaseClient'; // Impor Supabase client
import { v4 as uuidv4 } from 'uuid'; // Untuk nama file unik

const REVIEW_IMAGES_BUCKET = 'review-images'; // Nama bucket Anda di Supabase

// GET /api/reviews/product/:productId
export const getReviewsByProduct = async (
  req: AuthRequest, // Bisa Request biasa jika tidak perlu auth
  res: Response
) => {
  try {
    const productId = req.params.productId;
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required.' });
    }
    const reviews = await svc.listReviews(productId);
    res.json(reviews);
  } catch (error: any) {
    console.error('Controller Error - getReviewsByProduct:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch reviews.' });
  }
};

// POST /api/reviews (Sekarang dengan image upload)
export const createReview = async (
  req: AuthRequest, // Membutuhkan auth untuk mengetahui buyerId
  res: Response
) => {
  try {
    const buyerId = req.userId;
    if (!buyerId) {
      return res.status(401).json({ message: 'Authentication required to create a review.' });
    }

    const { product_id, rating, comment } = req.body;

    // Validasi input dasar
    if (!product_id || rating === undefined || !comment) {
      return res.status(400).json({ message: 'Product ID, rating, and comment are required.' });
    }
    const numRating = parseFloat(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5.' });
    }

    let imageUrl: string | undefined = undefined;

    // Cek apakah ada file yang diunggah (req.file akan diisi oleh multer)
    if (req.file) {
      const file = req.file;
      // Buat nama file yang unik untuk menghindari konflik
      const fileName = `${uuidv4()}-${file.originalname.replace(/\s+/g, '_')}`;
      const filePath = `public/${fileName}`; // Path di dalam bucket Supabase

      // Unggah file ke Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(REVIEW_IMAGES_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          // cacheControl: '3600', // Opsional
          // upsert: false, // Jangan timpa jika sudah ada dengan nama yang sama (seharusnya tidak terjadi dengan uuid)
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error(`Failed to upload review image: ${uploadError.message}`);
      }

      // Dapatkan URL publik dari file yang diunggah
      const { data: publicUrlData } = supabase.storage
        .from(REVIEW_IMAGES_BUCKET)
        .getPublicUrl(filePath);
      
      if (!publicUrlData || !publicUrlData.publicUrl) {
          // Jika publicUrl tidak langsung tersedia (misal karena RLS yang ketat atau konfigurasi lain)
          // Anda mungkin perlu menyimpan path (uploadData.path) dan membentuk URL secara manual atau
          // memastikan bucket Anda tersetting public read.
          // Untuk Supabase v2, publicUrl ada di data.publicUrl
          console.error('Failed to get public URL for uploaded image:', filePath, publicUrlData);
          throw new Error('Failed to get public URL for review image.');
      }
      imageUrl = publicUrlData.publicUrl;
      console.log('Image uploaded to Supabase, URL:', imageUrl);
    }

    const newReview = await svc.createReview(
      product_id,
      buyerId,
      numRating,
      comment,
      imageUrl // Teruskan URL gambar ke service
    );
    res.status(201).json(newReview);
  } catch (error: any) {
    console.error('Controller Error - createReview:', error);
    // Periksa jenis error spesifik dari service atau Supabase jika perlu
    res.status(500).json({ message: error.message || 'Failed to create review.' });
  }
};
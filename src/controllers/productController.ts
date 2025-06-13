import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as productService from '../services/productService';
import { supabase } from '../config/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const PRODUCT_IMAGES_BUCKET = 'product-images'; // <-- Ganti dengan nama bucket Anda untuk gambar produk

// Helper validasi sederhana (bisa diperluas atau diganti dengan library)
const isNonEmptyString = (value: any): value is string => typeof value === 'string' && value.trim() !== '';
const isNumberInRange = (value: any, min: number = 0, max: number = Infinity): value is number => typeof value === 'number' && value >= min && value <= max;
const isIntegerInRange = (value: any, min: number = 0, max: number = Infinity): value is number => Number.isInteger(value) && value >= min && value <= max;
const isStringArray = (value: any): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const isValidStatus = (value: any): value is 'available' | 'unavailable' => value === 'available' || value === 'unavailable';

// GET /api/products
export const getProducts = async (req: Request, res: Response) => {
    const { page, limit, category_id, region_id, status } = req.query;
    const filters: productService.ProductListFilters = {}; // Menggunakan tipe filter dari service
    if (isNonEmptyString(category_id)) filters.categoryId = category_id;
    if (isNonEmptyString(region_id)) filters.regionId = region_id;
    if (isNonEmptyString(status)) filters.status = status;

    try {
        const data = await productService.listProducts(Number(page) || 1, Number(limit) || 10, filters);
        res.json(data);
    } catch (error: any) {
        console.error('Controller Error - getProducts:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch products.' });
    }
};

// GET /api/products/my
export const getMyProducts = async (req: AuthRequest, res: Response) => {
    const sellerId = req.userId;
    if (!sellerId) return res.status(401).json({ message: 'Authentication error: Seller ID not found.' });

    const { page, limit, category_id, region_id, status } = req.query;
    const filters: productService.ProductListFilters = { sellerId };
    if (isNonEmptyString(category_id)) filters.categoryId = category_id;
    if (isNonEmptyString(region_id)) filters.regionId = region_id;
    if (isNonEmptyString(status)) filters.status = status;

    try {
        const data = await productService.listProducts(Number(page) || 1, Number(limit) || 10, filters);
        res.json(data);
    } catch (error: any) {
        console.error('Controller Error - getMyProducts:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch your products.' });
    }
};

// GET /api/products/:id
export const getProductById = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isNonEmptyString(id)) return res.status(400).json({ message: 'Product ID is required.' });
    try {
        const product = await productService.getProduct(id);
        if (!product) return res.status(404).json({ message: 'Product not found.' });
        res.json(product);
    } catch (error: any) {
        console.error(`Controller Error - getProductById for ${id}:`, error);
        res.status(500).json({ message: error.message || 'Failed to fetch product details.' });
    }
};

// GET /api/products/search
export const searchProducts = async (req: Request, res: Response) => {
    const { query, limit } = req.query;
    if (!isNonEmptyString(query)) return res.status(400).json({ message: 'Search query parameter is required.' });
    try {
        const products = await productService.searchProducts(query, Number(limit) || 15);
        res.json(products);
    } catch (error: any) {
        console.error('Controller Error - searchProducts:', error);
        res.status(500).json({ message: error.message || 'Failed during product search.' });
    }
};

// POST /api/products
export const createProduct = async (req: AuthRequest, res: Response) => {
    try {
        const sellerId = req.userId!;
        // Sekarang req.body akan terisi berkat multer
        const {
            name, description, price, stock, category_id, region_id, briefHistory,
            status, cultural_value
        } = req.body;

        // Validasi input dasar
        if (!name || !description || price === undefined || stock === undefined || !category_id || !region_id || !briefHistory) {
            return res.status(400).json({ message: 'Missing required text fields.' });
        }

        let imageUrls: string[] = []; // Default ke array kosong

        // Cek apakah ada file yang diunggah
        if (req.file) {
            const file = req.file;
            const fileName = `${uuidv4()}-${file.originalname.replace(/\s+/g, '_')}`;
            const filePath = `public/${fileName}`;

            // Unggah file ke Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(PRODUCT_IMAGES_BUCKET)
                .upload(filePath, file.buffer, { contentType: file.mimetype });

            if (uploadError) {
                throw new Error(`Failed to upload product image: ${uploadError.message}`);
            }

            // Dapatkan URL publik dari file yang diunggah
            const { data: publicUrlData } = supabase.storage
                .from(PRODUCT_IMAGES_BUCKET)
                .getPublicUrl(filePath);

            if (!publicUrlData || !publicUrlData.publicUrl) {
                throw new Error('Failed to get public URL for product image.');
            }
            
            // Masukkan URL ke dalam array imageUrls
            imageUrls.push(publicUrlData.publicUrl);
        }
        
        // Buat objek produk untuk dikirim ke service
        const productInput: productService.ProductServiceCreationInput = {
            seller_id: sellerId,
            name,
            description,
            price: Number(price), // Konversi ke Angka, karena form-data mengirim semua sebagai string
            stock: parseInt(stock, 10), // Konversi ke Angka (Integer)
            category_id,
            region_id,
            images: imageUrls, // Gunakan array yang berisi URL dari Supabase
            briefHistory,
            status: status || 'available',
        };

        const historyInput: productService.ProductHistoryServiceCreationInput = {
            title: `${name} History (Creation)`,
            description: briefHistory,
            cultural_value: cultural_value || '',
        };

        const newProduct = await productService.createProduct(productInput, historyInput);
        res.status(201).json(newProduct);

    } catch (error: any) {
        console.error('Controller Error - createProduct:', error);
        res.status(500).json({ message: error.message || 'Failed to create product.' });
    }
};

// PUT /api/products/:id
export const updateProduct = async (req: AuthRequest, res: Response) => {
    const sellerId = req.userId!;
    const { id: productId } = req.params;
    if (!isNonEmptyString(productId)) return res.status(400).json({ message: 'Product ID is required.' });

    const { name, description, price, stock, category_id, region_id, images, briefHistory, status, cultural_value } = req.body;

    try {
        const existingProduct = await productService.getProduct(productId); // Cek keberadaan & kepemilikan
        if (!existingProduct) return res.status(404).json({ message: 'Product not found.' });
        if (existingProduct.seller_id !== sellerId) {
            return res.status(403).json({ message: 'Forbidden: You do not own this product.' });
        }

        const productUpdate: productService.ProductServiceUpdateInput = {};
        if (name !== undefined) { if (!isNonEmptyString(name)) return res.status(400).json({ message: 'Invalid product name.' }); productUpdate.name = name; }
        if (description !== undefined) { if (!isNonEmptyString(description)) return res.status(400).json({ message: 'Invalid product description.' }); productUpdate.description = description; }
        if (price !== undefined) { if (!isNumberInRange(price)) return res.status(400).json({ message: 'Invalid price.' }); productUpdate.price = price; }
        if (stock !== undefined) { if (!isIntegerInRange(stock)) return res.status(400).json({ message: 'Invalid stock.' }); productUpdate.stock = stock; }
        if (category_id !== undefined) { if (!isNonEmptyString(category_id)) return res.status(400).json({ message: 'Invalid category ID.' }); productUpdate.category_id = category_id; }
        if (region_id !== undefined) { if (!isNonEmptyString(region_id)) return res.status(400).json({ message: 'Invalid region ID.' }); productUpdate.region_id = region_id; }
        if (images !== undefined) { if (!isStringArray(images)) return res.status(400).json({ message: 'Invalid images format.' }); productUpdate.images = images; }
        if (briefHistory !== undefined) { if (!isNonEmptyString(briefHistory)) return res.status(400).json({ message: 'Invalid brief history.' }); productUpdate.briefHistory = briefHistory; }
        if (status !== undefined) { if (!isValidStatus(status)) return res.status(400).json({ message: "Invalid status value. Must be 'available' or 'unavailable'."}); productUpdate.status = status; }

        let historyUpdate: productService.ProductHistoryServiceUpdateInput | undefined = undefined;
        if (briefHistory !== undefined || (cultural_value !== undefined && isNonEmptyString(cultural_value))) {
            historyUpdate = {};
            if (isNonEmptyString(briefHistory)) historyUpdate.description = briefHistory;
            if (isNonEmptyString(cultural_value)) historyUpdate.cultural_value = cultural_value;
            historyUpdate.title = `${productUpdate.name || existingProduct.name} History (Update)`;
        }

        if (Object.keys(productUpdate).length === 0 && (!historyUpdate || Object.keys(historyUpdate).length === 0)) {
            return res.status(200).json({ message: 'No data provided for update. Product remains unchanged.', product: existingProduct });
        }
        
        await productService.updateProduct(productId, productUpdate, historyUpdate);
        const updatedProduct = await productService.getProduct(productId);
        res.json({ message: 'Product updated successfully.', product: updatedProduct });

    } catch (error: any) {
        console.error(`Controller Error - updateProduct for ${productId}:`, error);
        if (error.message === "Product not found.") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || 'Failed to update product.' });
    }
};

// DELETE /api/products/:id
export const deleteProduct = async (req: AuthRequest, res: Response) => {
    const sellerId = req.userId!;
    const { id: productId } = req.params;
    if (!isNonEmptyString(productId)) return res.status(400).json({ message: 'Product ID is required.' });

    try {
        const existingProduct = await productService.getProduct(productId); // Cek keberadaan & kepemilikan
        if (!existingProduct) return res.status(404).json({ message: 'Product not found.' });
        if (existingProduct.seller_id !== sellerId) {
            return res.status(403).json({ message: 'Forbidden: You do not own this product.' });
        }
        await productService.deleteProduct(productId);
        res.json({ message: 'Product deleted successfully.' });
    } catch (error: any) {
        console.error(`Controller Error - deleteProduct for ${productId}:`, error);
         if (error.message === "Product not found.") {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || 'Failed to delete product.' });
    }
};
import { Timestamp } from "firebase-admin/firestore";

// User interfaces
export interface User {
  username: string;
  email: string;
  password: string;
  phone_number: string;
  address: string;
  role: 'buyer' | 'seller' | 'admin';
  status: 'active' | 'inactive' | 'banned';
  latitude?: number;
  longitude?: number;
  created_at: Timestamp;
  updated_at?: Timestamp;
}

export interface UserWithId extends User {
  id: string;
}

// Seller profile extension
export interface SellerProfile {
  store_name: string;
  store_description: string;
  bank_account: string;
  verification_status: 'unverified' | 'pending' | 'verified';
  rating_average: number;
  products_count: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface SellerWithId extends SellerProfile {
  id: string;
  user_id: string;
}

// Category interface
export interface Category {
  name: string;
  description: string;
}

export interface CategoryWithId extends Category {
  id: string;
}

// Region interface
export interface Region {
  name: string;
  province: string;
  description: string;
}

export interface RegionWithId extends Region {
  id: string;
}

// Product interfaces
export interface ProductHistory {
  title: string;
  description: string;
  cultural_value: string;
}

export interface ProductHistoryWithId extends ProductHistory {
  id: string;
  product_id: string;
}

export interface Product {
  seller_id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: string;
  region_id: string;
  images: string[];
  briefHistory: string;        // ringkasan sejarah produk
  status: 'available' | 'unavailable';
  created_at: Timestamp;
  updated_at?: Timestamp;
}

export interface ProductWithId extends Product {
  id: string;
}

// Cart interfaces
export interface CartItem {
  product_id: string;
  quantity: number;
  price_per_item: number;
  added_at: Timestamp;
}

export interface CartItemWithId extends CartItem {
  id: string;
  cart_id: string;
}

export interface Cart {
  buyer_id: string;
  created_at: Timestamp;
}

export interface CartWithId extends Cart {
  id: string;
  items?: CartItemWithId[];
}

// Order interfaces
export interface OrderItem {
  product_id: string;
  quantity: number;
  price_per_item: number;
}

export interface OrderItemWithId extends OrderItem {
  id: string;
  order_id: string;
}

export interface Order {
  buyer_id: string;
  total_amount: number;
  shipping_address: string;
  order_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: Timestamp;
  updated_at?: Timestamp;
}

export interface OrderWithId extends Order {
  id: string;
  items?: OrderItemWithId[];
}

// Review interface 
export interface Review {
  product_id: string;
  buyer_id: string;
  rating: number;
  comment: string;// --- TAMBAHKAN FIELD INI ---
  image_url?: string; // Opsional, URL gambar review dari Supabase
  created_at: Timestamp;
  // updated_at?: Timestamp; // Jika review bisa diupdate
}

export interface ReviewWithId extends Review {
  id: string;
}

// For pagination and query results
export interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
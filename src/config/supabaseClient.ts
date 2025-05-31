// src/config/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config(); // Pastikan dotenv sudah di-load di app.ts utama Anda juga

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase URL or Service Key is missing in environment variables.");
  // Anda bisa throw error di sini agar aplikasi tidak berjalan tanpa konfigurasi Supabase
  // throw new Error("Supabase URL or Service Key is missing.");
}

// Gunakan "!" (non-null assertion operator) jika Anda sudah memastikan variabel ada via check di atas atau dotenv
export const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

console.log("Supabase client initialized (check for errors above if any).");
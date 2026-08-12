/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// In log kiểm tra trong Terminal khi chạy server
if (!supabaseUrl || supabaseUrl.includes('xxx')) {
  console.error('⚠️ LỖI: NEXT_PUBLIC_SUPABASE_URL chưa được cấu hình đúng trong .env.local!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSupabaseAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) {
    console.error('⚠️ LỖI: Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env.local!');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};
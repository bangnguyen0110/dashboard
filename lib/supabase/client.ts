/// <reference types="node" />
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const createClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Error: Supabase credentials missing');
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
};
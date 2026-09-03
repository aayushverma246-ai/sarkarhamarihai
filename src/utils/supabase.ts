import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzQ4MjcsImV4cCI6MjA5MDcxMDgyN30.oFgPUbJkxavLy18g4ZFCNhLOHZZyQN_lIA_KBgce7k8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

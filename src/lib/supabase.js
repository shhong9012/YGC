import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://szsekyufyggbownbyewo.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6c2VreXVmeWdnYm93bmJ5ZXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODUyMjUsImV4cCI6MjA4NzM2MTIyNX0.GHW02DXOV7yf7EH6k3ZSECsQuhzou21UtqfZ4XIvE7I";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

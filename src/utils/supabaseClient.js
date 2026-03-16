import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please check your .env file.",
  );
}

// Create a singleton supabase client to avoid multiple instances
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

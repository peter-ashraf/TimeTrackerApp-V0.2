import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Please check your .env file.",
  );
}

// Create a singleton supabase client to avoid multiple instances
// Configure auth options to prevent Navigator LockManager timeout issues
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Disable lock to prevent Navigator LockManager timeout issues
    lock: null,
    // Increase timeout for session operations
    storage: window.localStorage,
  },
  global: {
    headers: {
      'X-Client-Info': 'timetracker-app'
    }
  }
});

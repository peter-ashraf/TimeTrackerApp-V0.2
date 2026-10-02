import { createClient } from "@supabase/supabase-js";
import {
  isLocalDevMode,
  createLocalDevClient,
  installLocalDevFetchGuard,
} from "./localDevBackend";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function buildClient() {
  // `npm run dev:local`: use the in-browser fake backend and block any
  // request aimed at real Supabase. isLocalDevMode is false in production
  // builds, so this branch (and the fake backend) is dropped from them.
  if (isLocalDevMode) {
    console.info(
      "[LocalDev] Running against the local dev backend. Supabase is NOT used.",
    );
    installLocalDevFetchGuard();
    return createLocalDevClient();
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase configuration. Please check your .env file.",
    );
  }

  // Create a singleton supabase client to avoid multiple instances
  // Configure auth options to prevent Navigator LockManager timeout issues
  return createClient(supabaseUrl, supabaseAnonKey, {
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
}

export const supabaseClient = buildClient();

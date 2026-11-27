import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readSupabaseConfig, type SupabaseConfigResult } from './config';
import type { Database } from './database.types';
import { supabaseStorage } from './storage';

let cachedClient: SupabaseClient<Database> | null = null;
let cachedConfigKey: string | null = null;

export function getSupabaseConfigStatus(): SupabaseConfigResult {
  return readSupabaseConfig();
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig().isConfigured;
}

/**
 * Returns a lazily initialized Supabase client when public environment variables
 * are validly configured, or null during offline/unconfigured local development.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  const config = readSupabaseConfig();
  if (!config.isConfigured) {
    return null;
  }

  const configKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  cachedClient = createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  cachedConfigKey = configKey;

  return cachedClient;
}

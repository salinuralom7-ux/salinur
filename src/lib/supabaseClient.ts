import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The store owner connects their Supabase project once from Admin → Settings
// (no rebuild needed). Env vars take priority for hosted deployments.
// The anon key is a publishable key by design; all protection lives in
// Supabase row-level-security policies (see supabase/migrations).

const LS_URL = 'bps_supabase_url';
const LS_KEY = 'bps_supabase_anon_key';

let client: SupabaseClient | null = null;
let clientFor = '';

export function getSupabaseConfig(): { url: string; key: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (envUrl && envKey) return { url: envUrl, key: envKey };
  return {
    url: localStorage.getItem(LS_URL) ?? '',
    key: localStorage.getItem(LS_KEY) ?? '',
  };
}

export function saveSupabaseConfig(url: string, key: string): void {
  localStorage.setItem(LS_URL, url.trim());
  localStorage.setItem(LS_KEY, key.trim());
  client = null;
  clientFor = '';
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
  client = null;
  clientFor = '';
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return url.startsWith('https://') && key.length > 20;
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const { url, key } = getSupabaseConfig();
  if (!client || clientFor !== url) {
    client = createClient(url, key);
    clientFor = url;
  }
  return client;
}

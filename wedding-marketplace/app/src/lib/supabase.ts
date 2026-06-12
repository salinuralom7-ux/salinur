import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Owner connects the Supabase project once from Admin -> Settings (no rebuild).
// The anon key is publishable by design; protection lives in RLS policies.

const LS_URL = 'ss_supabase_url';
const LS_KEY = 'ss_supabase_key';

let client: SupabaseClient | null = null;
let clientFor = '';

export function getConfig(): { url: string; key: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (envUrl && envKey) return { url: envUrl, key: envKey };
  return { url: localStorage.getItem(LS_URL) ?? '', key: localStorage.getItem(LS_KEY) ?? '' };
}

export function saveConfig(url: string, key: string): void {
  localStorage.setItem(LS_URL, url.trim());
  localStorage.setItem(LS_KEY, key.trim());
  client = null;
  clientFor = '';
}

export function clearConfig(): void {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
  client = null;
  clientFor = '';
}

export function isConfigured(): boolean {
  const { url, key } = getConfig();
  return url.startsWith('https://') && key.length > 20;
}

export function getSupabase(): SupabaseClient | null {
  if (!isConfigured()) return null;
  const { url, key } = getConfig();
  if (!client || clientFor !== url) {
    client = createClient(url, key);
    clientFor = url;
  }
  return client;
}

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Anonymous, cookie-free client for public data (landing counters, public
 * profiles, search). Because it never touches cookies, pages using it can
 * stay statically cached and refresh on a timer.
 */
export function createPublicClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Supabase connection settings, read once from environment variables.
 * Supabase now calls the browser-safe key the "publishable" key; older
 * projects call it the "anon" key. Either works.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until the keys are in .env.local (or Vercel). Pages show designed fallbacks instead of crashing. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/** Phone OTP needs a DLT-registered SMS sender in India, so it stays off until that's done. */
export const isPhoneLoginEnabled = process.env.NEXT_PUBLIC_PHONE_LOGIN === "true";

/** Public URL of a file in the `avatars` bucket. */
export function avatarUrl(path: string | null): string | null {
  if (!path || !supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}

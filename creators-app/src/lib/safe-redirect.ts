/**
 * Only allow redirects to paths on this site. Stops a crafted link like
 * /login?next=https://evil.example from bouncing people off-site after login.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

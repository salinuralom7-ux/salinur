/**
 * Digital Asset Links: proves to Android that the InfluJi app and this website
 * belong together, so the app opens full-screen with no browser address bar.
 *
 * Set in Vercel (Settings → Environment Variables):
 *   ANDROID_PACKAGE_ID              e.g. in.influji.app
 *   ANDROID_SHA256_FINGERPRINTS     comma-separated; BOTH the Play "App signing key"
 *                                   and the "Upload key" from Play Console → App integrity
 * Change them and redeploy (or restart); no code change needed.
 */
// Read at request time so new fingerprints work without a rebuild.
export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_ID ?? "in.influji.app";
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);

  const body = fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints } }]
    : [];

  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}

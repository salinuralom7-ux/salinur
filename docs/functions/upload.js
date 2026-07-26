/**
 * Cloudflare Pages Function — POST /upload
 *
 * Accepts a profile photo and stores it in R2. R2 charges nothing for egress,
 * ever, which is the whole reason for using it: at 1,000 registrations a day
 * the photos are ~17 GB/month of downloads, and that alone would force a paid
 * Supabase plan. On R2 it is free.
 *
 * Bind an R2 bucket named PHOTOS to this Pages project, and set PHOTO_BASE to
 * the bucket's public URL (a custom domain such as https://img.nearse.in).
 */

const MAX_BYTES = 400 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}

export async function onRequestPost({ request, env }) {
  const fail = (status, msg) =>
    new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (!env.PHOTOS) return fail(500, "Photo storage is not configured");

  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!ALLOWED.has(type)) return fail(415, "Only JPEG, PNG or WebP images are accepted");

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) return fail(413, "That photo is too large");

  const body = await request.arrayBuffer();
  if (!body.byteLength) return fail(400, "Empty upload");
  if (body.byteLength > MAX_BYTES) return fail(413, "That photo is too large");

  // Trust the bytes, not the header: check the file really is an image.
  const b = new Uint8Array(body);
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                 b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (!(isJpeg || isPng || isWebp)) return fail(415, "That file is not an image");

  // The name is ours to choose, so a caller cannot overwrite someone else's
  // photo or escape the prefix.
  const key = `p/${crypto.randomUUID()}.${EXT[type]}`;
  await env.PHOTOS.put(key, body, {
    httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
  });

  const base = (env.PHOTO_BASE || "").replace(/\/+$/, "");
  return new Response(JSON.stringify({ url: `${base}/${key}`, key }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Permanently deletes the logged-in user's account.
 * Removing the auth user cascades to their profile, creator listing, booking
 * requests, shortlists and reports (see the migration). Payment records are
 * kept, unlinked, because tax law requires them.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Account deletion isn't set up yet. Please email us and we'll do it for you." }, { status: 503 });
  }

  // TODO(payments): cancel any active Razorpay subscription before deleting.

  // Remove profile photos (they live in a folder named after the user id).
  const { data: files } = await admin.storage.from("avatars").list(user.id);
  if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account deletion failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again or email us." }, { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

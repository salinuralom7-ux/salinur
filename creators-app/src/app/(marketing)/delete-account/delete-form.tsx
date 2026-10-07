"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Typing DELETE is the confirmation step (browser confirm() dialogs are easy to tap through by accident). */
export function DeleteAccountForm({ email }: { email: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = typed.trim().toUpperCase() === "DELETE";

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    const res = await fetch("/account/delete", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return toast.error(body.error ?? "Something went wrong. Please try again.");
    }
    toast.success("Your account has been deleted.");
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onDelete} className="glass mt-6 rounded-[var(--radius-card)] p-6 text-fg">
      <p className="text-sm">
        Logged in as <b className="break-all">{email}</b>
      </p>
      <label htmlFor="confirm-delete" className="mt-4 block text-sm text-muted">
        Type <b className="text-fg">DELETE</b> to confirm
      </label>
      <input
        id="confirm-delete"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className="glass mt-2 h-12 w-full rounded-2xl px-4 text-base outline-none focus:glow"
      />
      <Button type="submit" size="lg" disabled={!ready || busy} className="mt-4 w-full !bg-pink !text-white">
        {busy ? "Deleting…" : "Permanently delete my account"}
      </Button>
    </form>
  );
}

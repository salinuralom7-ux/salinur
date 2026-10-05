"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GoogleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Method = "email" | "phone";
type Step = "enter" | "code";

const RESEND_SECONDS = 30;

/** Supabase errors, rewritten as something a person can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("expired") || m.includes("invalid") || m.includes("token"))
    return "That code didn't work. Check it, or send a new one.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "This login option isn't switched on yet.";
  return "Something went wrong. Please try again.";
}

export function LoginForm({ next, phoneEnabled }: { next: string; phoneEnabled: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("email");
  const [step, setStep] = useState<Step>("enter");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const target = method === "email" ? email.trim().toLowerCase() : `+91${phone}`;
  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    if (error) {
      toast.error(friendly(error.message));
      setBusy(false);
    }
    // On success the browser leaves for Google, so there's nothing else to do.
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (method === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return toast.error("Enter a valid email address.");
    if (method === "phone" && !/^[6-9]\d{9}$/.test(phone)) return toast.error("Enter your 10-digit mobile number.");

    setBusy(true);
    const supabase = createClient();
    const { error } =
      method === "email"
        ? await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true, emailRedirectTo: callbackUrl() } })
        : await supabase.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return toast.error(friendly(error.message));

    setStep("code");
    setCode("");
    setResendIn(RESEND_SECONDS);
    toast.success("Code sent", { description: method === "email" ? `Check ${target} (and spam).` : `Sent by SMS to ${target}.` });
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6,10}$/.test(code)) return toast.error("Enter the code from your " + (method === "email" ? "email." : "SMS."));
    setBusy(true);
    const supabase = createClient();
    const { error } =
      method === "email"
        ? await supabase.auth.verifyOtp({ email: target, token: code, type: "email" })
        : await supabase.auth.verifyOtp({ phone: target, token: code, type: "sms" });
    if (error) {
      setBusy(false);
      return toast.error(friendly(error.message));
    }
    toast.success("You're in 🎉");
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="glass w-full max-w-sm rounded-[var(--radius-xl3)] p-6 sm:p-8">
      <AnimatePresence mode="wait" initial={false}>
        {step === "enter" ? (
          <motion.div key="enter" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            <Button variant="glass" size="lg" className="w-full !bg-surface-strong" onClick={google} disabled={busy}>
              <GoogleIcon className="size-5" /> Continue with Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            {phoneEnabled && (
              <div role="tablist" aria-label="Log in with" className="mb-3 grid grid-cols-2 rounded-full bg-surface-strong p-1 text-sm font-semibold">
                {(["email", "phone"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={method === m}
                    onClick={() => setMethod(m)}
                    className={cn("relative rounded-full py-2 transition-colors", method === m ? "text-bg" : "text-muted")}
                  >
                    {method === m && <motion.span layoutId="login-pill" className="absolute inset-0 rounded-full bg-fg" />}
                    <span className="relative">{m === "email" ? "Email" : "Phone"}</span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={sendCode} className="space-y-3">
              {method === "email" ? (
                <label className="glass flex h-14 items-center gap-3 rounded-2xl px-4 focus-within:glow">
                  <Mail className="size-5 shrink-0 text-muted" />
                  <input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-full w-full bg-transparent text-base outline-none placeholder:text-muted"
                    aria-label="Email address"
                  />
                </label>
              ) : (
                <label className="glass flex h-14 items-center gap-3 rounded-2xl px-4 focus-within:glow">
                  <Phone className="size-5 shrink-0 text-muted" />
                  <span className="text-muted">+91</span>
                  <input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-full w-full bg-transparent text-base tracking-wide outline-none placeholder:text-muted"
                    aria-label="Mobile number"
                  />
                </label>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send me a code"}
              </Button>
            </form>
          </motion.div>
        ) : (
          <motion.div key="code" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }}>
            <button onClick={() => setStep("enter")} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
              <ArrowLeft className="size-4" /> Change {method === "email" ? "email" : "number"}
            </button>
            <p className="text-sm text-muted">
              Enter the code we sent to <b className="break-all text-fg">{target}</b>
            </p>
            <form onSubmit={verify} className="mt-4 space-y-3">
              <input
                id="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="glass h-16 w-full rounded-2xl text-center font-display-tight text-3xl tracking-[0.4em] outline-none placeholder:text-muted focus:glow"
                aria-label="Login code"
              />
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Checking…" : "Log in"}
              </Button>
            </form>
            <button
              onClick={() => sendCode()}
              disabled={resendIn > 0 || busy}
              className="mt-4 w-full text-center text-sm text-muted enabled:hover:text-fg disabled:opacity-60"
            >
              {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

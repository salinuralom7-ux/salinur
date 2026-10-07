import { site } from "@/config/site";

/** Shared shell for Terms, Privacy, Refunds, Contact and Delete Account. */
export function LegalPage({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Last updated {site.legal.lastUpdated}</p>
      <h1 className="mt-3 font-display-tight text-4xl font-bold [text-wrap:balance] sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 text-[15px] leading-relaxed text-muted">{intro}</p>}
      <div className="legal mt-8">{children}</div>
    </article>
  );
}

/** The support email as a link, or a visible warning while it isn't configured yet. */
export function SupportEmail() {
  const email = site.legal.supportEmail;
  if (!email) {
    return (
      <span className="rounded-md bg-pink/15 px-1.5 py-0.5 font-semibold text-pink" title="Set NEXT_PUBLIC_SUPPORT_EMAIL">
        [support email not set yet]
      </span>
    );
  }
  return (
    <a href={`mailto:${email}`} className="font-semibold text-fg underline underline-offset-2">
      {email}
    </a>
  );
}

/** "Salinur Alom (sole proprietor), Bongaigaon, Assam, India" */
export function Operator() {
  const l = site.legal;
  return (
    <>
      {l.operator} ({l.operatorType}), {l.location}
    </>
  );
}

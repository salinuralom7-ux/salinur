import Link from "next/link";
import { site } from "@/config/site";
import { Logo } from "@/components/logo";

const columns = [
  {
    title: "Businesses",
    links: [
      { href: "/search", label: "Find creators" },
      { href: "/#cities", label: "Browse by city" },
      { href: "/#niches", label: "Browse by niche" },
    ],
  },
  {
    title: "Creators",
    links: [
      { href: "/join", label: "Get listed" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refund-policy", label: "Refund & Cancellation" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border px-4 pb-8 pt-10 sm:mt-16 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{site.shortTagline}</p>
          <p className="mt-4 max-w-xs text-xs text-muted">
            {site.name} only connects businesses and creators. Deals and payments between them are their own
            responsibility.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold">{col.title}</h4>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted transition-colors hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl border-t border-border pt-6 flex-col justify-between gap-2 text-xs text-muted sm:flex-row">
        <p>
          © {new Date().getFullYear()} {site.name}. Made in India 🇮🇳
        </p>
        <p>No commission. No booking fees. Ever.</p>
      </div>
    </footer>
  );
}

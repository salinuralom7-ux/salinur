import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div>
          <p className="font-display-tight text-[120px] font-bold text-brand sm:text-[180px]">404</p>
          <h1 className="font-display-tight text-3xl font-bold sm:text-4xl">This page ghosted you. 👻</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted">
            It doesn&apos;t exist, or we&apos;re still building it. Let&apos;s get you back somewhere useful.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/">Back home</ButtonLink>
            <ButtonLink href="/search" variant="glass">
              Find creators
            </ButtonLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

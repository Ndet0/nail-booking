import { ApiStatus } from "@/components/ApiStatus";
import { ServiceList } from "@/features/services/ServiceList";

const INSTAGRAM_URL = "https://www.instagram.com/nailsbychao_/";

export function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-16 pt-10 sm:px-6">
      <header className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto grid size-20 place-items-center rounded-full border border-accent/60 bg-surface font-display text-2xl font-bold text-accent"
        >
          C
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          NAILS<span className="text-accent">BY</span>CHAO
        </h1>
        <p className="mt-2 text-muted">Nail tech &amp; MUA · Home studio &amp; house calls 🇰🇪</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="#services"
            className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground hover:opacity-90"
          >
            Book an appointment
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-6 py-3 font-semibold hover:border-accent"
          >
            Instagram
          </a>
        </div>
      </header>

      <main id="services" className="mt-12 scroll-mt-8">
        <h2 className="mb-6 text-2xl font-semibold">Services</h2>
        <ServiceList />
        <p className="mt-6 text-xs text-muted">
          Online booking is coming soon. Prices are indicative and may vary with design.
        </p>
      </main>

      <footer className="mt-auto flex items-center justify-between border-t border-border pt-6">
        <p className="text-xs text-muted">© {new Date().getFullYear()} NAILSBYCHAO</p>
        <ApiStatus />
      </footer>
    </div>
  );
}

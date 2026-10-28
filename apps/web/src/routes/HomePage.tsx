import heroImage from "@/assets/hero-nails.jpeg";
import { ApiStatus } from "@/components/ApiStatus";
import { ServiceList } from "@/features/services/ServiceList";

const INSTAGRAM_URL = "https://www.instagram.com/nailsbychao_/";

export function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="relative isolate flex min-h-[70svh] items-center justify-center overflow-hidden px-4 py-16 text-center sm:min-h-[80svh]">
        {/* Decorative: the wordmark and tagline carry the meaning. */}
        <img
          src={heroImage}
          alt=""
          width={1280}
          height={1231}
          fetchPriority="high"
          className="absolute inset-0 -z-20 size-full object-cover object-bottom"
        />
        {/* Darkens the bright photo for legible text and fades into the page background. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-b from-black/55 via-black/30 via-70% to-background"
        />

        <div>
          <div
            aria-hidden="true"
            className="mx-auto grid size-20 place-items-center rounded-full border border-accent/60 bg-surface/70 font-display text-2xl font-bold text-accent backdrop-blur-sm"
          >
            C
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight drop-shadow-lg sm:text-6xl">
            NAILS<span className="text-accent">BY</span>CHAO
          </h1>
          <p className="mt-3 text-white/85 drop-shadow-md sm:text-lg">
            Nail tech &amp; MUA · Home studio &amp; house calls 🇰🇪
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
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
              className="rounded-full border border-white/40 bg-black/30 px-6 py-3 font-semibold backdrop-blur-sm hover:border-accent"
            >
              Instagram
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-16 sm:px-6">
        <main id="services" className="mt-4 mb-12 scroll-mt-8">
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
    </div>
  );
}

import { Link } from "react-router";
import heroImage from "@/assets/hero-nails.jpeg";
import { ApiStatus } from "@/components/ApiStatus";
import { SiteHeader } from "@/components/SiteHeader";
import { GallerySection } from "@/features/gallery/GallerySection";
import { ServiceList } from "@/features/services/ServiceList";

const INSTAGRAM_URL = "https://www.instagram.com/nailsbychao_/";
const PHONE_DISPLAY = "+254 113 563 021";
const PHONE_TEL = "+254113563021";
const WHATSAPP_URL = "https://wa.me/254113563021";
const EMAIL = "florakiteria@gmail.com";

export function HomePage() {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <div className="relative isolate flex min-h-[22rem] flex-col overflow-hidden sm:min-h-[80svh]">
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

        <SiteHeader variant="overlay" />

        <div className="page-x relative z-10 flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-16">
          <div
            aria-hidden="true"
            className="mx-auto grid size-16 place-items-center rounded-full border border-accent/60 bg-surface/70 font-display text-2xl font-bold text-accent backdrop-blur-sm sm:size-20"
          >
            C
          </div>
          <h1 className="mt-5 max-w-full text-[clamp(1.35rem,8.5vw,3.75rem)] leading-none font-bold tracking-tight drop-shadow-lg">
            NAILS<span className="text-accent">BY</span>CHAO
          </h1>
          <p className="mt-3 max-w-full text-balance text-white/85 drop-shadow-md sm:text-lg">
            Nail tech &amp; MUA · Home studio &amp; house calls 🇰🇪
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
            <a
              href="#services"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground hover:opacity-90"
            >
              Book an appointment
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 bg-black/30 px-6 py-3 font-semibold backdrop-blur-sm hover:border-accent"
            >
              Instagram
            </a>
          </div>
        </div>
      </div>

      <div className="page-x mx-auto flex w-full min-w-0 max-w-2xl flex-1 flex-col pb-16">
        <main id="services" className="mt-4 mb-12 scroll-mt-8">
          <h2 className="mb-6 text-2xl font-semibold">Services</h2>
          <ServiceList />
          <p className="mt-6 text-xs text-muted">
            Tap Book to see available times. Prices are indicative and may vary with design.
          </p>
        </main>

        <GallerySection />

        <ContactSection />

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <p className="text-xs text-muted">© {new Date().getFullYear()} NAILSBYCHAO</p>
          <div className="flex items-center gap-4">
            <Link to="/manage" className="text-xs text-muted hover:text-accent">
              Manage a booking
            </Link>
            <a href="/admin/login" className="text-xs text-muted hover:text-accent">
              Admin
            </a>
            <ApiStatus />
          </div>
        </footer>
      </div>
    </div>
  );
}

function ContactSection() {
  return (
    <section aria-labelledby="visit-heading" className="mb-12">
      <h2 id="visit-heading" className="mb-4 text-2xl font-semibold">
        Visit
      </h2>
      <dl className="grid gap-4 text-sm">
        <div>
          <dt className="font-semibold">Hours</dt>
          <dd className="mt-1 text-muted">Monday–Saturday 8:00–20:00. Sunday closed.</dd>
        </div>
        <div>
          <dt className="font-semibold">Studio</dt>
          <dd className="mt-1 text-muted">Home studio in Juja. House calls available.</dd>
        </div>
        <div>
          <dt className="font-semibold">Phone</dt>
          <dd className="mt-1 flex flex-col items-start">
            <a href={`tel:${PHONE_TEL}`} className="inline-flex min-h-11 items-center text-accent">
              {PHONE_DISPLAY}
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-accent"
            >
              WhatsApp
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Email</dt>
          <dd className="mt-1">
            <a
              href={`mailto:${EMAIL}`}
              className="inline-flex min-h-11 items-center break-all text-accent"
            >
              {EMAIL}
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}

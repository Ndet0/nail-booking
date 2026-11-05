import type { ServiceCategory, ServiceDto } from "@nailsbychao/types";
import { Link } from "react-router";
import { formatDuration, formatPrice } from "@/lib/format";
import { useServices } from "./api";

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  nails: "Nails",
  makeup: "Makeup",
};

const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

export function ServiceList() {
  const { data, isPending, isError, error, refetch } = useServices();

  if (isPending) {
    return (
      <ul className="grid gap-3" aria-busy="true" aria-label="Loading services">
        {SKELETON_KEYS.map((key) => (
          <li
            key={key}
            className="h-20 animate-pulse rounded-card border border-border bg-surface"
          />
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-card border border-border bg-surface p-5">
        <p className="font-semibold text-danger">Couldn't load services</p>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-accent-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface p-5 text-muted">
        No services are available right now. Please check back soon.
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      {(Object.keys(CATEGORY_LABELS) as ServiceCategory[]).map((category) => {
        // Not Object.groupBy: it needs iOS Safari 17.4+, and many customers are on older phones.
        const services = data.filter((service) => service.category === category);
        if (services.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`category-${category}`}>
            <h3
              id={`category-${category}`}
              className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
            >
              {CATEGORY_LABELS[category]}
            </h3>
            <ul className="grid gap-3">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceDto }) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-card border border-border bg-surface p-4 sm:p-5">
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold">{service.name}</p>
        {service.description && <p className="mt-1 text-sm text-muted">{service.description}</p>}
        <p className="mt-2 text-xs text-muted">{formatDuration(service.durationMinutes)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-3">
        <p className="font-semibold text-accent">
          {formatPrice(service.priceMinor, service.currency)}
        </p>
        <Link
          to={`/book/${encodeURIComponent(service.id)}`}
          aria-label={`Book ${service.name}`}
          className="rounded-full border border-accent px-4 py-1.5 text-sm font-semibold text-accent hover:bg-accent hover:text-accent-foreground"
        >
          Book
        </Link>
      </div>
    </li>
  );
}

import type { AppointmentLocation, ServiceDto } from "@nailsbychao/types";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAvailability } from "@/features/booking/api";
import { DayStrip } from "@/features/booking/DayStrip";
import { LocationToggle } from "@/features/booking/LocationToggle";
import { TimeSlots } from "@/features/booking/TimeSlots";
import { useService } from "@/features/services/api";
import { ApiError } from "@/lib/api";
import { addDays, datesBetween, formatDay, formatTime, studioToday } from "@/lib/datetime";
import { formatDuration, formatPrice } from "@/lib/format";

/** Strip length until the API reports the real booking window. */
const INITIAL_STRIP_DAYS = 14;

export function BookingPage() {
  const { serviceId = "" } = useParams();
  const service = useService(serviceId);

  return (
    <div className="page-x mx-auto w-full min-w-0 max-w-2xl py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex min-h-11 min-w-0 items-center text-sm text-muted hover:text-accent"
        >
          ← All services
        </Link>
        <ThemeToggle />
      </div>

      {service.isPending ? (
        <div className="mt-6 h-28 animate-pulse rounded-card border border-border bg-surface" />
      ) : service.isError ? (
        <ServiceUnavailable error={service.error} onRetry={() => service.refetch()} />
      ) : (
        <>
          <ServiceHeader service={service.data} />
          <SlotPicker serviceId={service.data.id} />
        </>
      )}
    </div>
  );
}

function ServiceHeader({ service }: { service: ServiceDto }) {
  return (
    <header className="mt-6 rounded-card border border-border bg-surface p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h1 className="min-w-0 text-2xl font-semibold">{service.name}</h1>
        <p className="font-semibold text-accent sm:shrink-0">
          {formatPrice(service.priceMinor, service.currency)}
        </p>
      </div>
      {service.description && <p className="mt-2 text-muted">{service.description}</p>}
      <p className="mt-3 text-sm text-muted">{formatDuration(service.durationMinutes)}</p>
    </header>
  );
}

function ServiceUnavailable({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div role="alert" className="mt-6 rounded-card border border-border bg-surface p-5">
      <p className="font-semibold text-danger">
        {notFound ? "This service isn't available" : "Couldn't load this service"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {notFound ? "It may have been removed. Please pick another service." : error.message}
      </p>
      {!notFound && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-accent-foreground"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function SlotPicker({ serviceId }: { serviceId: string }) {
  const [today] = useState(studioToday);
  const [location, setLocation] = useState<AppointmentLocation>("studio");
  const [date, setDate] = useState(today);
  const [startAt, setStartAt] = useState<string | null>(null);
  const availability = useAvailability(serviceId, date, location);

  const lastDate = availability.data?.lastBookableDate ?? addDays(today, INITIAL_STRIP_DAYS - 1);
  const isLoadingSlots = availability.isPending || availability.isPlaceholderData;

  function chooseLocation(next: AppointmentLocation) {
    setLocation(next);
    setStartAt(null);
  }

  function chooseDate(next: string) {
    setDate(next);
    setStartAt(null);
  }

  return (
    <div className="mt-8 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8">
      <LocationToggle value={location} onChange={chooseLocation} />

      <section aria-labelledby="day-heading" className="min-w-0">
        <h2
          id="day-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
        >
          Day
        </h2>
        <DayStrip dates={datesBetween(today, lastDate)} selected={date} onSelect={chooseDate} />
      </section>

      <section aria-labelledby="time-heading" className="min-w-0">
        <h2
          id="time-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
        >
          Time <span className="font-normal normal-case tracking-normal">(Nairobi time)</span>
        </h2>
        <TimeSlots
          slots={availability.data?.slots}
          isLoading={isLoadingSlots}
          error={availability.isError ? availability.error : null}
          onRetry={() => availability.refetch()}
          selected={startAt}
          onSelect={setStartAt}
        />
      </section>

      {startAt && (
        <div
          aria-live="polite"
          className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3 rounded-card border border-accent/60 bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        >
          <p className="min-w-0 font-semibold">
            {formatDay(date)}, {formatTime(startAt)}{" "}
            <span className="font-normal text-muted">
              {location === "house_call" ? "· house call" : "· at the studio"}
            </span>
          </p>
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground opacity-60 sm:w-auto"
          >
            Continue (coming soon)
          </button>
        </div>
      )}
    </div>
  );
}

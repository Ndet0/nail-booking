import type { AppointmentLocation, ServiceDto } from "@nailsbychao/types";
import { useState } from "react";
import { Link, useParams } from "react-router";
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
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/" className="text-sm text-muted hover:text-accent">
        ← All services
      </Link>

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
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{service.name}</h1>
        <p className="shrink-0 font-semibold text-accent">
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
    <div className="mt-8 grid gap-8">
      <LocationToggle value={location} onChange={chooseLocation} />

      <section aria-labelledby="day-heading">
        <h2
          id="day-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
        >
          Day
        </h2>
        <DayStrip dates={datesBetween(today, lastDate)} selected={date} onSelect={chooseDate} />
      </section>

      <section aria-labelledby="time-heading">
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
          className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/60 bg-surface p-4"
        >
          <p className="font-semibold">
            {formatDay(date)}, {formatTime(startAt)}{" "}
            <span className="font-normal text-muted">
              {location === "house_call" ? "· house call" : "· at the studio"}
            </span>
          </p>
          <button
            type="button"
            disabled
            className="rounded-full bg-accent px-5 py-2 font-semibold text-accent-foreground opacity-60"
          >
            Continue (coming soon)
          </button>
        </div>
      )}
    </div>
  );
}

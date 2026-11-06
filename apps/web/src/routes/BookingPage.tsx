import type { AppointmentLocation, BookingDto, ServiceDto } from "@nailsbychao/types";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAvailability } from "@/features/booking/api";
import { BookingConfirmation } from "@/features/booking/BookingConfirmation";
import { type BookingDetails, BookingForm } from "@/features/booking/BookingForm";
import { DateCalendar } from "@/features/booking/DateCalendar";
import { LocationToggle } from "@/features/booking/LocationToggle";
import { loadBooking, saveBooking } from "@/features/booking/saved-booking";
import { TimeSlots } from "@/features/booking/TimeSlots";
import { useService } from "@/features/services/api";
import { ApiError } from "@/lib/api";
import { addDays, studioToday } from "@/lib/datetime";
import { formatDuration, formatPrice } from "@/lib/format";

/** Window length until the API reports the real booking window. */
const INITIAL_WINDOW_DAYS = 14;

const EMPTY_DETAILS: BookingDetails = { name: "", phone: "", email: "", address: "", notes: "" };

type BookingStep = 1 | 2 | 3;

const STEP_TITLES: Record<BookingStep, string> = {
  1: "Where and when",
  2: "Your details",
  3: "Review",
};

const BOOKING_PARAM = "booking";

export function BookingPage() {
  const { serviceId = "" } = useParams();
  const service = useService(serviceId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [justBooked, setJustBooked] = useState<BookingDto | null>(null);
  const reference = searchParams.get(BOOKING_PARAM);
  const saved = justBooked ?? (reference ? loadBooking(reference) : null);
  const booking =
    saved?.serviceId === serviceId && saved.bookingReference === reference ? saved : null;

  function handleBooked(next: BookingDto) {
    saveBooking(next);
    setJustBooked(next);
    setSearchParams({ [BOOKING_PARAM]: next.bookingReference }, { replace: true });
  }

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
          {booking ? (
            <BookingConfirmation booking={booking} />
          ) : (
            <SlotPicker service={service.data} onBooked={handleBooked} />
          )}
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

function SlotPicker({
  service,
  onBooked,
}: {
  service: ServiceDto;
  onBooked: (booking: BookingDto) => void;
}) {
  const [today] = useState(studioToday);
  const [step, setStep] = useState<BookingStep>(1);
  const [location, setLocation] = useState<AppointmentLocation>("studio");
  const [date, setDate] = useState(today);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [slotTaken, setSlotTaken] = useState(false);
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const progressRef = useRef<HTMLParagraphElement>(null);
  const timeRef = useRef<HTMLElement>(null);
  const availability = useAvailability(service.id, date, location);

  const lastDate = availability.data?.lastBookableDate ?? addDays(today, INITIAL_WINDOW_DAYS - 1);
  const isLoadingSlots = availability.isPending || availability.isPlaceholderData;

  useEffect(() => {
    if (slotTaken) timeRef.current?.scrollIntoView({ block: "nearest" });
  }, [slotTaken]);

  useEffect(() => {
    if (step === 1) return;
    progressRef.current?.scrollIntoView({ block: "nearest" });
  }, [step]);

  function chooseLocation(next: AppointmentLocation) {
    setLocation(next);
    setStartAt(null);
    setSlotTaken(false);
  }

  function chooseDate(next: string) {
    setDate(next);
    setStartAt(null);
    setSlotTaken(false);
  }

  function chooseTime(next: string) {
    setStartAt(next);
    setSlotTaken(false);
  }

  function handleSlotTaken() {
    setStartAt(null);
    setSlotTaken(true);
    setStep(1);
  }

  return (
    <div className="mt-8 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8">
      <p ref={progressRef} className="text-sm font-semibold uppercase tracking-widest text-muted">
        Step {step} of 3
        <span className="font-normal normal-case tracking-normal"> · {STEP_TITLES[step]}</span>
      </p>

      {step === 1 && (
        <>
          <LocationToggle value={location} onChange={chooseLocation} />

          <section aria-labelledby="day-heading" className="min-w-0">
            <h2
              id="day-heading"
              className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
            >
              Day
            </h2>
            <DateCalendar
              firstDate={today}
              lastDate={lastDate}
              selected={date}
              onSelect={chooseDate}
            />
          </section>

          <section ref={timeRef} aria-labelledby="time-heading" className="min-w-0">
            <h2
              id="time-heading"
              className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
            >
              Time <span className="font-normal normal-case tracking-normal">(Nairobi time)</span>
            </h2>
            {slotTaken && (
              <p role="alert" className="mb-3 text-sm text-danger">
                That time was just taken. Please choose another.
              </p>
            )}
            <TimeSlots
              slots={availability.data?.slots}
              isLoading={isLoadingSlots}
              error={availability.isError ? availability.error : null}
              onRetry={() => availability.refetch()}
              selected={startAt}
              onSelect={chooseTime}
            />
          </section>

          <button
            type="button"
            disabled={!startAt}
            onClick={() => setStep(2)}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            Continue
          </button>
        </>
      )}

      {startAt && (
        // A new slot is a new attempt, so the form remounts and mints a new idempotency key.
        <BookingForm
          key={`${location}:${startAt}`}
          step={step}
          service={service}
          date={date}
          startAt={startAt}
          location={location}
          details={details}
          onDetailsChange={setDetails}
          onContinue={() => setStep(3)}
          onBack={() => setStep(step === 3 ? 2 : 1)}
          onShowDetails={() => setStep(2)}
          onBooked={onBooked}
          onSlotTaken={handleSlotTaken}
        />
      )}
    </div>
  );
}

import type { BookingDto, BookingStatus } from "@nailsbychao/types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { SiteHeader } from "@/components/SiteHeader";
import {
  cancelBooking,
  getBooking,
  getBookingAvailability,
  lookupBooking,
  rescheduleBooking,
  useBookingClosedDates,
} from "@/features/booking/api";
import { BookingNotifications } from "@/features/booking/BookingNotifications";
import { DateCalendar } from "@/features/booking/DateCalendar";
import { CHANGE_POLICY, canCustomerChange } from "@/features/booking/policy";
import { loadManagementToken, saveManagementToken } from "@/features/booking/saved-booking";
import { TimeSlots } from "@/features/booking/TimeSlots";
import { ApiError } from "@/lib/api";
import {
  addDays,
  firstOpenDate,
  formatDay,
  formatTime,
  studioDateOf,
  studioToday,
} from "@/lib/datetime";
import { formatDuration, formatPhone, formatPrice } from "@/lib/format";

const PHONE_DISPLAY = "+254 113 563 021";
const PHONE_TEL = "+254113563021";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const REFERENCE_PATTERN = /^NBC-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function ManageBookingPage() {
  const { reference = "" } = useParams();
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <SiteHeader />
      <div className="page-x mx-auto w-full min-w-0 max-w-2xl flex-1 py-8">
        {reference ? <BookingManager key={reference} reference={reference} /> : <LookupForm />}
      </div>
    </div>
  );
}

function BookingManager({ reference }: { reference: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hashToken = tokenFromHash(location.hash);
  const [storedToken, setStoredToken] = useState(() => loadManagementToken(reference));
  const token = hashToken ?? storedToken;

  useEffect(() => {
    if (!hashToken) return;
    saveManagementToken(reference, hashToken);
    setStoredToken(hashToken);
    if (loadManagementToken(reference) === hashToken) {
      navigate(`/manage/${encodeURIComponent(reference)}`, { replace: true });
    }
  }, [hashToken, navigate, reference]);

  if (!token) {
    return (
      <LookupForm
        initialReference={reference}
        onFound={(nextReference, nextToken) => {
          if (nextReference === reference) {
            setStoredToken(nextToken);
            return;
          }
          navigate(`/manage/${encodeURIComponent(nextReference)}`);
        }}
      />
    );
  }
  return <ManagedBooking reference={reference} token={token} />;
}

function ManagedBooking({ reference, token }: { reference: string; token: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["booking", reference],
    queryFn: () => getBooking(reference, token),
  });

  if (query.isPending) {
    return <p className="mt-6 text-muted">Loading booking…</p>;
  }

  if (query.isError || !query.data) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Couldn't load that booking. Please try again.";
    return (
      <>
        <p role="alert" className="mt-6 text-sm text-danger">
          {message}
        </p>
        <LookupForm initialReference={reference} />
      </>
    );
  }

  return (
    <BookingDetail
      booking={query.data}
      token={token}
      onUpdated={(booking) => {
        queryClient.setQueryData(["booking", reference], booking);
        void queryClient.invalidateQueries({ queryKey: ["booking-availability", reference] });
        void queryClient.invalidateQueries({ queryKey: ["booking-notifications", reference] });
      }}
    />
  );
}

function BookingDetail({
  booking,
  token,
  onUpdated,
}: {
  booking: BookingDto;
  token: string;
  onUpdated: (booking: BookingDto) => void;
}) {
  const changeable = canCustomerChange(booking);
  const canMove = changeable && !booking.rescheduledAt;
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [moving, setMoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const where =
    booking.location === "house_call" ? `House call · ${booking.address}` : "At the studio in Juja";

  const cancel = useMutation({
    mutationFn: () => cancelBooking(booking.bookingReference, token),
    onSuccess: (next) => {
      setActionError(null);
      setConfirmingCancel(false);
      setMoving(false);
      onUpdated(next);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "The booking was not cancelled.");
    },
  });

  return (
    <section aria-labelledby="manage-heading" className="mt-6 grid gap-6">
      <div className="rounded-card border border-border bg-surface p-5">
        <h1 id="manage-heading" className="text-2xl font-semibold">
          {booking.bookingReference}
        </h1>
        <p className="mt-2">{statusMessage(booking, changeable)}</p>
        {!changeable && (booking.status === "pending" || booking.status === "confirmed") && (
          <p className="mt-2 text-sm text-muted">
            Call or WhatsApp Chao on{" "}
            <a href={`tel:${PHONE_TEL}`} className="font-semibold text-accent">
              {PHONE_DISPLAY}
            </a>
            .
          </p>
        )}
        {booking.rescheduledAt && changeable && (
          <p className="mt-2 text-sm text-muted">This booking has already been moved once.</p>
        )}

        <dl className="mt-6 grid gap-4">
          <SummaryItem label="Service">
            {booking.serviceName}{" "}
            <span className="font-normal text-muted">
              · {formatPrice(booking.priceMinor, booking.currency)}
            </span>
          </SummaryItem>
          <SummaryItem label="When">
            {formatDay(studioDateOf(booking.startAt))}, {formatTime(booking.startAt)}–
            {formatTime(booking.endAt)}{" "}
            <span className="font-normal text-muted">
              · {formatDuration(booking.durationMinutes)} (Nairobi time)
            </span>
          </SummaryItem>
          <SummaryItem label="Where">{where}</SummaryItem>
          <SummaryItem label="Name">{booking.customerName}</SummaryItem>
          <SummaryItem label="Phone">{formatPhone(booking.customerPhone)}</SummaryItem>
        </dl>
        <p className="mt-6 text-sm text-muted">{CHANGE_POLICY}</p>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      {changeable && (
        <div className="grid gap-3">
          {confirmingCancel ? (
            <div className="rounded-card border border-border bg-surface p-5">
              <p className="font-semibold">Cancel this booking?</p>
              <p className="mt-1 text-sm text-muted">The time will be free for someone else.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate()}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger hover:text-background disabled:opacity-60"
                >
                  {cancel.isPending ? "Cancelling…" : "Yes, cancel"}
                </button>
                <button
                  type="button"
                  disabled={cancel.isPending}
                  onClick={() => setConfirmingCancel(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold hover:border-accent disabled:opacity-60"
                >
                  Keep booking
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canMove && (
                <button
                  type="button"
                  onClick={() => {
                    setMoving((open) => !open);
                    setActionError(null);
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:opacity-90"
                >
                  {moving ? "Close times" : "Move this booking"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setConfirmingCancel(true);
                  setMoving(false);
                  setActionError(null);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold hover:border-accent"
              >
                Cancel booking
              </button>
            </div>
          )}
        </div>
      )}

      {canMove && moving && !confirmingCancel && (
        <ReschedulePicker
          booking={booking}
          token={token}
          onMoved={onUpdated}
          onError={setActionError}
        />
      )}

      <BookingNotifications reference={booking.bookingReference} token={token} />
    </section>
  );
}

function ReschedulePicker({
  booking,
  token,
  onMoved,
  onError,
}: {
  booking: BookingDto;
  token: string;
  onMoved: (booking: BookingDto) => void;
  onError: (message: string | null) => void;
}) {
  const [today] = useState(studioToday);
  const [date, setDate] = useState(() => studioDateOf(booking.startAt));
  const [startAt, setStartAt] = useState<string | null>(null);
  const availability = useQuery({
    queryKey: ["booking-availability", booking.bookingReference, date],
    queryFn: () => getBookingAvailability(booking.bookingReference, token, date),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const move = useMutation({
    mutationFn: (nextStart: string) =>
      rescheduleBooking(booking.bookingReference, token, nextStart),
    onSuccess: (next) => {
      onError(null);
      setStartAt(null);
      onMoved(next);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "slot_taken") {
        setStartAt(null);
        void availability.refetch();
      }
      onError(error instanceof Error ? error.message : "The booking was not moved.");
    },
  });

  const lastDate = availability.data?.lastBookableDate ?? addDays(today, 60);
  const closedDates = useBookingClosedDates(booking.bookingReference, token, today, lastDate);

  useEffect(() => {
    const dates = closedDates.data?.dates;
    if (!dates) return;
    const next = firstOpenDate(date, today, lastDate, dates);
    if (next !== date) {
      setDate(next);
      setStartAt(null);
    }
  }, [closedDates.data, date, today, lastDate]);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <section aria-labelledby="move-day-heading" className="min-w-0">
        <h2
          id="move-day-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
        >
          Day
        </h2>
        <DateCalendar
          firstDate={today}
          lastDate={lastDate}
          selected={date}
          closedDates={closedDates.data?.dates}
          onSelect={(next) => {
            setDate(next);
            setStartAt(null);
            onError(null);
          }}
        />
      </section>
      <section aria-labelledby="move-time-heading" className="min-w-0">
        <h2
          id="move-time-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted"
        >
          Time <span className="font-normal normal-case tracking-normal">(Nairobi time)</span>
        </h2>
        <p className="mb-3 text-sm text-muted">Times are at least 24 hours away.</p>
        <TimeSlots
          slots={availability.data?.date === date ? availability.data.slots : undefined}
          isLoading={availability.isPending || availability.isPlaceholderData}
          error={availability.isError ? availability.error : null}
          onRetry={() => availability.refetch()}
          selected={startAt}
          onSelect={(next) => {
            setStartAt(next);
            onError(null);
          }}
        />
      </section>
      {startAt && (
        <button
          type="button"
          disabled={move.isPending}
          onClick={() => move.mutate(startAt)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {move.isPending ? "Moving…" : `Move to ${formatDay(date)}, ${formatTime(startAt)}`}
        </button>
      )}
    </div>
  );
}

function LookupForm({
  initialReference = "",
  onFound,
}: {
  initialReference?: string;
  onFound?: (reference: string, token: string) => void;
}) {
  const navigate = useNavigate();
  const [reference, setReference] = useState(initialReference);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showLink, setShowLink] = useState(false);

  function openBooking(nextReference: string, nextToken: string) {
    saveManagementToken(nextReference, nextToken);
    setError(null);
    if (onFound) onFound(nextReference, nextToken);
    else navigate(`/manage/${encodeURIComponent(nextReference)}`);
  }

  async function onPhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const booking = await lookupBooking(reference, phone);
      if (!booking.managementToken) {
        setError("Those details don't match a booking.");
        return;
      }
      openBooking(booking.bookingReference, booking.managementToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't find that booking.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <form
        noValidate
        onSubmit={onPhoneSubmit}
        className="grid gap-4 rounded-card border border-border bg-surface p-5"
      >
        <div>
          <h1 className="text-2xl font-semibold">Manage my booking</h1>
          <p className="mt-2 text-sm text-muted">
            Enter the booking reference and the phone number you booked with.
          </p>
        </div>
        <label className="text-sm font-semibold" htmlFor="manage-reference">
          Booking reference
          <input
            id="manage-reference"
            name="reference"
            autoComplete="off"
            spellCheck={false}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-card border border-border bg-background px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold" htmlFor="manage-phone">
          Phone number
          <input
            id="manage-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-card border border-border bg-background px-3 font-normal"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Finding…" : "Find booking"}
        </button>
      </form>

      <div className="rounded-card border border-border bg-surface p-5">
        <button
          type="button"
          aria-expanded={showLink}
          onClick={() => {
            setShowLink((open) => !open);
            setError(null);
          }}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-accent"
        >
          {showLink ? "Hide the saved link" : "I saved the manage link"}
        </button>
        {showLink && <LinkLookup initialReference={reference} onOpen={openBooking} />}
      </div>
    </div>
  );
}

function LinkLookup({
  initialReference,
  onOpen,
}: {
  initialReference: string;
  onOpen: (reference: string, token: string) => void;
}) {
  const [reference, setReference] = useState(initialReference);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseManageInput(reference, token);
    if (!parsed) {
      setError("Enter the booking reference and the manage code from your link.");
      return;
    }
    setError(null);
    onOpen(parsed.reference, parsed.token);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="mt-4 grid gap-4">
      <h2 className="text-lg font-semibold">Use a saved link</h2>
      <p className="text-sm text-muted">
        Paste the manage link, or enter the reference and the code from the end of that link.
      </p>
      <label className="text-sm font-semibold" htmlFor="manage-link-reference">
        Booking reference or link
        <input
          id="manage-link-reference"
          name="reference"
          autoComplete="off"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-card border border-border bg-background px-3 font-normal"
        />
      </label>
      <label className="text-sm font-semibold" htmlFor="manage-token">
        Manage code
        <input
          id="manage-token"
          name="token"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-card border border-border bg-background px-3 font-normal"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 font-semibold hover:border-accent"
      >
        Find booking
      </button>
    </form>
  );
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{children}</dd>
    </div>
  );
}

function statusMessage(booking: BookingDto, changeable: boolean): string {
  const messages: Record<BookingStatus, string> = {
    pending: changeable
      ? "Pending — Chao will confirm this booking."
      : "Pending — Chao will confirm this booking. The 24-hour change window has closed.",
    confirmed: changeable ? "Confirmed." : "Confirmed. The 24-hour change window has closed.",
    cancelled: "Cancelled. This time is free for someone else.",
    completed: "This appointment is complete.",
    no_show: "This appointment was marked as a no-show and can no longer be changed.",
  };
  return messages[booking.status];
}

function tokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, "").toLowerCase();
  return TOKEN_PATTERN.test(token) ? token : null;
}

function parseManageInput(
  referenceInput: string,
  tokenInput: string,
): { reference: string; token: string } | null {
  const blob = `${referenceInput} ${tokenInput}`;
  const fromLink = /manage\/(NBC-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})#([a-fA-F0-9]{64})/.exec(blob);
  if (fromLink?.[1] && fromLink[2]) {
    return { reference: fromLink[1].toUpperCase(), token: fromLink[2].toLowerCase() };
  }
  const reference = referenceInput.trim().toUpperCase();
  const token = tokenInput.trim().toLowerCase();
  if (REFERENCE_PATTERN.test(reference) && TOKEN_PATTERN.test(token)) {
    return { reference, token };
  }
  return null;
}

import type { BookingDto } from "@nailsbychao/types";
import { Link } from "react-router";
import { formatDay, formatTime, studioDateOf } from "@/lib/datetime";
import { formatDuration, formatPhone, formatPrice } from "@/lib/format";
import { CHANGE_POLICY } from "./policy";

export function BookingConfirmation({ booking }: { booking: BookingDto }) {
  const where =
    booking.location === "house_call" ? `House call · ${booking.address}` : "At the studio in Juja";

  return (
    <section
      aria-labelledby="confirmed-heading"
      className="mt-6 rounded-card border border-border bg-surface p-5"
    >
      <h2 id="confirmed-heading" className="text-2xl font-semibold">
        Booking requested
      </h2>
      <p className="mt-2">Pending — Chao will confirm this booking.</p>
      {booking.location === "studio" && (
        <p className="mt-1 text-sm text-muted">
          The exact studio address is shared once Chao confirms.
        </p>
      )}

      <dl className="mt-6 grid gap-4">
        <div>
          <dt className="text-sm text-muted">Booking reference</dt>
          <dd className="mt-1 font-display text-2xl font-semibold tracking-wide">
            {booking.bookingReference}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Service</dt>
          <dd className="mt-1 font-semibold">
            {booking.serviceName}{" "}
            <span className="font-normal text-muted">
              · {formatPrice(booking.priceMinor, booking.currency)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">When</dt>
          <dd className="mt-1 font-semibold">
            {formatDay(studioDateOf(booking.startAt))}, {formatTime(booking.startAt)}–
            {formatTime(booking.endAt)}{" "}
            <span className="font-normal text-muted">
              · {formatDuration(booking.durationMinutes)} (Nairobi time)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Where</dt>
          <dd className="mt-1 font-semibold">{where}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Name</dt>
          <dd className="mt-1">{booking.customerName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Phone</dt>
          <dd className="mt-1">
            <span className="font-semibold">{formatPhone(booking.customerPhone)}</span>
            <span className="mt-0.5 block text-sm text-muted">
              Chao will call or text this number to confirm.
            </span>
          </dd>
        </div>
        {booking.customerEmail && (
          <div>
            <dt className="text-sm text-muted">Email</dt>
            <dd className="mt-1 break-all">{booking.customerEmail}</dd>
          </div>
        )}
        {booking.customerNotes && (
          <div>
            <dt className="text-sm text-muted">Notes</dt>
            <dd className="mt-1 whitespace-pre-line">{booking.customerNotes}</dd>
          </div>
        )}
      </dl>

      <p className="mt-6 text-sm text-muted">{CHANGE_POLICY}</p>
      {booking.managementToken ? (
        <p className="mt-3 text-sm">
          Save this link. It is how you cancel or move the booking after you close this tab.{" "}
          <Link
            to={`/manage/${booking.bookingReference}#${booking.managementToken}`}
            className="font-semibold text-accent hover:opacity-90"
          >
            Manage this booking
          </Link>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Use the manage link you saved to cancel or move this booking.
        </p>
      )}

      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:opacity-90"
      >
        ← All services
      </Link>
    </section>
  );
}

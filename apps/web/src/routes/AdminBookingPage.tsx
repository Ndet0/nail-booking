import { Link, useParams } from "react-router";
import { useAdminBooking, useUpdateBookingStatus } from "@/features/admin/api";
import { NEXT_STATUS, STATUS_LABEL } from "@/features/admin/status";
import { Notice, secondaryButtonClass } from "@/features/admin/ui";
import { ApiError } from "@/lib/api";
import { formatDay, formatTime, studioDateOf } from "@/lib/datetime";
import { formatPhone, formatPrice } from "@/lib/format";

export function AdminBookingPage() {
  const { id = "" } = useParams();
  const query = useAdminBooking(id);
  const update = useUpdateBookingStatus(id);
  const booking = query.data;

  return (
    <>
      <Link to="/admin" className="text-sm font-semibold text-accent">
        Back to bookings
      </Link>
      {query.isPending ? <p className="text-muted">Loading booking…</p> : null}
      {query.isError ? (
        <Notice tone="error">
          {query.error instanceof ApiError ? query.error.message : "Couldn't load that booking."}
        </Notice>
      ) : null}
      {booking ? (
        <article className="grid gap-4 rounded-card border border-border bg-surface p-5">
          <header>
            <p className="text-sm text-accent">{STATUS_LABEL[booking.status]}</p>
            <h1 className="text-2xl font-semibold">{booking.bookingReference}</h1>
            <p className="mt-1 text-muted">
              {formatDay(studioDateOf(booking.startAt))} · {formatTime(booking.startAt)}–
              {formatTime(booking.endAt)}
            </p>
          </header>
          <dl className="grid gap-3 text-sm">
            <Detail label="Customer" value={booking.customerName} />
            <Detail label="Phone" value={formatPhone(booking.customerPhone)} />
            <Detail label="Email" value={booking.customerEmail ?? "—"} />
            <Detail
              label="Service"
              value={`${booking.serviceName} · ${formatPrice(booking.priceMinor, booking.currency)}`}
            />
            <Detail
              label="Where"
              value={booking.location === "house_call" ? "House call" : "Studio"}
            />
            <Detail label="Address" value={booking.address ?? "—"} />
            <Detail label="Staff" value={booking.staffName} />
            <Detail label="Notes" value={booking.customerNotes ?? "—"} />
            {booking.rescheduledAt ? (
              <Detail
                label="Moved by customer"
                value={`${formatDay(studioDateOf(booking.rescheduledAt))}, ${formatTime(booking.rescheduledAt)}`}
              />
            ) : null}
          </dl>
          {NEXT_STATUS[booking.status].length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {NEXT_STATUS[booking.status].map((status) => (
                <button
                  key={status}
                  type="button"
                  className={secondaryButtonClass}
                  disabled={update.isPending}
                  onClick={() => update.mutate(status)}
                >
                  Mark {STATUS_LABEL[status].toLowerCase()}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">This status cannot be changed.</p>
          )}
          {update.isError ? (
            <Notice tone="error">
              {update.error instanceof ApiError
                ? update.error.message
                : "The status was not changed."}
            </Notice>
          ) : null}
          {update.isSuccess ? <Notice tone="ok">Status updated.</Notice> : null}
        </article>
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className="text-muted">{value}</dd>
    </div>
  );
}

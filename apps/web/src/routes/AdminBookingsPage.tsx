import type { BookingStatus } from "@nailsbychao/types";
import { useState } from "react";
import { Link } from "react-router";
import { useAdminBookings } from "@/features/admin/api";
import { STATUS_LABEL } from "@/features/admin/status";
import { Field, fieldClass, Notice } from "@/features/admin/ui";
import { ApiError } from "@/lib/api";
import { formatDay, formatTime, studioDateOf } from "@/lib/datetime";

const STATUSES = ["", "pending", "confirmed", "cancelled", "completed", "no_show"] as const;

export function AdminBookingsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const query = useAdminBookings({ from, to, status });

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-muted">
          {from || to ? "Bookings in the selected dates." : "Upcoming bookings, soonest first."}
        </p>
      </div>
      <form className="grid gap-3 sm:grid-cols-3">
        <Field label="From">
          <input
            className={fieldClass}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            className={fieldClass}
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className={fieldClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUSES.map((value) => (
              <option key={value || "any"} value={value}>
                {value ? STATUS_LABEL[value as BookingStatus] : "Any"}
              </option>
            ))}
          </select>
        </Field>
      </form>
      {query.isPending ? <p className="text-muted">Loading bookings…</p> : null}
      {query.isError ? (
        <Notice tone="error">
          {query.error instanceof ApiError ? query.error.message : "Couldn't load bookings."}
        </Notice>
      ) : null}
      {query.data && query.data.items.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-5 text-sm text-muted">
          No bookings match these filters.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {query.data?.items.map((booking) => (
          <li key={booking.id}>
            <Link
              to={`/admin/bookings/${booking.id}`}
              className="block rounded-card border border-border bg-surface p-4 hover:border-accent"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{booking.customerName}</span>
                <span className="text-sm text-accent">{STATUS_LABEL[booking.status]}</span>
              </span>
              <span className="mt-1 block text-sm text-muted">
                {formatDay(studioDateOf(booking.startAt))} · {formatTime(booking.startAt)} ·{" "}
                {booking.serviceName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

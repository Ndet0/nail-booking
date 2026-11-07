import type { NotificationListDto } from "@nailsbychao/types";
import { Link } from "react-router";
import { formatDay, formatTime, studioDateOf } from "@/lib/datetime";

type ListQuery = {
  isPending: boolean;
  isError: boolean;
  data?: NotificationListDto;
};

type Marker = {
  isPending: boolean;
  mutate: (id: string) => void;
};

type AllMarker = {
  isPending: boolean;
  mutate: () => void;
};

export function NotificationList({
  label,
  query,
  markOne,
  markAll,
  bookingPath,
  page = false,
}: {
  label: string;
  query: ListQuery;
  markOne: Marker;
  markAll: AllMarker;
  bookingPath?: (appointmentId: string) => string;
  /** The list is the whole page, so the title is the page heading. */
  page?: boolean;
}) {
  const unread = query.data?.unreadCount ?? 0;
  const Heading = page ? "h1" : "h2";
  return (
    <section aria-labelledby="notifications-heading" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Heading
            id="notifications-heading"
            className={page ? "text-2xl font-semibold" : "text-lg font-semibold"}
          >
            Notifications
          </Heading>
          <p className="mt-1 text-sm text-muted">{label}</p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold hover:border-accent disabled:opacity-60"
          >
            {markAll.isPending ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </div>
      {query.isPending ? (
        <p className="text-sm text-muted">Loading notifications…</p>
      ) : query.isError || !query.data ? (
        <p role="alert" className="text-sm text-danger">
          Couldn't load notifications. Please try again.
        </p>
      ) : query.data.items.length === 0 ? (
        <p className="text-sm text-muted">No notifications yet.</p>
      ) : (
        <ul className="grid gap-3">
          {query.data.items.map((item) => (
            <li key={item.id} className="rounded-card border border-border bg-surface p-4">
              <p className="font-semibold">
                {!item.readAt && <span className="sr-only">Unread. </span>}
                {!item.readAt && (
                  <span
                    aria-hidden="true"
                    className="mr-2 inline-block size-2 rounded-full bg-accent align-middle"
                  />
                )}
                {item.title}
              </p>
              <p className="mt-1 text-sm">{item.body}</p>
              <p className="mt-1 text-xs text-muted">
                {formatDay(studioDateOf(item.createdAt))}, {formatTime(item.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {bookingPath && (
                  <Link
                    to={bookingPath(item.appointmentId)}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-accent"
                  >
                    View booking
                  </Link>
                )}
                {!item.readAt && (
                  <button
                    type="button"
                    disabled={markOne.isPending}
                    onClick={() => markOne.mutate(item.id)}
                    className="inline-flex min-h-11 items-center text-sm font-semibold hover:text-accent disabled:opacity-60"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

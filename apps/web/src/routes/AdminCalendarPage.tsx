import type { CalendarBlockDto, CalendarDayDto } from "@nailsbychao/types";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useAdminCalendar, useAdminStaff } from "@/features/admin/api";
import {
  Field,
  fieldClass,
  Notice,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/admin/ui";
import { ApiError, apiFetch } from "@/lib/api";
import {
  addDays,
  dayParts,
  formatDay,
  formatMonth,
  formatTime,
  monthStart,
  nairobiToUtc,
  shiftMonth,
  studioToday,
  weekdayIndex,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const LEADING_BLANKS = ["blank-0", "blank-1", "blank-2", "blank-3", "blank-4", "blank-5"] as const;

export function AdminCalendarPage() {
  const staff = useAdminStaff();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    staff.data?.items.find((member) => member.id === selectedId) ?? staff.data?.items[0];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="mt-1 text-sm text-muted">
          Block a few hours, or close a whole day. Sundays stay closed from the weekly hours.
          Bookings already in that time stay on the books.
        </p>
      </div>
      {staff.isPending ? <p className="text-muted">Loading staff…</p> : null}
      {staff.isError ? <Notice tone="error">Couldn't load staff.</Notice> : null}
      {staff.data && staff.data.items.length === 0 ? (
        <p className="text-sm text-muted">Add a staff member before closing days.</p>
      ) : null}
      {staff.data && staff.data.items.length > 1 ? (
        <Field label="Staff member">
          <select
            className={fieldClass}
            value={selected?.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {staff.data.items.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {selected ? (
        <MonthCalendar key={selected.id} staffId={selected.id} name={selected.name} />
      ) : null}
    </>
  );
}

function MonthCalendar({ staffId, name }: { staffId: string; name: string }) {
  const queryClient = useQueryClient();
  const [today] = useState(studioToday);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const from = visibleMonth;
  const to = addDays(shiftMonth(visibleMonth, 1), -1);
  const calendar = useAdminCalendar(staffId, from, to);
  const first = calendar.data?.firstBookableDate ?? today;
  const last = calendar.data?.lastBookableDate ?? addDays(today, 60);
  const byDate = new Map(calendar.data?.days.map((day) => [day.date, day]));
  const start = monthStart(visibleMonth);
  const leadingBlanks = weekdayIndex(start);
  const days = datesInMonth(start);

  function showMonth(next: string) {
    setVisibleMonth(next);
    setSelectedDate(null);
  }

  async function close(date: string, bookingCount: number) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<CalendarDayDto>("/admin/calendar/closures", {
        auth: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, date }),
      });
      setMessage(
        bookingCount > 0
          ? `${formatDay(date)} is closed. ${stayedLabel(bookingCount)}`
          : `${formatDay(date)} is closed. New bookings are blocked.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-calendar", staffId] });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The day was not closed.");
    } finally {
      setSaving(false);
    }
  }

  async function reopen(date: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<CalendarDayDto>(
        `/admin/calendar/closures?${new URLSearchParams({ staffId, date })}`,
        { auth: true, method: "DELETE" },
      );
      setMessage(`${formatDay(date)} is open again.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-calendar", staffId] });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The day was not reopened.");
    } finally {
      setSaving(false);
    }
  }

  function choose(day: CalendarDayDto) {
    if (saving || day.date < first || day.date > last || day.state === "weekly_closed") return;
    setSelectedDate(day.date);
    setError(null);
    setMessage(null);
  }

  const selectedDay = selectedDate ? byDate.get(selectedDate) : undefined;

  return (
    <section aria-labelledby="calendar-heading" className="min-w-0">
      <h2 id="calendar-heading" className="mb-3 text-sm font-semibold text-muted">
        {name}
      </h2>
      <div className="rounded-card border border-border bg-surface p-2 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <MonthButton
            label="Previous month"
            disabled={start <= monthStart(first)}
            onClick={() => showMonth(shiftMonth(start, -1))}
          >
            ‹
          </MonthButton>
          <p className="font-display text-base font-semibold" aria-live="polite">
            {formatMonth(start)}
          </p>
          <MonthButton
            label="Next month"
            disabled={start >= monthStart(last)}
            onClick={() => showMonth(shiftMonth(start, 1))}
          >
            ›
          </MonthButton>
        </div>
        <div className="grid grid-cols-7 text-center" aria-hidden="true">
          {WEEKDAYS.map((label) => (
            <span key={label} className="py-2 text-xs uppercase text-muted">
              {label}
            </span>
          ))}
        </div>
        {calendar.isPending ? (
          <p className="py-6 text-center text-sm text-muted">Loading days…</p>
        ) : null}
        {calendar.isError ? <Notice tone="error">Couldn't load the calendar.</Notice> : null}
        {calendar.data ? (
          <div className="grid grid-cols-7">
            {LEADING_BLANKS.slice(0, leadingBlanks).map((key) => (
              <span key={key} className="min-h-11" />
            ))}
            {days.map((date) => {
              const day = byDate.get(date);
              const number = dayParts(date).day;
              const inWindow = date >= first && date <= last;
              const cell =
                "mx-auto flex aspect-square w-full max-w-11 items-center justify-center text-sm tabular-nums";
              if (day && inWindow && day.state !== "weekly_closed") {
                const partial = day.state === "open" && day.blocks.length > 0;
                const closed = day.state === "closed";
                const label = closed
                  ? `${formatDay(date)}, closed`
                  : partial
                    ? `${formatDay(date)}, some hours blocked`
                    : formatDay(date);
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={saving}
                    aria-pressed={closed || date === selectedDate}
                    aria-label={label}
                    onClick={() => choose(day)}
                    className={cn(
                      cell,
                      "relative rounded-full border font-semibold",
                      closed
                        ? "border-border text-muted line-through"
                        : "border-border bg-surface hover:border-accent",
                      date === selectedDate && "ring-2 ring-accent",
                    )}
                  >
                    {number}
                    {partial ? (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 size-1.5 rounded-full bg-accent"
                      />
                    ) : null}
                  </button>
                );
              }
              const reason =
                day?.state === "weekly_closed" ? "closed every week" : "outside the booking window";
              return (
                <span key={date} className={cn(cell, "text-muted")}>
                  <span className="sr-only">{`${formatDay(date)}, ${reason}`}</span>
                  <span aria-hidden="true">{number}</span>
                </span>
              );
            })}
          </div>
        ) : null}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <li>Dot: some hours blocked</li>
          <li>Line through: closed this day</li>
          <li>Faded: closed every week</li>
        </ul>
      </div>
      {selectedDay ? (
        <DayPanel
          key={`${selectedDay.date}-${selectedDay.state}-${selectedDay.blocks.map((block) => block.id).join()}`}
          staffId={staffId}
          day={selectedDay}
          saving={saving}
          onCloseDay={() => void close(selectedDay.date, selectedDay.bookingCount)}
          onOpenDay={() => void reopen(selectedDay.date)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin-calendar", staffId] })}
          onSaving={setSaving}
          onError={setError}
          onMessage={setMessage}
        />
      ) : null}
      {error ? (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {message ? (
        <div className="mt-3">
          <Notice tone="ok">{message}</Notice>
        </div>
      ) : null}
    </section>
  );
}

function DayPanel({
  staffId,
  day,
  saving,
  onCloseDay,
  onOpenDay,
  onChanged,
  onSaving,
  onError,
  onMessage,
}: {
  staffId: string;
  day: CalendarDayDto;
  saving: boolean;
  onCloseDay: () => void;
  onOpenDay: () => void;
  onChanged: () => Promise<void>;
  onSaving: (saving: boolean) => void;
  onError: (message: string | null) => void;
  onMessage: (message: string | null) => void;
}) {
  const [form, setForm] = useState({ startTime: "12:00", endTime: "14:00", reason: "" });
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState<number | null>(null);

  async function block(event: FormEvent) {
    event.preventDefault();
    const startTime = form.startTime.slice(0, 5);
    const endTime = form.endTime.slice(0, 5);
    if (endTime <= startTime) {
      onError("End time must be after the start time.");
      onMessage(null);
      return;
    }
    const startAt = nairobiToUtc(day.date, startTime);
    const endAt = nairobiToUtc(day.date, endTime);
    const overlapping = day.bookings.filter(
      (booking) => booking.startAt < endAt && booking.endAt > startAt,
    ).length;
    if (overlapping > 0 && confirmBlock !== overlapping) {
      setConfirmBlock(overlapping);
      setConfirmClose(false);
      onError(null);
      onMessage(null);
      return;
    }
    onSaving(true);
    onError(null);
    onMessage(null);
    try {
      await apiFetch("/admin/time-off", {
        auth: true,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          startDate: day.date,
          startTime,
          endDate: day.date,
          endTime,
          reason: form.reason.trim() || null,
        }),
      });
      setConfirmBlock(null);
      setForm({ ...form, reason: "" });
      onMessage(
        overlapping > 0
          ? `${formatTime(startAt)}–${formatTime(endAt)} is blocked. ${stayedLabel(overlapping)}`
          : `${formatTime(startAt)}–${formatTime(endAt)} is blocked.`,
      );
      await onChanged();
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : "That time was not blocked.");
    } finally {
      onSaving(false);
    }
  }

  async function remove(id: string) {
    onSaving(true);
    onError(null);
    onMessage(null);
    setConfirmBlock(null);
    try {
      await apiFetch(`/admin/time-off/${encodeURIComponent(id)}`, { auth: true, method: "DELETE" });
      onMessage("That time is open again.");
      await onChanged();
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : "That time was not removed.");
    } finally {
      onSaving(false);
    }
  }

  function requestClose() {
    if (day.bookingCount > 0) {
      setConfirmClose(true);
      setConfirmBlock(null);
      onError(null);
      onMessage(null);
      return;
    }
    onCloseDay();
  }

  return (
    <div className="mt-4 grid gap-4 rounded-card border border-border bg-surface p-4">
      <h3 className="text-lg font-semibold">{formatDay(day.date)}</h3>
      {day.blocks.length > 0 ? (
        <ul className="grid gap-2">
          {day.blocks.map((block) => (
            <li key={block.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {blockLabel(day.date, block)}
                {block.reason ? ` · ${block.reason}` : ""}
              </span>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={saving}
                onClick={() => void remove(block.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No hours blocked yet.</p>
      )}
      {day.state === "closed" ? (
        <button type="button" className={primaryButtonClass} disabled={saving} onClick={onOpenDay}>
          Open this day
        </button>
      ) : (
        <>
          <form onSubmit={block} className="grid gap-3 sm:grid-cols-2">
            <Field label="From">
              <input
                className={fieldClass}
                type="time"
                required
                value={form.startTime}
                onChange={(event) => {
                  setForm({ ...form, startTime: event.target.value });
                  setConfirmBlock(null);
                }}
              />
            </Field>
            <Field label="Until">
              <input
                className={fieldClass}
                type="time"
                required
                value={form.endTime}
                onChange={(event) => {
                  setForm({ ...form, endTime: event.target.value });
                  setConfirmBlock(null);
                }}
              />
            </Field>
            <Field label="Reason">
              <input
                className={fieldClass}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </Field>
            {confirmBlock !== null ? (
              <p className="sm:col-span-2">
                {formatTime(nairobiToUtc(day.date, form.startTime.slice(0, 5)))}–
                {formatTime(nairobiToUtc(day.date, form.endTime.slice(0, 5)))} overlaps{" "}
                {bookingLabel(confirmBlock)}. {confirmBlock === 1 ? "It stays" : "They stay"} on the
                books. Block this time anyway?
              </p>
            ) : null}
            <button type="submit" className={primaryButtonClass} disabled={saving}>
              Block this time
            </button>
          </form>
          {confirmClose ? (
            <div className="grid gap-3">
              <p>
                {formatDay(day.date)} has {bookingLabel(day.bookingCount)}.{" "}
                {day.bookingCount === 1 ? "It stays" : "They stay"} on the books. Close this day
                anyway?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={saving}
                  onClick={onCloseDay}
                >
                  Close this day
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={saving}
                  onClick={() => setConfirmClose(false)}
                >
                  Keep it open
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={requestClose}
            >
              Close the whole day
            </button>
          )}
        </>
      )}
    </div>
  );
}

function blockLabel(date: string, block: CalendarBlockDto): string {
  const start = nairobiToUtc(date, "00:00");
  const end = nairobiToUtc(addDays(date, 1), "00:00");
  if (block.startAt <= start && block.endAt >= end) return "Whole day";
  return `${formatTime(block.startAt)}–${formatTime(block.endAt)}`;
}

function bookingLabel(count: number): string {
  return count === 1 ? "1 booking" : `${count} bookings`;
}

function stayedLabel(count: number): string {
  return count === 1 ? "1 booking stays on the books." : `${count} bookings stay on the books.`;
}

function datesInMonth(start: string): string[] {
  const month = start.slice(0, 7);
  const dates: string[] = [];
  for (let date = start; date.slice(0, 7) === month; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function MonthButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full text-xl leading-none hover:bg-background disabled:text-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}

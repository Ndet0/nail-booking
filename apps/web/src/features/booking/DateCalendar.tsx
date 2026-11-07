import { useState } from "react";
import {
  addDays,
  dayParts,
  formatDay,
  formatMonth,
  monthStart,
  shiftMonth,
  weekdayIndex,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const LEADING_BLANKS = ["blank-0", "blank-1", "blank-2", "blank-3", "blank-4", "blank-5"] as const;

type Props = {
  firstDate: string;
  lastDate: string;
  selected: string;
  closedDates?: readonly string[];
  onSelect: (date: string) => void;
};

export function DateCalendar({ firstDate, lastDate, selected, closedDates = [], onSelect }: Props) {
  const closed = new Set(closedDates);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(selected));
  const start = monthStart(visibleMonth);
  const days = datesInMonth(start);
  const leadingBlanks = weekdayIndex(start);
  const canGoBack = start > monthStart(firstDate);
  const canGoForward = start < monthStart(lastDate);

  return (
    <div className="rounded-card border border-border bg-surface p-2 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <MonthButton
          label="Previous month"
          disabled={!canGoBack}
          onClick={() => setVisibleMonth(shiftMonth(start, -1))}
        >
          ‹
        </MonthButton>
        <p className="font-display text-base font-semibold" aria-live="polite">
          {formatMonth(start)}
        </p>
        <MonthButton
          label="Next month"
          disabled={!canGoForward}
          onClick={() => setVisibleMonth(shiftMonth(start, 1))}
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

      <fieldset className="min-w-0">
        <legend className="sr-only">Choose a day</legend>
        <div className="grid grid-cols-7">
          {LEADING_BLANKS.slice(0, leadingBlanks).map((key) => (
            <span key={key} className="min-h-11" />
          ))}
          {days.map((date) => {
            const inRange = date >= firstDate && date <= lastDate;
            const { day } = dayParts(date);
            const dayClass =
              "mx-auto flex aspect-square w-full max-w-11 items-center justify-center text-sm tabular-nums";
            if (!inRange) {
              return (
                <span key={date} className={cn(dayClass, "text-muted")}>
                  {day}
                </span>
              );
            }
            if (closed.has(date)) {
              return (
                <button
                  key={date}
                  type="button"
                  disabled
                  aria-label={`${formatDay(date)}, closed`}
                  className={cn(dayClass, "text-muted line-through")}
                >
                  {day}
                </button>
              );
            }
            const isSelected = date === selected;
            return (
              <button
                key={date}
                type="button"
                aria-pressed={isSelected}
                aria-label={formatDay(date)}
                onClick={() => onSelect(date)}
                className={cn(
                  dayClass,
                  "rounded-full border font-semibold",
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface hover:border-accent",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
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

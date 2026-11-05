import type { AvailabilitySlotDto } from "@nailsbychao/types";
import { formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const SKELETON_KEYS = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];

type Props = {
  slots: AvailabilitySlotDto[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  selected: string | null;
  onSelect: (startAt: string) => void;
};

export function TimeSlots({ slots, isLoading, error, onRetry, selected, onSelect }: Props) {
  if (isLoading) {
    return (
      <ul
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        aria-busy="true"
        aria-label="Loading times"
      >
        {SKELETON_KEYS.map((key) => (
          <li
            key={key}
            className="h-11 animate-pulse rounded-full border border-border bg-surface"
          />
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-card border border-border bg-surface p-5">
        <p className="font-semibold text-danger">Couldn't load times</p>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-accent-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface p-5 text-muted">
        No times on this day. Please try another day.
      </p>
    );
  }

  return (
    <fieldset className="grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-4">
      <legend className="sr-only">Choose a time</legend>
      {slots.map((slot) => {
        const isSelected = slot.startAt === selected;
        return (
          <button
            key={slot.startAt}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(slot.startAt)}
            className={cn(
              "h-11 rounded-full border font-semibold tabular-nums",
              isSelected
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface hover:border-accent",
            )}
          >
            {formatTime(slot.startAt)}
          </button>
        );
      })}
    </fieldset>
  );
}

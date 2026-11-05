import { dayParts } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type Props = {
  dates: string[];
  selected: string;
  onSelect: (date: string) => void;
};

export function DayStrip({ dates, selected, onSelect }: Props) {
  return (
    // min-w-0: fieldsets default to min-content width, which would stop the strip scrolling.
    <fieldset className="page-x-bleed flex min-w-0 max-w-full snap-x gap-2 overflow-x-auto pb-2">
      <legend className="sr-only">Choose a day</legend>
      {dates.map((date) => {
        const { weekday, day, month } = dayParts(date);
        const isSelected = date === selected;
        return (
          <button
            key={date}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${weekday} ${day} ${month}`}
            onClick={() => onSelect(date)}
            className={cn(
              "flex w-16 shrink-0 snap-start flex-col items-center rounded-card border py-3",
              isSelected
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface hover:border-accent",
            )}
          >
            <span className="text-xs uppercase">{weekday}</span>
            <span className="font-display text-xl font-semibold">{day}</span>
            <span className={cn("text-xs", !isSelected && "text-muted")}>{month}</span>
          </button>
        );
      })}
    </fieldset>
  );
}

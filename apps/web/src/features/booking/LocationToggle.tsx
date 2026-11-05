import type { AppointmentLocation } from "@nailsbychao/types";

const OPTIONS: { value: AppointmentLocation; label: string; hint: string }[] = [
  { value: "studio", label: "At the studio", hint: "Chao's home studio" },
  {
    value: "house_call",
    label: "House call",
    hint: "Chao comes to you. Travel fee to be confirmed.",
  },
];

type Props = {
  value: AppointmentLocation;
  onChange: (value: AppointmentLocation) => void;
};

export function LocationToggle({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">
        Where
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded-card border border-border bg-surface p-4 has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name="location"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="block font-semibold">{option.label}</span>
            <span className="mt-1 block text-sm text-muted">{option.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

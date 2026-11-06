import type { ReactNode } from "react";

export const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-card border border-border bg-background px-3 text-sm";

export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold hover:border-accent disabled:opacity-60";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers always pass the form control as children.
    <label className="block text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <p className={tone === "error" ? "text-sm text-danger" : "text-sm text-accent"} role="status">
      {children}
    </p>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

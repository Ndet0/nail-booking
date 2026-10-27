import { useHealth } from "@/features/services/api";
import { cn } from "@/lib/utils";

/** Dev-facing indicator that the web → API → D1 path is working. */
export function ApiStatus() {
  const { data, isPending, isError } = useHealth();
  const ok = data?.status === "ok";
  const label = isPending ? "Checking API…" : isError || !ok ? "API unavailable" : "API connected";

  return (
    <p className="inline-flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          isPending ? "bg-muted" : ok ? "bg-emerald-400" : "bg-danger",
        )}
      />
      {label}
    </p>
  );
}

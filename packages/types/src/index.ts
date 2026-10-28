/** Shared API contracts between apps/web and apps/api. No database internals here. */

export type ApiSuccess<T> = {
  data: T;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ServiceCategory = "nails" | "makeup";

export type ServiceDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  durationMinutes: number;
  /** Integer minor units (KES cents). */
  priceMinor: number;
  currency: string;
};

export type HealthDto = {
  status: "ok" | "degraded";
  db: "ok" | "error";
};

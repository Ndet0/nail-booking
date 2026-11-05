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

export type AppointmentLocation = "studio" | "house_call";

/** A bookable service time. Instants are UTC ISO strings; buffers are not included. */
export type AvailabilitySlotDto = {
  startAt: string;
  endAt: string;
};

export type AvailabilityDto = {
  serviceId: string;
  /** `YYYY-MM-DD` in the studio timezone. */
  date: string;
  location: AppointmentLocation;
  timezone: string;
  /** Last date customers can book, in the studio timezone. */
  lastBookableDate: string;
  slots: AvailabilitySlotDto[];
};

export type HealthDto = {
  status: "ok" | "degraded";
  db: "ok" | "error";
};

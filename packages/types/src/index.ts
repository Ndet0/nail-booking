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

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

/** Statuses an administrator may set from the current one. The other three are terminal. */
export const bookingStatusTransitions: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  cancelled: [],
  completed: [],
  no_show: [],
};

/** Body of `POST /api/v1/bookings`. The idempotency key travels in a header. */
export type CreateBookingInput = {
  serviceId: string;
  /** Canonical UTC instant on a 15-minute boundary. The service start, without buffers. */
  startAt: string;
  location: AppointmentLocation;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  /** Required for a house call. Ignored for a studio booking. */
  address?: string;
  customerNotes?: string;
};

export type BookingDto = {
  id: string;
  bookingReference: string;
  /**
   * Raw management token. Present only on the response that inserted the row.
   * A retry of the same request returns null; only the SHA-256 is stored.
   */
  managementToken: string | null;
  status: BookingStatus;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  startAt: string;
  endAt: string;
  location: AppointmentLocation;
  /** House-call address the customer gave. Studio bookings never include the studio address. */
  address: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNotes: string | null;
  /** Null until a house-call fee is confirmed. */
  travelFeeMinor: number | null;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AdminProfileDto = {
  userId: string;
  email: string;
  name: string;
};

export type AdminBookingDto = {
  id: string;
  bookingReference: string;
  status: BookingStatus;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  startAt: string;
  endAt: string;
  location: AppointmentLocation;
  address: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNotes: string | null;
  travelFeeMinor: number | null;
  staffId: string;
  staffName: string;
  createdAt: string;
};

export type AdminServiceDto = ServiceDto & {
  isActive: boolean;
  displayOrder: number;
};

export type AdminStaffDto = {
  id: string;
  name: string;
  bio: string | null;
  isActive: boolean;
  serviceIds: string[];
};

export type WorkingHoursDto = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
};

export type TimeOffDto = {
  id: string;
  staffId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
};

export type GalleryImageDto = {
  id: string;
  title: string | null;
  description: string | null;
  altText: string;
  displayOrder: number;
  /** Same-origin path that serves the bytes, e.g. `/api/v1/gallery/:id/image`. */
  imagePath: string;
};

export type AdminGalleryImageDto = GalleryImageDto & {
  isPublished: boolean;
  createdAt: string;
};

import type { BookingDto } from "@nailsbychao/types";

/** Matches `customerChangeCutoffMinutes` in the API studio config. */
const CUSTOMER_CHANGE_CUTOFF_MS = 24 * 60 * 60 * 1000;

export const CHANGE_POLICY =
  "You can cancel, or move the time once, until 24 hours before the appointment. After that, contact Chao.";

export function canCustomerChange(booking: BookingDto, now = Date.now()): boolean {
  return (
    (booking.status === "pending" || booking.status === "confirmed") &&
    Date.parse(booking.startAt) - now >= CUSTOMER_CHANGE_CUTOFF_MS
  );
}

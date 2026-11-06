import { type BookingStatus, bookingStatusTransitions } from "@nailsbychao/types";

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return bookingStatusTransitions[from].includes(to);
}

export function allowedStatuses(from: BookingStatus): readonly BookingStatus[] {
  return bookingStatusTransitions[from];
}

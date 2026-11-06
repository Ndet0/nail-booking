import type {
  AppointmentLocation,
  AvailabilityDto,
  BookingDto,
  CreateBookingInput,
} from "@nailsbychao/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function createBooking(input: CreateBookingInput, idempotencyKey: string) {
  return apiFetch<BookingDto>("/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

function bookingPath(reference: string, suffix = "") {
  return `/bookings/${encodeURIComponent(reference)}${suffix}`;
}

function tokenHeader(token: string): HeadersInit {
  return { "X-Booking-Token": token };
}

export function getBooking(reference: string, token: string) {
  return apiFetch<BookingDto>(bookingPath(reference), { headers: tokenHeader(token) });
}

export function getBookingAvailability(reference: string, token: string, date: string) {
  return apiFetch<AvailabilityDto>(
    bookingPath(reference, `/availability?${new URLSearchParams({ date })}`),
    { headers: tokenHeader(token) },
  );
}

export function cancelBooking(reference: string, token: string) {
  return apiFetch<BookingDto>(bookingPath(reference, "/cancel"), {
    method: "POST",
    headers: tokenHeader(token),
  });
}

export function rescheduleBooking(reference: string, token: string, startAt: string) {
  return apiFetch<BookingDto>(bookingPath(reference, "/reschedule"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tokenHeader(token) },
    body: JSON.stringify({ startAt }),
  });
}

export function useAvailability(serviceId: string, date: string, location: AppointmentLocation) {
  return useQuery({
    queryKey: ["availability", serviceId, date, location],
    queryFn: () =>
      apiFetch<AvailabilityDto>(
        `/availability?${new URLSearchParams({ serviceId, date, location })}`,
      ),
    enabled: serviceId.length > 0,
    // Slots change as people book; keep them fresh.
    staleTime: 30_000,
    // Keeps the booking window while the next day loads.
    placeholderData: keepPreviousData,
  });
}

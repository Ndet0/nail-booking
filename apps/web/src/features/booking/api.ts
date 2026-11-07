import type {
  AppointmentLocation,
  AvailabilityDto,
  BookingClosedDatesDto,
  BookingDto,
  ClosedDatesDto,
  CreateBookingInput,
  NotificationListDto,
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

export function lookupBooking(bookingReference: string, customerPhone: string) {
  return apiFetch<BookingDto>("/bookings/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingReference, customerPhone }),
  });
}

export function getBooking(reference: string, token: string) {
  return apiFetch<BookingDto>(bookingPath(reference), { headers: tokenHeader(token) });
}

export function listBookingNotifications(reference: string, token: string) {
  return apiFetch<NotificationListDto>(bookingPath(reference, "/notifications"), {
    headers: tokenHeader(token),
  });
}

export function markBookingNotificationsRead(reference: string, token: string) {
  return apiFetch<NotificationListDto>(bookingPath(reference, "/notifications/read"), {
    method: "POST",
    headers: tokenHeader(token),
  });
}

export function markBookingNotificationRead(reference: string, token: string, id: string) {
  return apiFetch<NotificationListDto>(
    bookingPath(reference, `/notifications/${encodeURIComponent(id)}/read`),
    { method: "POST", headers: tokenHeader(token) },
  );
}

export function useClosedDates(serviceId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["closed-dates", serviceId, from, to],
    queryFn: () =>
      apiFetch<ClosedDatesDto>(
        `/availability/closed-dates?${new URLSearchParams({ serviceId, from, to })}`,
      ),
    enabled: serviceId.length > 0 && from <= to,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useBookingClosedDates(reference: string, token: string, from: string, to: string) {
  return useQuery({
    queryKey: ["booking-closed-dates", reference, from, to],
    queryFn: () =>
      apiFetch<BookingClosedDatesDto>(
        bookingPath(reference, `/closed-dates?${new URLSearchParams({ from, to })}`),
        { headers: tokenHeader(token) },
      ),
    enabled: reference.length > 0 && token.length > 0 && from <= to,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
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

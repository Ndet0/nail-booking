import type { BookingDto } from "@nailsbychao/types";

/**
 * Keeps a just-made booking, including its one-time management token, for this browser tab.
 * sessionStorage survives a refresh but is cleared when the tab closes, so the token and
 * contact details do not linger on a shared device.
 */
const KEY_PREFIX = "nbc:booking:";
const TOKEN_PREFIX = "nbc:booking-token:";

export function saveBooking(booking: BookingDto): void {
  const key = KEY_PREFIX + booking.bookingReference;
  const previous = loadBooking(booking.bookingReference);
  // A retried request returns a null token; keep the one from the first response.
  const managementToken = booking.managementToken ?? previous?.managementToken ?? null;
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...booking, managementToken }));
    if (managementToken) saveManagementToken(booking.bookingReference, managementToken);
  } catch {
    // Storage can be full or blocked; the confirmation still shows from page state.
  }
}

/** The manage code, kept for this tab after the link's hash is removed from the address bar. */
export function saveManagementToken(reference: string, token: string): void {
  try {
    sessionStorage.setItem(TOKEN_PREFIX + reference, token);
  } catch {
    // Storage can be full or blocked. The hash link still works until it is removed.
  }
}

export function loadManagementToken(reference: string): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_PREFIX + reference);
    return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function loadBooking(reference: string): BookingDto | null {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + reference);
    if (!raw) return null;
    const booking = JSON.parse(raw) as BookingDto;
    return booking.bookingReference === reference ? booking : null;
  } catch {
    return null;
  }
}

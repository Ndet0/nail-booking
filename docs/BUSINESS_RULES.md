# Business Rules — NAILSBYCHAO

This records the Sprint 0 business decisions. Items marked **TBC** are proposed defaults until Chao confirms them. Update this file whenever a rule changes; the code and seed data follow it.

## 1. Studio identity

| Item | Value | Status |
|---|---|---|
| Platform name | NAILSBYCHAO | Confirmed |
| Owner / technician | Chao — Nail tech & makeup artist (MUA) | Confirmed (Instagram) |
| Instagram | [@nailsbychao_](https://www.instagram.com/nailsbychao_/) | Confirmed |
| Service model | Home-based studio **and** house calls | Confirmed (Instagram) |
| Country / timezone | Kenya / `Africa/Nairobi` | Confirmed |
| Studio area / address | Dunamis Apartment, Juja. Public site shows **Juja** only; the apartment name is given after a booking is confirmed. | Confirmed |
| Phone / WhatsApp | +254 113 563 021 | Confirmed |
| Email | florakiteria@gmail.com | Confirmed |
| Logo / cover image | — | **TBC** |

## 2. Brand direction

Inspired by [Katiani Styles](https://katiani-styles.swiftill.co.ke/): dark-first, minimal, profile-style page with a single accent colour.

- Background `#0b0b0b`, surface `#141414`, border `#2a2a2a`, text `#ffffff`, muted `#a0a0a0`.
- Accent: rose-nude `#d98ca0` — **TBC** (defined once as a CSS token in `apps/web/src/styles/theme.css`).
- Headings: Outfit. Body: Manrope.
- A light theme exists for accessibility and user preference.

## 3. Booking rules

| Rule | Default | Status |
|---|---|---|
| Technicians | One (Chao). Customers do not choose a technician yet; the `staff` model still exists for growth. | Proposed |
| Booking location | `studio` (home-based) or `house_call` | Confirmed (Instagram) |
| House-call area / radius | — | **TBC** |
| House-call fee | — | **TBC** (flat fee or by zone) |
| House-call travel buffer | 60 min before and after, blocked in the schedule | **TBC** |
| Working hours | Mon–Sat 08:00–20:00, Sunday closed | Confirmed |
| Breaks | None fixed; added as time off | **TBC** |
| Scheduling increment | 15 minutes | Proposed |
| Turnaround buffer between appointments | 15 minutes | **TBC** |
| Minimum lead time | 2 hours | **TBC** |
| Maximum advance booking | 60 days | **TBC** |
| Account required | No, guest booking is the default | Proposed |
| Required contact details | Name + phone (Kenyan format). Email optional. Address required for house calls only. | Proposed |
| Currency | KES, stored as integer minor units (KES 1 = 100) | Confirmed |
| Price display | `KES 1,500` (no decimals when whole) | Proposed |
| Cancellation | Free up to 24 hours before; later cancellations may forfeit the deposit | **TBC** |
| Rescheduling | Allowed once, up to 24 hours before | **TBC** |
| Deposit | Not in MVP; M-Pesa deposit is post-MVP (Sprint 9) | Proposed |
| New booking status | `pending` until Chao confirms | **TBC** (alternative: auto-`confirmed`) |

### Scheduling model

These values live in `apps/api/src/config/studio.ts`. Change them there and here together.

- Every booking reserves 15-minute slots in `appointment_slot_reservations`. Slot starts are stored as canonical UTC strings (`YYYY-MM-DDTHH:MM:00.000Z`) aligned to :00, :15, :30 or :45, and the database rejects any other format.
- Reserved slots cover the service duration **plus the buffers**, so availability and conflict locking use the same rule:
  - Studio booking: service duration, then the turnaround buffer.
  - House call: the travel buffer before, the service duration, then the travel buffer after. The turnaround buffer is not added on top.
- The appointment's `start_at` and `end_at` are the service itself, without buffers. That is what the customer sees.
- The whole block, buffers included, must fit inside one working period. A house call at opening time therefore starts one travel buffer after opening. With split shifts, a block cannot span the gap between two periods.
- The minimum lead time applies to the service start, not the travel buffer before it.
- Customers can book from today up to the maximum advance window, counted in Nairobi dates. Earlier or later dates are rejected.
- `pending` and `confirmed` bookings block availability. Cancelling a booking deletes its reservations in the same operation as the status change. `completed` and `no_show` bookings keep theirs as a record.
- An administrator may change status only along these paths: `pending` to `confirmed` or `cancelled`; `confirmed` to `completed`, `no_show`, or `cancelled`. `cancelled`, `completed`, and `no_show` are terminal. Any other change is rejected. Rescheduling is not part of this change.
- House-call bookings must include an address.

## 4. Service catalog (placeholder)

Seed data lives in `apps/api/seed/services.sql`. **All prices and durations are placeholders to be confirmed by Chao.**

| Service | Category | Duration | Price (KES) |
|---|---|---|---|
| Gel Polish (Natural Nails) | Nails | 60 min | 1,500 |
| BIAB Overlay | Nails | 75 min | 2,500 |
| Acrylic Full Set | Nails | 120 min | 3,500 |
| Gel-X Extensions | Nails | 90 min | 3,000 |
| Refill | Nails | 75 min | 2,000 |
| Removal | Nails | 30 min | 500 |
| Nail Art Add-on | Nails | 30 min | from 500 |
| Gel Pedicure | Nails | 75 min | 2,000 |
| Soft Glam Makeup | Makeup | 60 min | 2,500 |
| Full Glam / Bridal Trial | Makeup | 90 min | 4,000 |

Open questions:
- Should add-ons (nail art, removal) be standalone bookings or attached to a main service?
- Do house calls change service prices or only add a travel fee?

## 5. Open questions for Chao

1. Confirm service prices and durations. Working hours are confirmed.
2. House-call coverage area, fee and minimum spend.
3. Cancellation / late / no-show policy wording.
4. Logo, cover photo and the gallery images allowed for use.
5. Should bookings auto-confirm or wait for manual approval?
6. Are the turnaround (15 min) and house-call travel (60 min each way) buffers right?
7. Should add-ons (nail art, removal) be booked on their own or attached to a main service?

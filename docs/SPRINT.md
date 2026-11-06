# Sprint Plan — Nail Appointment Booking System

## 1. Sprint Overview

This document breaks the nail appointment booking platform into implementation phases, with checklists, deliverables, and acceptance criteria.

The development approach prioritizes a working end-to-end booking flow before adding optional features such as payments, automated notifications, and mobile applications.

### Project objectives

- Build a responsive nail studio website.
- Implement a reliable appointment booking API.
- Use Cloudflare D1 as the target database from the beginning.
- Deploy the backend to Cloudflare Workers.
- Support secure administration of bookings, services, staff, and schedules.
- Test the booking system against concurrent requests before launch.

### Definition of done

A task is complete when:

- The implementation matches the documented requirements.
- Input validation and error handling are implemented where necessary.
- Relevant tests pass.
- Code passes linting and formatting checks.
- Documentation and configuration are updated.
- No secrets are committed.
- Changes are reviewed before merging into the main branch.

---

## Sprint 0 — Requirements and Project Setup

**Goal:** Finalize the initial product requirements and establish the development environment.

### Checklist

- [ ] Confirm the studio's name, branding, and contact information.
- [ ] Confirm the initial service catalog.
- [ ] Record service prices and durations.
- [ ] Confirm whether customers can choose a specific nail technician.
- [x] Define staff working hours, breaks, and time-off rules. *Mon–Sat 08:00–20:00, Sunday closed. No fixed breaks; time off covers closures.*
- [ ] Define the cancellation and rescheduling policy.
- [x] Confirm the default timezone: `Africa/Nairobi`.
- [x] Confirm the default currency and price format.
- [ ] Decide the minimum customer contact details required for a booking.
- [ ] Confirm whether guest booking is the default.
- [ ] Decide the initial appointment scheduling increment.
- [ ] Define booking lead time and maximum advance-booking window.
- [x] Create the Git repository.
- [x] Initialize the pnpm workspace.
- [x] Configure Turborepo.
- [x] Configure TypeScript.
- [x] Configure Biome.
- [x] Add the initial README.
- [x] Add the architecture and product documentation.

> Status: tooling is done. Phone, email, the public area (Juja), and Mon–Sat 08:00–20:00 are confirmed. The apartment name stays off the public site. The accent colour and the other unticked business decisions still have proposed defaults in [BUSINESS_RULES.md](BUSINESS_RULES.md).

### Deliverables

- Working repository.
- Initial monorepo structure.
- Confirmed MVP requirements.
- Documented business rules.

### Acceptance criteria

- The development environment can install dependencies successfully.
- The repository structure is agreed upon.
- The core booking rules are documented.
- The Cloudflare-first architecture is confirmed.

---

## Sprint 1 — Monorepo, API, and Cloudflare Foundation

**Goal:** Establish the frontend, Hono API, and D1 development environment.

### Checklist

- [x] Create `apps/web`.
- [x] Create `apps/api`.
- [x] Configure React and Vite.
- [x] Configure Hono for Cloudflare Workers.
- [x] Configure the D1 binding in Wrangler.
- [x] Create the local D1 database configuration.
- [x] Add the initial D1 migration.
- [x] Select and configure Drizzle with D1 support, or implement a typed native D1 access layer.
- [x] Verify that database queries run locally.
- [x] Configure environment-variable validation.
- [x] Configure frontend-to-API communication.
- [x] Add a health-check endpoint.
- [x] Add centralized API error handling.
- [x] Add request validation using Zod.
- [x] Configure CORS for local development.
- [x] Add basic API tests.
- [x] Add root-level development scripts.
- [x] Verify the web application and API can run together.

### Suggested initial endpoints

- `GET /api/v1/health`
- `GET /api/v1/services`

### Deliverables

- React application running locally.
- Hono API running locally through Wrangler.
- D1 database accessible from the API.
- Initial migration workflow.
- Validated API response and error conventions.

### Acceptance criteria

- The frontend can successfully call the local API.
- The API can read from D1.
- Migrations can be applied to a clean development database.
- Secrets and production credentials are not required for local development.
- The health endpoint returns a valid response.

---

## Sprint 2 — Database Schema and Service Catalog

**Goal:** Implement the core database entities and public service catalog.

### Checklist

- [x] Define the `services` table.
- [x] Define the `staff` table.
- [x] Define the `staff_services` relationship.
- [x] Define the `staff_working_hours` table.
- [x] Define the `staff_time_off` table.
- [x] Define the `appointments` table.
- [x] Define the slot-reservation or equivalent conflict-prevention table.
- [x] Define the `gallery_images` table.
- [x] Define any required user and admin identity tables. *Better Auth `user`, `session`, `account`, `verification`, and `rate_limit`, plus `admins` and `audit_events`, added in Sprint 6.*
- [x] Add primary keys, foreign keys, unique constraints, and indexes.
- [x] Use integer minor units for monetary values.
- [x] Define the appointment status values.
- [x] Add service seed data for local development.
- [x] Implement service repository functions.
- [x] Implement `GET /api/v1/services`.
- [x] Implement `GET /api/v1/services/:id`.
- [x] Implement service validation. *Database CHECKs reject invalid rows. Admin service writes use Zod schemas.*
- [x] Build the public service catalog page.
- [x] Add service detail presentation. *Shown at the top of the booking page.*
- [x] Add loading, empty, and error states.
- [x] Test service retrieval and validation.

### Deliverables

- Initial database schema.
- Version-controlled migrations.
- Working service API.
- Public service catalog.

### Acceptance criteria

- Active services are returned to the public application.
- Inactive services are excluded from new booking options.
- Prices and durations are displayed correctly.
- Invalid service data cannot be saved.
- Existing appointments can preserve service snapshots.

---

## Sprint 3 — Public Website and Gallery

**Goal:** Build the public-facing studio experience.

### Checklist

- [x] Build the landing page. *Hero, wordmark, and service list on `/`.*
- [x] Add the studio branding and introduction.
- [x] Add the main booking call to action. *The hero jumps to the service list, and each service links to booking.*
- [x] Add featured services. *The home page lists the active catalog.*
- [x] Build the gallery page or section. *Published images on the home page. The section stays hidden when nothing is published.*
- [x] Implement `GET /api/v1/gallery`.
- [x] Add gallery metadata and publication status. *New uploads stay unpublished.*
- [x] Configure Cloudflare R2 for image storage, if included in this sprint. *Local `BUCKET` binding. No Cloudflare account is required for local development.*
- [x] Validate image file types and upload sizes. *JPEG, PNG, and WebP by magic bytes, 5 MB cap.*
- [x] Configure safe image delivery. *Public bytes only for published images. Admin preview is authenticated.*
- [x] Add contact and opening-hours information. *Public site shows Juja, hours, phone, WhatsApp, and email. The apartment name stays private.*
- [x] Add the cancellation policy and relevant booking guidance. *Shown on the booking form, the confirmation, and the manage page: cancel or move once until 24 hours before.*
- [ ] Ensure the interface is mobile-responsive.
- [ ] Add accessible navigation and focus states.
- [ ] Optimize image loading.
- [ ] Test the public pages on desktop and mobile viewports.

### Deliverables

- Public studio website.
- Service catalog integration.
- Gallery integration.
- Responsive navigation and booking entry point.

### Acceptance criteria

- Customers can explore the website on mobile and desktop.
- The booking action is easy to find.
- Only published gallery images are displayed.
- Failed image or API requests are handled gracefully.
- No privileged credentials are exposed in frontend code.

---

## Sprint 4 — Availability and Scheduling Engine

**Goal:** Calculate available appointment times based on service duration and staff schedules.

### Checklist

- [x] Implement staff service assignments.
- [x] Implement working-hours retrieval.
- [x] Implement staff time-off retrieval.
- [x] Define rules for breaks and studio closures. *Both are entered as staff time off.*
- [x] Implement the studio timezone conversion utilities.
- [x] Implement service-duration calculations.
- [x] Implement cleanup or turnaround buffers, if required.
- [x] Define the minimum booking lead time.
- [x] Define the maximum advance-booking window.
- [x] Implement availability generation.
- [x] Implement `GET /api/v1/availability`.
- [x] Validate requested service and staff identifiers. *Customers don't pick staff in the MVP, so the API validates the service and resolves eligible active staff itself.*
- [x] Exclude slots that cannot fit the full service duration.
- [x] Exclude slots blocked by existing appointments.
- [x] Exclude slots blocked by time off.
- [x] Implement the frontend date picker. *A month calendar (`DateCalendar`) on `/book/:serviceId` and on the manage page.*
- [x] Display available time slots.
- [x] Add a clear empty state when no slots are available.
- [x] Test availability at opening and closing boundaries.
- [x] Test appointments spanning multiple scheduling increments.
- [x] Test changes in staff schedules and time off.

### Deliverables

- Availability API.
- Scheduling calculation module.
- Date and time selection interface.

### Acceptance criteria

- The API returns only valid slots.
- Service duration and buffers are respected.
- Time off and existing appointments affect availability.
- All appointment times are interpreted consistently in `Africa/Nairobi`.
- Invalid or out-of-range dates are rejected.

---

## Sprint 5 — Booking Creation and Conflict Prevention

**Goal:** Complete the core customer booking journey and protect booking integrity.

### Checklist

- [x] Define the final booking request schema.
- [x] Validate customer contact information. *Name and a Kenyan phone number are required. Email is optional. A house call requires an address.*
- [x] Generate unique booking references.
- [x] Implement `POST /api/v1/bookings`.
- [x] Recheck availability when the booking is submitted.
- [x] Create appointment records with service snapshots.
- [x] Implement atomic slot reservations or the selected concurrency-control mechanism. *One D1 batch inserts the appointment and every `reservationSlots` row. The primary key `(staff_id, slot_start_at)` is the lock.*
- [x] Ensure a failed reservation cannot leave a partial booking.
- [x] Implement duplicate-submission protection. *`Idempotency-Key` returns the original booking. The same key with different details is rejected.*
- [x] Return a clear conflict response when a slot is taken.
- [x] Build the booking form.
- [x] Add customer details collection.
- [x] Add a booking review step if appropriate. *The form has an explicit Review step before submit. The confirmation screen appears after the booking is saved.*
- [x] Build the booking confirmation screen.
- [x] Display the booking reference and appointment summary.
- [x] Test invalid booking requests.
- [x] Test repeated submissions.
- [x] Test two simultaneous requests for the same slot.
- [x] Test overlapping appointments for the same staff member.
- [x] Test booking creation against a D1-compatible environment.
- [x] Document the concurrency guarantees of the chosen implementation. *See TECHNICAL_ARCHITECTURE.md, Concurrency strategy.*

### Critical technical requirement

**Do not release this sprint based only on sequential booking tests.**

The implementation must demonstrate that competing requests for the same staff member and time cannot both succeed.

If D1's supported write operations and constraints do not provide the required guarantee for the selected design, introduce a serialized booking coordinator before proceeding to production.

### Deliverables

- Complete customer booking flow.
- Booking creation API.
- Booking references.
- Conflict handling and automated tests.

### Acceptance criteria

- A valid booking is saved successfully.
- The customer receives a confirmation summary.
- Invalid requests are rejected.
- Conflicting requests cannot create overlapping reservations.
- Failed booking attempts do not leave partial reservations.
- Repeated requests do not unintentionally create duplicate bookings.

---

## Sprint 6 — Admin Authentication and Dashboard

**Goal:** Allow authorized administrators to manage bookings and studio information.

### Checklist

- [x] Select an authentication solution compatible with Workers and D1. *Better Auth, email and password, Drizzle adapter on D1.*
- [x] Add the admin identity and `audit_events` tables required by the chosen solution.
- [x] Configure secure sessions or the selected authentication mechanism. *HttpOnly, SameSite=Lax session cookie. Sign-in is rate limited in D1.*
- [x] Create the initial administrator account securely. *`pnpm admin:create` from environment variables. `pnpm admin:set-password` replaces it. Nothing hashed is committed.*
- [x] Ensure public registration cannot grant admin privileges. *HTTP sign-up is disabled, and a session still needs an `admins` row.*
- [x] Implement server-side admin authorization middleware.
- [x] Build the admin login page.
- [x] Build the admin dashboard layout.
- [x] Display upcoming appointments.
- [x] Add booking date filters.
- [x] Add booking status filters.
- [x] Build the booking detail view.
- [x] Implement permitted booking status changes.
- [x] Implement service creation.
- [x] Implement service updates and deactivation.
- [x] Implement staff management.
- [x] Implement staff-service assignments.
- [x] Implement working-hours management.
- [x] Implement time-off management.
- [x] Implement gallery management if not completed earlier.
- [x] Add audit events for important administrative actions.
- [x] Test unauthorized access to every protected route.
- [x] Test invalid and expired sessions.

### Deliverables

- Secure administrator login.
- Admin dashboard.
- Booking management.
- Service, staff, and schedule management.

### Acceptance criteria

- Unauthorized users cannot access administrative operations.
- Admin permissions are enforced by the API.
- Administrators can view and manage appointments.
- Invalid status changes are rejected.
- Schedule changes are reflected in availability calculations.
- Administrative operations provide clear success and error feedback.

---

## Sprint 7 — Customer Booking Management and Notifications

**Goal:** Let customers securely retrieve and manage bookings, with optional notification integration.

### Checklist

- [x] Define the secure booking lookup mechanism. *The reference plus `X-Booking-Token`. A missing booking, a missing token, and a wrong token return the same 401.*
- [x] Implement `GET /api/v1/bookings/:reference` with appropriate verification.
- [x] Implement booking cancellation.
- [x] Release slot reservations when a cancellation succeeds.
- [x] Validate cancellation against the studio policy. *Free until 24 hours before. Later customer cancellations are refused. There is no deposit to forfeit.*
- [x] Implement rescheduling if included in the release scope. *Once, until 24 hours before the current start. The new start must also be at least 24 hours away.*
- [x] Validate the new slot before rescheduling.
- [x] Ensure rescheduling cannot leave the appointment without a valid reservation. *One D1 batch. A slot conflict rolls the move back.*
- [x] Prevent unauthorized access using a booking reference alone.
- [x] Build the booking lookup interface. *`/manage`, and the confirmation link `/manage/:reference#token`.*
- [x] Build the cancellation confirmation flow.
- [x] Add customer-facing booking status messages.
- [x] Configure an email or SMS provider if selected. *Not selected. Confirmation stays on screen. Email and SMS remain Sprint 9.*
- [x] Send confirmations only after successful booking persistence. *The screen updates after the booking batch commits. No provider is called.*
- [x] Add notification failure handling. *Deferred to Sprint 9 with the provider. Nothing is sent, so a failure cannot change the booking.*
- [x] Add notification retry support if needed. *Deferred to Sprint 9.*
- [x] Test cancellation and reservation release.
- [x] Test rescheduling conflicts.
- [x] Test notification failure without corrupting booking state. *No provider is called. Booking writes stay in their own batch, which is what Sprint 9 must keep.*

### Deliverables

- Secure booking lookup.
- Booking cancellation.
- Rescheduling if included.
- Optional email or SMS notifications.

### Acceptance criteria

- Customers can manage only bookings they are authorized to access.
- Cancellation releases the relevant time slots.
- Rescheduling preserves booking integrity.
- Notification failures do not erase or duplicate valid appointments.
- The customer receives clear feedback for every action.

---

## Sprint 8 — Quality Assurance, Security, and Cloudflare Deployment

**Goal:** Prepare the system for production deployment and verify the complete booking journey.

### Checklist

#### Code quality

- [ ] Run the production frontend build.
- [ ] Run TypeScript checks.
- [ ] Run Biome linting.
- [ ] Run Biome formatting checks.
- [ ] Run unit tests.
- [ ] Run API integration tests.
- [ ] Run end-to-end tests.
- [ ] Remove unused code and debug logging.
- [ ] Review dependency versions and security advisories.

#### Security

- [ ] Verify admin authorization.
- [ ] Verify booking lookup authorization.
- [ ] Verify request validation.
- [ ] Verify database queries use safe parameterization.
- [ ] Configure production CORS.
- [ ] Add appropriate rate limits and anti-abuse controls.
- [ ] Review authentication and session security.
- [ ] Review file upload validation.
- [ ] Verify that secrets are not committed or exposed.
- [ ] Check logs for unnecessary personal information.

#### Cloudflare deployment

- [ ] Create the production D1 database.
- [ ] Configure production D1 bindings.
- [ ] Review and apply production migrations.
- [ ] Create and configure the R2 bucket if image storage is used.
- [ ] Configure Worker secrets.
- [ ] Configure the production frontend API URL.
- [ ] Deploy the Hono Worker.
- [ ] Deploy the frontend to the chosen Cloudflare-compatible hosting service.
- [ ] Configure production domains.
- [ ] Verify HTTPS and CORS.
- [ ] Verify API-to-D1 connectivity.
- [ ] Verify image delivery.
- [ ] Run the health check.
- [ ] Test a complete production booking.
- [ ] Test booking cancellation and reservation release.
- [ ] Run a controlled booking-conflict test.
- [ ] Document rollback and recovery procedures.

### Deliverables

- Production deployment.
- Passing automated tests.
- Security review.
- Documented deployment and smoke-test procedure.

### Acceptance criteria

- The deployed frontend and API communicate successfully.
- Production D1 migrations are applied correctly.
- Admin access is protected.
- The booking flow works in production.
- Booking conflicts are prevented by the verified implementation.
- Errors are logged without exposing secrets.
- Deployment and recovery steps are documented.

---

## Sprint 9 — Post-Launch Improvements

**Goal:** Add optional capabilities after the MVP is stable.

### Candidate tasks

- [ ] Integrate M-Pesa payments.
- [ ] Add payment status tracking.
- [ ] Add verified payment webhook handling.
- [ ] Add email confirmations.
- [ ] Add SMS confirmations and reminders.
- [ ] Add customer accounts.
- [ ] Add booking history.
- [ ] Add loyalty or referral functionality.
- [ ] Add discount codes.
- [ ] Add revenue and booking reports.
- [ ] Add staff-specific dashboards.
- [ ] Add multi-branch support.
- [ ] Evaluate Cloudflare Queues for background jobs.
- [ ] Evaluate Durable Objects for serialized booking operations if required.
- [ ] Evaluate a React Native/Expo mobile application.

### Acceptance criteria

- Each new feature has documented requirements.
- New functionality does not compromise booking integrity.
- Payments are verified server-side.
- Notifications are resilient to provider failures.
- New migrations are tested before production rollout.

---

## 10. Suggested Git Workflow

Use feature branches and small, reviewable changes.

Suggested branch names:

```text
main
feat/monorepo-setup
feat/cloudflare-d1
feat/service-catalog
feat/public-website
feat/availability-engine
feat/booking-flow
feat/admin-dashboard
feat/booking-management
feat/notifications
fix/booking-conflicts
```

### Example workflow

```bash
git checkout main
git pull origin main
git checkout -b feat/cloudflare-d1

# Make changes and run relevant tests.

git add .
git commit -m "feat: configure Cloudflare D1"
git push -u origin feat/cloudflare-d1
```

Open a pull request, review the changes, and merge only after the required checks pass.

Use the actual default branch configured in the repository. Do not assume that every repository uses `main`.

---

## 11. Final Release Checklist

### Product

- [ ] Public website is complete.
- [ ] Services and prices are accurate.
- [ ] Gallery content is approved.
- [ ] Booking flow is complete.
- [ ] Cancellation rules are visible.
- [ ] Admin dashboard is usable.
- [ ] Mobile experience has been tested.

### Backend and database

- [ ] D1 schema is version-controlled.
- [ ] Migrations have been tested.
- [ ] Booking conflict prevention is verified.
- [ ] Booking references are secure.
- [ ] Admin authorization is enforced.
- [ ] Input validation is implemented.
- [ ] Important errors are handled safely.

### Deployment

- [ ] Production Worker is deployed.
- [ ] Production D1 is configured.
- [ ] R2 is configured if required.
- [ ] Secrets are configured securely.
- [ ] Frontend and API domains are configured.
- [ ] HTTPS works.
- [ ] Production smoke tests pass.
- [ ] Recovery instructions are documented.

### Final sign-off

- [ ] Core automated tests pass.
- [ ] A customer can complete a booking.
- [ ] An administrator can manage the booking.
- [ ] A cancellation correctly releases availability.
- [ ] Conflicting booking requests are handled safely.
- [ ] No known release-blocking security issues remain.

**Release decision:** Ship the MVP only after the complete booking lifecycle and concurrency tests pass against a D1-compatible environment.

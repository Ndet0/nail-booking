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
- [ ] Define staff working hours, breaks, and time-off rules.
- [ ] Define the cancellation and rescheduling policy.
- [ ] Confirm the default timezone: `Africa/Nairobi`.
- [ ] Confirm the default currency and price format.
- [ ] Decide the minimum customer contact details required for a booking.
- [ ] Confirm whether guest booking is the default.
- [ ] Decide the initial appointment scheduling increment.
- [ ] Define booking lead time and maximum advance-booking window.
- [ ] Create the Git repository.
- [ ] Initialize the pnpm workspace.
- [ ] Configure Turborepo.
- [ ] Configure TypeScript.
- [ ] Configure Biome.
- [ ] Add the initial README.
- [ ] Add the architecture and product documentation.

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

- [ ] Create `apps/web`.
- [ ] Create `apps/api`.
- [ ] Configure React and Vite.
- [ ] Configure Hono for Cloudflare Workers.
- [ ] Configure the D1 binding in Wrangler.
- [ ] Create the local D1 database configuration.
- [ ] Add the initial D1 migration.
- [ ] Select and configure Drizzle with D1 support, or implement a typed native D1 access layer.
- [ ] Verify that database queries run locally.
- [ ] Configure environment-variable validation.
- [ ] Configure frontend-to-API communication.
- [ ] Add a health-check endpoint.
- [ ] Add centralized API error handling.
- [ ] Add request validation using Zod.
- [ ] Configure CORS for local development.
- [ ] Add basic API tests.
- [ ] Add root-level development scripts.
- [ ] Verify the web application and API can run together.

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

- [ ] Define the `services` table.
- [ ] Define the `staff` table.
- [ ] Define the `staff_services` relationship.
- [ ] Define the `staff_working_hours` table.
- [ ] Define the `staff_time_off` table.
- [ ] Define the `appointments` table.
- [ ] Define the slot-reservation or equivalent conflict-prevention table.
- [ ] Define the `gallery_images` table.
- [ ] Define any required user and admin identity tables.
- [ ] Add primary keys, foreign keys, unique constraints, and indexes.
- [ ] Use integer minor units for monetary values.
- [ ] Define the appointment status values.
- [ ] Add service seed data for local development.
- [ ] Implement service repository functions.
- [ ] Implement `GET /api/v1/services`.
- [ ] Implement `GET /api/v1/services/:id`.
- [ ] Implement service validation.
- [ ] Build the public service catalog page.
- [ ] Add service detail presentation.
- [ ] Add loading, empty, and error states.
- [ ] Test service retrieval and validation.

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

- [ ] Build the landing page.
- [ ] Add the studio branding and introduction.
- [ ] Add the main booking call to action.
- [ ] Add featured services.
- [ ] Build the gallery page or section.
- [ ] Implement `GET /api/v1/gallery`.
- [ ] Add gallery metadata and publication status.
- [ ] Configure Cloudflare R2 for image storage, if included in this sprint.
- [ ] Validate image file types and upload sizes.
- [ ] Configure safe image delivery.
- [ ] Add contact and opening-hours information.
- [ ] Add the cancellation policy and relevant booking guidance.
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

- [ ] Implement staff service assignments.
- [ ] Implement working-hours retrieval.
- [ ] Implement staff time-off retrieval.
- [ ] Define rules for breaks and studio closures.
- [ ] Implement the studio timezone conversion utilities.
- [ ] Implement service-duration calculations.
- [ ] Implement cleanup or turnaround buffers, if required.
- [ ] Define the minimum booking lead time.
- [ ] Define the maximum advance-booking window.
- [ ] Implement availability generation.
- [ ] Implement `GET /api/v1/availability`.
- [ ] Validate requested service and staff identifiers.
- [ ] Exclude slots that cannot fit the full service duration.
- [ ] Exclude slots blocked by existing appointments.
- [ ] Exclude slots blocked by time off.
- [ ] Implement the frontend date picker.
- [ ] Display available time slots.
- [ ] Add a clear empty state when no slots are available.
- [ ] Test availability at opening and closing boundaries.
- [ ] Test appointments spanning multiple scheduling increments.
- [ ] Test changes in staff schedules and time off.

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

- [ ] Define the final booking request schema.
- [ ] Validate customer contact information.
- [ ] Generate unique booking references.
- [ ] Implement `POST /api/v1/bookings`.
- [ ] Recheck availability when the booking is submitted.
- [ ] Create appointment records with service snapshots.
- [ ] Implement atomic slot reservations or the selected concurrency-control mechanism.
- [ ] Ensure a failed reservation cannot leave a partial booking.
- [ ] Implement duplicate-submission protection.
- [ ] Return a clear conflict response when a slot is taken.
- [ ] Build the booking form.
- [ ] Add customer details collection.
- [ ] Add a booking review step if appropriate.
- [ ] Build the booking confirmation screen.
- [ ] Display the booking reference and appointment summary.
- [ ] Test invalid booking requests.
- [ ] Test repeated submissions.
- [ ] Test two simultaneous requests for the same slot.
- [ ] Test overlapping appointments for the same staff member.
- [ ] Test booking creation against a D1-compatible environment.
- [ ] Document the concurrency guarantees of the chosen implementation.

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

- [ ] Select an authentication solution compatible with Workers and D1.
- [ ] Configure secure sessions or the selected authentication mechanism.
- [ ] Create the initial administrator account securely.
- [ ] Ensure public registration cannot grant admin privileges.
- [ ] Implement server-side admin authorization middleware.
- [ ] Build the admin login page.
- [ ] Build the admin dashboard layout.
- [ ] Display upcoming appointments.
- [ ] Add booking date filters.
- [ ] Add booking status filters.
- [ ] Build the booking detail view.
- [ ] Implement permitted booking status changes.
- [ ] Implement service creation.
- [ ] Implement service updates and deactivation.
- [ ] Implement staff management.
- [ ] Implement staff-service assignments.
- [ ] Implement working-hours management.
- [ ] Implement time-off management.
- [ ] Implement gallery management if not completed earlier.
- [ ] Add audit events for important administrative actions.
- [ ] Test unauthorized access to every protected route.
- [ ] Test invalid and expired sessions.

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

- [ ] Define the secure booking lookup mechanism.
- [ ] Implement `GET /api/v1/bookings/:reference` with appropriate verification.
- [ ] Implement booking cancellation.
- [ ] Release slot reservations when a cancellation succeeds.
- [ ] Validate cancellation against the studio policy.
- [ ] Implement rescheduling if included in the release scope.
- [ ] Validate the new slot before rescheduling.
- [ ] Ensure rescheduling cannot leave the appointment without a valid reservation.
- [ ] Prevent unauthorized access using a booking reference alone.
- [ ] Build the booking lookup interface.
- [ ] Build the cancellation confirmation flow.
- [ ] Add customer-facing booking status messages.
- [ ] Configure an email or SMS provider if selected.
- [ ] Send confirmations only after successful booking persistence.
- [ ] Add notification failure handling.
- [ ] Add notification retry support if needed.
- [ ] Test cancellation and reservation release.
- [ ] Test rescheduling conflicts.
- [ ] Test notification failure without corrupting booking state.

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

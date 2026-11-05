-- Local development seed for Chao's schedule. Does not modify services.
-- Hours confirmed in docs/BUSINESS_RULES.md §3:
-- Mon–Sat 08:00–20:00 Africa/Nairobi, Sunday closed. No fixed breaks.
-- weekday: 0 = Sunday … 6 = Saturday. start_time and end_time are local HH:MM, not UTC.
-- Re-running replaces Chao's staff row, hours, and service links. Bookings are cleared
-- first because they reference staff.

DELETE FROM appointment_slot_reservations;
DELETE FROM appointments;
DELETE FROM staff_working_hours;
DELETE FROM staff_time_off;
DELETE FROM staff_services;
DELETE FROM staff;

INSERT INTO staff (id, name, bio, is_active) VALUES
  ('staff_chao', 'Chao', 'Nail tech and makeup artist. Home studio and house calls.', 1);

INSERT INTO staff_working_hours (id, staff_id, weekday, start_time, end_time, effective_from, is_active) VALUES
  ('wh_chao_mon', 'staff_chao', 1, '08:00', '20:00', '2026-01-01', 1),
  ('wh_chao_tue', 'staff_chao', 2, '08:00', '20:00', '2026-01-01', 1),
  ('wh_chao_wed', 'staff_chao', 3, '08:00', '20:00', '2026-01-01', 1),
  ('wh_chao_thu', 'staff_chao', 4, '08:00', '20:00', '2026-01-01', 1),
  ('wh_chao_fri', 'staff_chao', 5, '08:00', '20:00', '2026-01-01', 1),
  ('wh_chao_sat', 'staff_chao', 6, '08:00', '20:00', '2026-01-01', 1);

INSERT INTO staff_services (staff_id, service_id)
SELECT 'staff_chao', id FROM services WHERE is_active = 1;

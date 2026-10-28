-- Local development seed. PLACEHOLDER prices and durations: to be confirmed by Chao.
-- Source: docs/BUSINESS_RULES.md §4. Prices are KES minor units (KES 1,500 = 150000).
-- Clear rows that reference services so this file can be re-run after the scheduling migration.
DELETE FROM appointment_slot_reservations;
DELETE FROM appointments;
DELETE FROM staff_services;
DELETE FROM services;

INSERT INTO services (id, slug, name, description, category, duration_minutes, price_minor, currency, is_active, display_order) VALUES
  ('svc_gel_polish',     'gel-polish',       'Gel Polish (Natural Nails)', 'Long-lasting gel colour on your natural nails, with cuticle care and shaping.', 'nails',  60,  150000, 'KES', 1, 10),
  ('svc_biab',           'biab-overlay',     'BIAB Overlay',               'Builder-in-a-bottle overlay to strengthen natural nails.',                       'nails',  75,  250000, 'KES', 1, 20),
  ('svc_acrylic_full',   'acrylic-full-set', 'Acrylic Full Set',           'Full set of acrylic extensions in your choice of shape and length.',            'nails', 120,  350000, 'KES', 1, 30),
  ('svc_gelx',           'gel-x-extensions', 'Gel-X Extensions',           'Soft-gel tip extensions for a lightweight, natural finish.',                    'nails',  90,  300000, 'KES', 1, 40),
  ('svc_refill',         'refill',           'Refill',                     'Infill for existing acrylic or gel extensions (up to 3 weeks).',                'nails',  75,  200000, 'KES', 1, 50),
  ('svc_removal',        'removal',          'Removal',                    'Safe soak-off removal of gel, acrylic or BIAB.',                                'nails',  30,   50000, 'KES', 1, 60),
  ('svc_nail_art',       'nail-art',         'Nail Art Add-on',            'Hand-painted designs, chrome, French tips or charms. Price varies by design.',  'nails',  30,   50000, 'KES', 1, 70),
  ('svc_pedicure',       'gel-pedicure',     'Gel Pedicure',               'Soak, scrub, cuticle care and gel colour on toes.',                             'nails',  75,  200000, 'KES', 1, 80),
  ('svc_soft_glam',      'soft-glam',        'Soft Glam Makeup',           'Natural, polished makeup for events and photos.',                               'makeup', 60,  250000, 'KES', 1, 90),
  ('svc_full_glam',      'full-glam',        'Full Glam / Bridal Trial',   'Full-coverage glam, including lashes. Also used as a bridal trial.',            'makeup', 90,  400000, 'KES', 1, 100),
  -- Inactive example: proves inactive services are hidden from the public catalog.
  ('svc_retired_example','retired-example',  'Retired Service (example)',  'Inactive seed row used to verify filtering.',                                    'nails',  30,   10000, 'KES', 0, 999);

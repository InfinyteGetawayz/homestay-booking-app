-- One-time migration for an already imported/live database.
-- Existing bookings, PIN, expenses, and properties are preserved.
START TRANSACTION;

UPDATE bookings
SET room_selection = REPLACE(REPLACE(REPLACE(REPLACE(room_selection, 'R1', 'Talung'), 'R2', 'Pandim'), 'R3', 'Kabru'), 'L1', 'Teesta');

UPDATE properties
SET rooms = JSON_ARRAY('Talung', 'Pandim', 'Kabru', 'Teesta')
WHERE id = 'KGH';

COMMIT;
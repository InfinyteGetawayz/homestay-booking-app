CREATE TABLE IF NOT EXISTS app_config (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rooms JSON NOT NULL,
  logo LONGTEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(50) PRIMARY KEY,
  description TEXT NOT NULL,
  expense_date DATE DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id VARCHAR(50) PRIMARY KEY,
  guest_name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  booking_date DATE DEFAULT NULL,
  type_of_booking VARCHAR(50) DEFAULT 'Stay',
  per_adult_tariff DECIMAL(10,2) NOT NULL DEFAULT 0,
  per_child_tariff DECIMAL(10,2) NOT NULL DEFAULT 0,
  number_adults INT NOT NULL DEFAULT 0,
  number_children_5_plus INT NOT NULL DEFAULT 0,
  number_children_under_5 INT NOT NULL DEFAULT 0,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  advance_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  room_selection TEXT NOT NULL,
  food_preference VARCHAR(100) DEFAULT 'Veg',
  dietary_restrictions TEXT DEFAULT '',
  special_request TEXT DEFAULT '',
  communication_transport VARCHAR(255) DEFAULT 'To Be Arranged',
  b2b_agency_name VARCHAR(255) DEFAULT '',
  settlement VARCHAR(50) DEFAULT 'No',
  payment_status VARCHAR(50) DEFAULT 'Pending',
  muted_reminders TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_nights INT NOT NULL DEFAULT 0,
  total_pax INT NOT NULL DEFAULT 0,
  total_adult_tariff DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_child_tariff DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_tariff DECIMAL(10,2) NOT NULL DEFAULT 0,
  pending_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  fooding_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  lodging_total DECIMAL(10,2) NOT NULL DEFAULT 0
);

INSERT INTO app_config (`key`, `value`) VALUES
  ('pin_hash', ''),
  ('globalMuteReminders', '0')
ON DUPLICATE KEY UPDATE `key` = `key`;

INSERT INTO properties (id, name, rooms) VALUES
  ('KGH', 'Kanchan Ghar Homestay', JSON_ARRAY('Talung', 'Pandim', 'Kabru', 'Teesta')),
  ('MBH', 'Mungpoo Bliss Homestay', JSON_ARRAY('FR', 'FL', 'BL', 'BR'))
ON DUPLICATE KEY UPDATE id = id;

-- Run once on the existing cPanel database.
ALTER TABLE properties
  ADD COLUMN food_adult_tariff DECIMAL(10,2) NOT NULL DEFAULT 400,
  ADD COLUMN food_child_tariff DECIMAL(10,2) NOT NULL DEFAULT 200;
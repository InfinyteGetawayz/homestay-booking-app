-- Run once on the existing cPanel database before using logo upload.
ALTER TABLE properties ADD COLUMN logo LONGTEXT DEFAULT NULL;
-- Phase 5: add per-user settings columns to users table.
ALTER TABLE users ADD COLUMN language      TEXT    NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN accent_colour TEXT    NOT NULL DEFAULT 'lichen' CHECK (accent_colour IN ('lichen', 'coral', 'ocean', 'amber', 'iris', 'slate'));
ALTER TABLE users ADD COLUMN sound_on      INTEGER NOT NULL DEFAULT 1;

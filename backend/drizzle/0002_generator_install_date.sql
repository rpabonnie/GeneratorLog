-- Add installed_at to generators for accurate first oil change calculation.
-- NULL means the user hasn't set an installation date; the system will fall
-- back to createdAt when computing time-based reminders.

ALTER TABLE "generators" ADD COLUMN IF NOT EXISTS "installed_at" timestamp;

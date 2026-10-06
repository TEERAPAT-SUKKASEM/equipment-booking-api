-- Removes all data so that db/schema.sql can recreate a clean, seeded database.
-- Used by "npm run db:reset". Dropping a table also drops its indexes.
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS equipment;

-- Migration 002: Add performance and lookup indexes for events and organizer queries
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

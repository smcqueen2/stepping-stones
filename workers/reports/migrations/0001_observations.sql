CREATE TABLE observations (
  id TEXT PRIMARY KEY NOT NULL,
  condition INTEGER NOT NULL CHECK (condition BETWEEN 0 AND 4),
  received_at INTEGER NOT NULL,
  reporter_hash TEXT NOT NULL
);
CREATE INDEX observations_received_at ON observations(received_at);
CREATE INDEX observations_reporter_time ON observations(reporter_hash, received_at);

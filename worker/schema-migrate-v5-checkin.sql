-- 扫描签到：活动区域 + 实名签到记录
CREATE TABLE IF NOT EXISTS checkin_events (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL,
  owner_id TEXT NOT NULL,
  owner_phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkin_events_owner ON checkin_events(owner_id);

CREATE TABLE IF NOT EXISTS checkin_records (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  real_name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  distance_meters INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_records_name ON checkin_records(event_id, real_name);

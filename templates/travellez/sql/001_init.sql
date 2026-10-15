-- Each signed-in account is its own company workspace (owner_id = the user's id).
CREATE TABLE travelers (
  id INTEGER PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX travelers_owner ON travelers (owner_id);

CREATE TABLE trips (
  id INTEGER PRIMARY KEY,
  owner_id TEXT NOT NULL,
  traveler_id INTEGER NOT NULL REFERENCES travelers(id),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  return_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  estimate INTEGER NOT NULL CHECK (estimate >= 0),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'booked', 'rejected', 'cancelled')),
  over_policy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (return_date >= departure_date)
);
CREATE INDEX trips_owner ON trips (owner_id, status);

CREATE TABLE approvals (
  id INTEGER PRIMARY KEY,
  owner_id TEXT NOT NULL,
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX approvals_owner ON approvals (owner_id, status);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  owner_id TEXT NOT NULL,
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL CHECK (category IN ('flight', 'hotel', 'ground', 'meals', 'other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'paid')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX expenses_owner ON expenses (owner_id, status);

CREATE TABLE policies (
  owner_id TEXT PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'EUR',
  trip_cap INTEGER NOT NULL DEFAULT 1500,
  hotel_night_cap INTEGER NOT NULL DEFAULT 180,
  advance_days INTEGER NOT NULL DEFAULT 7,
  require_approval_above INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  team_size TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

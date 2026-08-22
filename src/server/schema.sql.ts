export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  hub TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  billing_rate_inr INTEGER NOT NULL,
  classification TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT NOT NULL,
  openings INTEGER NOT NULL,
  target_closure_date TEXT NOT NULL,
  skills_json TEXT NOT NULL,
  hiring_manager TEXT NOT NULL,
  recruiter_owner TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  stage TEXT NOT NULL,
  source_type TEXT NOT NULL,
  consultancy_name TEXT,
  referred_by TEXT,
  notice_period_days INTEGER NOT NULL,
  current_ctc_lpa REAL NOT NULL,
  expected_ctc_lpa REAL NOT NULL,
  experience_years REAL NOT NULL,
  skills_json TEXT NOT NULL,
  location TEXT NOT NULL,
  client_approval_status TEXT NOT NULL,
  reject_reason TEXT,
  reject_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  at TEXT NOT NULL,
  by_name TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email_normalized);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_candidates_job ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_events_candidate ON events(candidate_id);
`;

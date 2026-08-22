import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { SEED_CANDIDATES, SEED_EVENTS, SEED_JOBS, DEMO_USERS } from "@/data/seed";
import { normalizeEmail, normalizePhone } from "@/lib/domain";
import { SCHEMA_SQL } from "./schema.sql";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ats.db");

let db: Database.Database | null = null;

function migrate(database: Database.Database) {
  database.exec(SCHEMA_SQL);
}

function seed(database: Database.Database) {
  const existing = database.prepare("SELECT COUNT(*) AS n FROM users").get() as {
    n: number;
  };
  if (existing.n > 0) return;

  const passwordHash = bcrypt.hashSync("demo", 10);
  const insertUser = database.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, hub)
     VALUES (@id, @name, @email, @password_hash, @role, @hub)`
  );
  const insertJob = database.prepare(
    `INSERT INTO jobs (
      id, title, client_name, project_name, billing_rate_inr, classification,
      status, location, openings, target_closure_date, skills_json,
      hiring_manager, recruiter_owner, notes, created_at
    ) VALUES (
      @id, @title, @client_name, @project_name, @billing_rate_inr, @classification,
      @status, @location, @openings, @target_closure_date, @skills_json,
      @hiring_manager, @recruiter_owner, @notes, @created_at
    )`
  );
  const insertCandidate = database.prepare(
    `INSERT INTO candidates (
      id, full_name, email, phone, email_normalized, phone_normalized, job_id,
      stage, source_type, consultancy_name, referred_by, notice_period_days,
      current_ctc_lpa, expected_ctc_lpa, experience_years, skills_json, location,
      client_approval_status, reject_reason, reject_notes, created_at, updated_at
    ) VALUES (
      @id, @full_name, @email, @phone, @email_normalized, @phone_normalized, @job_id,
      @stage, @source_type, @consultancy_name, @referred_by, @notice_period_days,
      @current_ctc_lpa, @expected_ctc_lpa, @experience_years, @skills_json, @location,
      @client_approval_status, @reject_reason, @reject_notes, @created_at, @updated_at
    )`
  );
  const insertEvent = database.prepare(
    `INSERT INTO events (id, candidate_id, from_stage, to_stage, at, by_name, note)
     VALUES (@id, @candidate_id, @from_stage, @to_stage, @at, @by_name, @note)`
  );

  const tx = database.transaction(() => {
    for (const user of DEMO_USERS) {
      insertUser.run({
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase(),
        password_hash: passwordHash,
        role: user.role,
        hub: user.hub,
      });
    }
    for (const job of SEED_JOBS) {
      insertJob.run({
        id: job.id,
        title: job.title,
        client_name: job.clientName,
        project_name: job.projectName,
        billing_rate_inr: job.billingRateInr,
        classification: job.classification,
        status: job.status,
        location: job.location,
        openings: job.openings,
        target_closure_date: job.targetClosureDate,
        skills_json: JSON.stringify(job.skills),
        hiring_manager: job.hiringManager,
        recruiter_owner: job.recruiterOwner,
        notes: job.notes,
        created_at: job.createdAt,
      });
    }
    for (const candidate of SEED_CANDIDATES) {
      insertCandidate.run({
        id: candidate.id,
        full_name: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone,
        email_normalized: normalizeEmail(candidate.email),
        phone_normalized: normalizePhone(candidate.phone),
        job_id: candidate.jobId,
        stage: candidate.stage,
        source_type: candidate.sourceType,
        consultancy_name: candidate.consultancyName ?? null,
        referred_by: candidate.referredBy ?? null,
        notice_period_days: candidate.noticePeriodDays,
        current_ctc_lpa: candidate.currentCtcLpa,
        expected_ctc_lpa: candidate.expectedCtcLpa,
        experience_years: candidate.experienceYears,
        skills_json: JSON.stringify(candidate.skills),
        location: candidate.location,
        client_approval_status: candidate.clientApprovalStatus,
        reject_reason: candidate.rejectReason ?? null,
        reject_notes: candidate.rejectNotes ?? null,
        created_at: candidate.createdAt,
        updated_at: candidate.updatedAt,
      });
    }
    for (const event of SEED_EVENTS) {
      insertEvent.run({
        id: event.id,
        candidate_id: event.candidateId,
        from_stage: event.fromStage,
        to_stage: event.toStage,
        at: event.at,
        by_name: event.by,
        note: event.note ?? null,
      });
    }
  });

  tx();
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

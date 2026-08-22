import { getDb } from "./db";
import { nextPrefixedId, today } from "./ids";
import { toJob, type JobRow } from "./mappers";
import type { JobRequisition } from "@/lib/types";

export function listJobs() {
  const rows = getDb()
    .prepare("SELECT * FROM jobs ORDER BY created_at DESC, id DESC")
    .all() as JobRow[];
  return rows.map(toJob);
}

export function getJob(id: string) {
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | JobRow
    | undefined;
  return row ? toJob(row) : null;
}

export function createJob(
  input: Omit<JobRequisition, "id" | "createdAt">
) {
  const db = getDb();
  const id = nextPrefixedId(db, "jobs", "JOB");
  const createdAt = today();
  db.prepare(
    `INSERT INTO jobs (
      id, title, client_name, project_name, billing_rate_inr, classification,
      status, location, openings, target_closure_date, skills_json,
      hiring_manager, recruiter_owner, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.clientName,
    input.projectName,
    input.billingRateInr,
    input.classification,
    input.status,
    input.location,
    input.openings,
    input.targetClosureDate,
    JSON.stringify(input.skills),
    input.hiringManager,
    input.recruiterOwner,
    input.notes,
    createdAt
  );
  return getJob(id)!;
}

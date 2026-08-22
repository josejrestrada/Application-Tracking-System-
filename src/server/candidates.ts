import {
  canAdvanceToOffered,
  findDuplicates,
  nextActiveStage,
} from "@/lib/domain";
import type {
  Candidate,
  ClientApprovalStatus,
  PipelineStage,
  RejectReasonCode,
} from "@/lib/types";
import { getDb } from "./db";
import { nextPrefixedId, today } from "./ids";
import {
  candidateLookup,
  toCandidate,
  toEvent,
  type CandidateRow,
  type EventRow,
} from "./mappers";

function listCandidateRows() {
  return getDb()
    .prepare("SELECT * FROM candidates ORDER BY updated_at DESC, id DESC")
    .all() as CandidateRow[];
}

export function listCandidates() {
  return listCandidateRows().map(toCandidate);
}

export function listEvents() {
  const rows = getDb()
    .prepare("SELECT * FROM events ORDER BY at DESC, id DESC")
    .all() as EventRow[];
  return rows.map(toEvent);
}

export function getCandidate(id: string) {
  const row = getDb()
    .prepare("SELECT * FROM candidates WHERE id = ?")
    .get(id) as CandidateRow | undefined;
  return row ? toCandidate(row) : null;
}

function appendEvent(
  candidateId: string,
  fromStage: PipelineStage | null,
  toStage: PipelineStage,
  by: string,
  note?: string
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO events (id, candidate_id, from_stage, to_stage, at, by_name, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    nextPrefixedId(db, "events", "EVT"),
    candidateId,
    fromStage,
    toStage,
    today(),
    by,
    note ?? null
  );
}

export function findDuplicateMatches(
  email: string,
  phone: string,
  excludeId?: string
) {
  return findDuplicates(listCandidates(), email, phone, excludeId);
}

export function createCandidate(
  input: Omit<
    Candidate,
    "id" | "createdAt" | "updatedAt" | "clientApprovalStatus"
  >,
  by: string
) {
  const db = getDb();
  const job = db.prepare("SELECT id FROM jobs WHERE id = ?").get(input.jobId);
  if (!job) throw new Error("Job requisition not found.");

  const id = nextPrefixedId(db, "candidates", "CAN");
  const created = today();
  const lookup = candidateLookup(input.email, input.phone);
  db.prepare(
    `INSERT INTO candidates (
      id, full_name, email, phone, email_normalized, phone_normalized, job_id,
      stage, source_type, consultancy_name, referred_by, notice_period_days,
      current_ctc_lpa, expected_ctc_lpa, experience_years, skills_json, location,
      client_approval_status, reject_reason, reject_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)`
  ).run(
    id,
    input.fullName,
    input.email,
    input.phone,
    lookup.emailNormalized,
    lookup.phoneNormalized,
    input.jobId,
    input.stage || "applied",
    input.sourceType,
    input.consultancyName ?? null,
    input.referredBy ?? null,
    input.noticePeriodDays,
    input.currentCtcLpa,
    input.expectedCtcLpa,
    input.experienceYears,
    JSON.stringify(input.skills),
    input.location,
    created,
    created
  );
  appendEvent(id, null, input.stage || "applied", by, "Profile created");
  return {
    candidate: getCandidate(id)!,
    duplicates: findDuplicateMatches(input.email, input.phone, id),
  };
}

export function moveCandidate(
  id: string,
  toStage: PipelineStage,
  by: string,
  note?: string
) {
  const candidate = getCandidate(id);
  if (!candidate) return { ok: false as const, error: "Candidate not found." };
  if (candidate.stage === toStage) return { ok: true as const, candidate };

  if (toStage === "offered" && candidate.stage === "client_round" && !canAdvanceToOffered(candidate)) {
    return {
      ok: false as const,
      error: "Client Approval Status must be Approved before moving to Offered.",
    };
  }

  const resetApproval =
    toStage === "client_round" && candidate.stage !== "client_round";
  getDb()
    .prepare(
      `UPDATE candidates
       SET stage = ?, updated_at = ?, client_approval_status = ?
       WHERE id = ?`
    )
    .run(
      toStage,
      today(),
      resetApproval ? "pending" : candidate.clientApprovalStatus,
      id
    );
  appendEvent(id, candidate.stage, toStage, by, note);
  return { ok: true as const, candidate: getCandidate(id)! };
}

export function advanceCandidate(id: string, by: string) {
  const candidate = getCandidate(id);
  if (!candidate) return { ok: false as const, error: "Candidate not found." };
  const next = nextActiveStage(candidate.stage);
  if (!next) return { ok: false as const, error: "No further active stage." };
  if (next === "offered" && !canAdvanceToOffered(candidate)) {
    return {
      ok: false as const,
      error: "Client Approval Status must be Approved before Offered.",
    };
  }
  return moveCandidate(id, next, by, `Advanced to ${next}`);
}

export function setClientApproval(
  id: string,
  status: ClientApprovalStatus,
  by: string
) {
  const candidate = getCandidate(id);
  if (!candidate) return { ok: false as const, error: "Candidate not found." };
  if (candidate.stage !== "client_round") {
    return {
      ok: false as const,
      error: "Client approval applies during Client Round.",
    };
  }

  if (status === "rejected") {
    getDb()
      .prepare(
        `UPDATE candidates
         SET client_approval_status = ?, stage = 'rejected',
             reject_reason = 'client_rejected', updated_at = ?
         WHERE id = ?`
      )
      .run(status, today(), id);
    appendEvent(id, candidate.stage, "rejected", by, "Client approval: rejected");
  } else {
    getDb()
      .prepare(
        `UPDATE candidates SET client_approval_status = ?, updated_at = ? WHERE id = ?`
      )
      .run(status, today(), id);
    appendEvent(id, candidate.stage, candidate.stage, by, `Client approval: ${status}`);
  }

  return { ok: true as const, candidate: getCandidate(id)! };
}

export function exitPipeline(
  id: string,
  toStage: "rejected" | "dropped_out",
  reason: RejectReasonCode,
  notes: string,
  by: string
) {
  const candidate = getCandidate(id);
  if (!candidate) return { ok: false as const, error: "Candidate not found." };
  getDb()
    .prepare(
      `UPDATE candidates
       SET stage = ?, reject_reason = ?, reject_notes = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(toStage, reason, notes, today(), id);
  appendEvent(id, candidate.stage, toStage, by, notes);
  return { ok: true as const, candidate: getCandidate(id)! };
}

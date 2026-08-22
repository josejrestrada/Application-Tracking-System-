import { normalizeEmail, normalizePhone } from "@/lib/domain";
import type {
  Candidate,
  JobRequisition,
  SessionUser,
  StageEvent,
} from "@/lib/types";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: SessionUser["role"];
  hub: SessionUser["hub"];
};

export type JobRow = {
  id: string;
  title: string;
  client_name: string;
  project_name: string;
  billing_rate_inr: number;
  classification: JobRequisition["classification"];
  status: JobRequisition["status"];
  location: JobRequisition["location"];
  openings: number;
  target_closure_date: string;
  skills_json: string;
  hiring_manager: string;
  recruiter_owner: string;
  notes: string;
  created_at: string;
};

export type CandidateRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  email_normalized: string;
  phone_normalized: string;
  job_id: string;
  stage: Candidate["stage"];
  source_type: Candidate["sourceType"];
  consultancy_name: string | null;
  referred_by: string | null;
  notice_period_days: number;
  current_ctc_lpa: number;
  expected_ctc_lpa: number;
  experience_years: number;
  skills_json: string;
  location: Candidate["location"];
  client_approval_status: Candidate["clientApprovalStatus"];
  reject_reason: Candidate["rejectReason"] | null;
  reject_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  candidate_id: string;
  from_stage: StageEvent["fromStage"];
  to_stage: StageEvent["toStage"];
  at: string;
  by_name: string;
  note: string | null;
};

export function toUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    hub: row.hub,
  };
}

export function toJob(row: JobRow): JobRequisition {
  return {
    id: row.id,
    title: row.title,
    clientName: row.client_name,
    projectName: row.project_name,
    billingRateInr: row.billing_rate_inr,
    classification: row.classification,
    status: row.status,
    location: row.location,
    openings: row.openings,
    targetClosureDate: row.target_closure_date,
    skills: JSON.parse(row.skills_json),
    hiringManager: row.hiring_manager,
    recruiterOwner: row.recruiter_owner,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function toCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    jobId: row.job_id,
    stage: row.stage,
    sourceType: row.source_type,
    consultancyName: row.consultancy_name ?? undefined,
    referredBy: row.referred_by ?? undefined,
    noticePeriodDays: row.notice_period_days,
    currentCtcLpa: row.current_ctc_lpa,
    expectedCtcLpa: row.expected_ctc_lpa,
    experienceYears: row.experience_years,
    skills: JSON.parse(row.skills_json),
    location: row.location,
    clientApprovalStatus: row.client_approval_status,
    rejectReason: row.reject_reason ?? undefined,
    rejectNotes: row.reject_notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toEvent(row: EventRow): StageEvent {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    at: row.at,
    by: row.by_name,
    note: row.note ?? undefined,
  };
}

export function candidateLookup(email: string, phone: string) {
  return {
    emailNormalized: normalizeEmail(email),
    phoneNormalized: normalizePhone(phone),
  };
}

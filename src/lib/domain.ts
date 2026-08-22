import type {
  ActivePipelineStage,
  Candidate,
  JobRequisition,
  PipelineStage,
} from "./types";

export const ACTIVE_STAGES: ActivePipelineStage[] = [
  "applied",
  "screened",
  "internal_interview",
  "client_round",
  "offered",
  "bgv",
  "joined",
];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  applied: "Applied",
  screened: "Screened",
  internal_interview: "Internal Interview",
  client_round: "Client Round",
  offered: "Offered",
  bgv: "BGV",
  joined: "Joined",
  rejected: "Rejected",
  dropped_out: "Dropped Out",
};

export const SOURCE_LABEL: Record<Candidate["sourceType"], string> = {
  linkedin: "LinkedIn",
  naukri: "Naukri",
  employee_referral: "Employee Referral",
  direct: "Direct",
  consultancy: "Consultancy",
};

export const CLASSIFICATION_LABEL: Record<
  JobRequisition["classification"],
  string
> = {
  project_specific: "Project-Specific",
  bench_hiring: "Bench Hiring",
};

export const REJECT_REASON_LABEL: Record<
  NonNullable<Candidate["rejectReason"]>,
  string
> = {
  notice_period_too_long: "Notice period too long",
  tech_evaluation_failed: "Tech evaluation failed",
  ctc_mismatch: "CTC mismatch",
  client_rejected: "Client rejected",
  candidate_withdrew: "Candidate withdrew",
  duplicate_profile: "Duplicate profile",
  other: "Other",
};

export function isTerminal(stage: PipelineStage) {
  return stage === "rejected" || stage === "dropped_out";
}

export function nextActiveStage(
  stage: PipelineStage
): ActivePipelineStage | null {
  if (isTerminal(stage) || stage === "joined") return null;
  const idx = ACTIVE_STAGES.indexOf(stage as ActivePipelineStage);
  return ACTIVE_STAGES[idx + 1] ?? null;
}

export function canAdvanceToOffered(candidate: Candidate) {
  if (candidate.stage !== "client_round") return true;
  return candidate.clientApprovalStatus === "approved";
}

export function daysUntil(isoDate: string, now = new Date()) {
  const target = new Date(`${isoDate}T00:00:00`);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function isNoticePeriodRisk(
  candidate: Candidate,
  job: JobRequisition | undefined,
  now = new Date()
) {
  if (!job || job.status === "closed") return false;
  if (isTerminal(candidate.stage) || candidate.stage === "joined") return false;
  return candidate.noticePeriodDays > 60 && daysUntil(job.targetClosureDate, now) < 21;
}

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatLpa(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} LPA`;
}

export function sourceDisplay(candidate: Candidate) {
  if (candidate.sourceType === "consultancy") {
    return candidate.consultancyName
      ? `Consultancy · ${candidate.consultancyName}`
      : "Consultancy";
  }
  if (candidate.sourceType === "employee_referral") {
    return candidate.referredBy
      ? `Referral · ${candidate.referredBy}`
      : "Employee Referral";
  }
  return SOURCE_LABEL[candidate.sourceType];
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^91/, "").slice(-10);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type DuplicateMatch = {
  candidate: Candidate;
  field: "email" | "phone";
};

export function findDuplicates(
  candidates: Candidate[],
  email: string,
  phone: string,
  excludeId?: string
): DuplicateMatch[] {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  const matches: DuplicateMatch[] = [];
  for (const c of candidates) {
    if (c.id === excludeId) continue;
    if (e && normalizeEmail(c.email) === e) matches.push({ candidate: c, field: "email" });
    if (p.length === 10 && normalizePhone(c.phone) === p) {
      matches.push({ candidate: c, field: "phone" });
    }
  }
  return matches;
}

export type UserRole = "head_of_ta" | "recruiter" | "hiring_manager";

export type HubLocation = "Pune" | "Bangalore" | "Goa";

export type JobClassification = "project_specific" | "bench_hiring";

export type JobStatus = "open" | "on_hold" | "closed";

export type ActivePipelineStage =
  | "applied"
  | "screened"
  | "internal_interview"
  | "client_round"
  | "offered"
  | "bgv"
  | "joined";

export type TerminalStage = "rejected" | "dropped_out";

export type PipelineStage = ActivePipelineStage | TerminalStage;

export type ClientApprovalStatus = "pending" | "approved" | "rejected";

export type CandidateSourceType =
  | "linkedin"
  | "naukri"
  | "employee_referral"
  | "direct"
  | "consultancy";

export type RejectReasonCode =
  | "notice_period_too_long"
  | "tech_evaluation_failed"
  | "ctc_mismatch"
  | "client_rejected"
  | "candidate_withdrew"
  | "duplicate_profile"
  | "other";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hub: HubLocation;
}

export interface JobRequisition {
  id: string;
  title: string;
  clientName: string;
  projectName: string;
  billingRateInr: number;
  classification: JobClassification;
  status: JobStatus;
  location: HubLocation;
  openings: number;
  targetClosureDate: string;
  skills: string[];
  hiringManager: string;
  recruiterOwner: string;
  notes: string;
  createdAt: string;
}

export interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  jobId: string;
  stage: PipelineStage;
  sourceType: CandidateSourceType;
  consultancyName?: string;
  referredBy?: string;
  noticePeriodDays: number;
  currentCtcLpa: number;
  expectedCtcLpa: number;
  experienceYears: number;
  skills: string[];
  location: HubLocation;
  clientApprovalStatus: ClientApprovalStatus;
  rejectReason?: RejectReasonCode;
  rejectNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StageEvent {
  id: string;
  candidateId: string;
  fromStage: PipelineStage | null;
  toStage: PipelineStage;
  at: string;
  by: string;
  note?: string;
}

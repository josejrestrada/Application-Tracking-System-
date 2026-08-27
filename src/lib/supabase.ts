export { supabase } from './supabaseClient';

/** Candidate row plus per-job applications (job title, stage, notice cap). */
export const CANDIDATE_JOB_SELECT =
  '*, applications(id, job_id, stage, recruiter_name, offered_ctc, expected_joining_date, rejection_reason, jobs(title, max_notice_period_days))';
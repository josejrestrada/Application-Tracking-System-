import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Candidate row plus per-job applications (job title, stage, notice cap). */
export const CANDIDATE_JOB_SELECT =
  '*, applications(id, job_id, stage, recruiter_name, offered_ctc, expected_joining_date, rejection_reason, jobs(title, max_notice_period_days))';
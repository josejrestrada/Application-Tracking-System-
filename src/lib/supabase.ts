import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Embed the assigned requisition via assigned_job_id (not an inferred jobs(*) join). */
export const CANDIDATE_JOB_SELECT =
  '*, jobs:assigned_job_id(id, title, max_notice_period_days)';
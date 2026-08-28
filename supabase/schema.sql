-- Run in Supabase Dashboard → project ruqlnwckqgmbqkfpedws → SQL Editor → New query → Run.
-- Then Table Editor should list: projects, jobs, candidates, applications, interviews, candidate_activities.

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  project_name text not null,
  target_start_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_id uuid references public.projects(id) on delete set null,
  max_notice_period_days integer,
  open_positions integer,
  required_skills text[],
  min_experience_years numeric,
  max_experience_years numeric,
  min_ctc numeric,
  max_ctc numeric,
  location text,
  assigned_recruiter_id text,
  assigned_recruiter_name text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text unique,
  phone text,
  notice_period_days integer,
  current_ctc numeric,
  expected_ctc numeric,
  source_type text,
  agency_name text,
  agency_fee_pct numeric,
  agency_fee_amount numeric,
  current_company text,
  total_experience_years numeric,
  skills text[],
  assigned_recruiter_id text,
  assigned_recruiter_name text,
  status text,
  resume_url text,
  dpdp_consent_given boolean,
  dpdp_consent_timestamp timestamptz,
  retention_expiry_date timestamptz,
  bgv_status text,
  bgv_vendor_name text,
  bgv_remarks text,
  bgv_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  recruiter_id text,
  recruiter_name text,
  stage text,
  offered_ctc numeric,
  expected_joining_date date,
  rejection_reason text,
  offer_drop_risk text,
  created_at timestamptz not null default now()
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  round_name text,
  interviewer_names text,
  scheduled_at timestamptz,
  meeting_link text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_activities (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  recruiter_id text,
  recruiter_name text,
  created_by text,
  activity_type text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.interviews enable row level security;
alter table public.candidate_activities enable row level security;

-- Create policies without DROP (SQL Editor blocks destructive statements).
do $$
declare t text;
begin
  foreach t in array array[
    'projects','jobs','candidates','applications','interviews','candidate_activities'
  ]
  loop
    begin
      execute format(
        'create policy ats_anon_all on public.%I
           for all to anon, authenticated
           using (true) with check (true);',
        t
      );
    exception
      when duplicate_object then
        null;
    end;
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

notify pgrst, 'reload schema';

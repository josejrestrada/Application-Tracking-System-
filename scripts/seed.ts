import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { calcAgencyFeeAmount } from '../src/lib/agency';

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  const text = readFileSync(envPath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value.trim();
  }
}

async function insertOne<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  row: T
) {
  const { data, error } = await supabase.from(table).insert([row]).select('id').single();
  if (error || !data?.id) {
    const message = error?.message || 'missing id';
    if (/row-level security/i.test(message)) {
      throw new Error(
        `${table} insert blocked by RLS. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API) and run npm run seed again.`
      );
    }
    throw new Error(`${table} insert failed: ${message}`);
  }
  return data.id as string;
}

async function insertActivity(
  supabase: SupabaseClient,
  row: {
    candidate_id: string;
    recruiter_id: string;
    created_by: string;
    activity_type: string;
    notes: string;
  }
) {
  const withCreatedBy = await supabase.from('candidate_activities').insert([row]).select('id').single();
  if (!withCreatedBy.error && withCreatedBy.data?.id) return withCreatedBy.data.id as string;
  if (withCreatedBy.error && /created_by/i.test(withCreatedBy.error.message)) {
    const { created_by: _createdBy, ...rest } = row;
    return insertOne(supabase, 'candidate_activities', rest);
  }
  throw new Error(`candidate_activities insert failed: ${withCreatedBy.error?.message || 'missing id'}`);
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function dateOnly(days: number) {
  return daysFromNow(days).slice(0, 10);
}

async function main() {
  loadEnvLocal();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    console.error(
      '⚠️ Supabase environment variables are missing! Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
    process.exit(1);
  }

  const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const supabase = createClient(url, key);
  const recruiterId = 'seed-recruiter';
  const recruiterName = 'Priya Shah';

  console.log(`Seeding Meridian ATS (${usingServiceRole ? 'service role' : 'anon key'})...`);

  const hdfc = await insertOne(supabase, 'projects', {
    client_name: 'HDFC Bank',
    project_name: 'Payments Modernization',
    target_start_date: dateOnly(21),
  });
  const infosys = await insertOne(supabase, 'projects', {
    client_name: 'Infosys',
    project_name: 'Cloud Migration Pod',
    target_start_date: dateOnly(45),
  });

  const javaJob = await insertOne(supabase, 'jobs', {
    title: 'Senior Java Backend Engineer',
    project_id: hdfc,
    max_notice_period_days: 30,
    open_positions: 3,
    required_skills: ['Java', 'Spring Boot', 'Kafka'],
    min_experience_years: 5,
    max_experience_years: 10,
    min_ctc: 18,
    max_ctc: 28,
    location: 'Pune',
    assigned_recruiter_id: recruiterId,
    assigned_recruiter_name: recruiterName,
    status: 'open',
  });
  const reactJob = await insertOne(supabase, 'jobs', {
    title: 'React Frontend Engineer',
    project_id: hdfc,
    max_notice_period_days: 15,
    open_positions: 2,
    required_skills: ['React', 'TypeScript', 'Tailwind'],
    min_experience_years: 3,
    max_experience_years: 7,
    min_ctc: 12,
    max_ctc: 20,
    location: 'Bangalore',
    assigned_recruiter_id: recruiterId,
    assigned_recruiter_name: recruiterName,
    status: 'open',
  });
  const devopsJob = await insertOne(supabase, 'jobs', {
    title: 'DevOps Engineer',
    project_id: infosys,
    max_notice_period_days: 60,
    open_positions: 1,
    required_skills: ['AWS', 'Kubernetes', 'Terraform'],
    min_experience_years: 4,
    max_experience_years: 9,
    min_ctc: 16,
    max_ctc: 24,
    location: 'Goa / Hybrid',
    assigned_recruiter_id: recruiterId,
    assigned_recruiter_name: recruiterName,
    status: 'open',
  });

  type SeedCandidate = {
    profile: Record<string, unknown>;
    jobId: string;
    stage: string;
    extras?: Record<string, unknown>;
    interview?: Record<string, unknown> | null;
  };

  const agencyPct = 8.33;
  const agencyCtc = 24;
  const candidates: SeedCandidate[] = [
    {
      profile: {
        full_name: 'Ananya Iyer',
        email: 'ananya.iyer.seed@meridian.test',
        phone: '9876500001',
        notice_period_days: 15,
        current_ctc: 16,
        expected_ctc: agencyCtc,
        source_type: 'Staffing Agency',
        agency_name: 'Hudson RPO',
        agency_fee_pct: agencyPct,
        agency_fee_amount: calcAgencyFeeAmount(agencyCtc, agencyPct),
        current_company: 'TCS',
        total_experience_years: 7,
        skills: ['Java', 'Spring Boot', 'Kafka'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-10),
        retention_expiry_date: daysFromNow(120),
        bgv_status: 'In Progress',
        bgv_vendor_name: 'AuthBridge',
        bgv_remarks: 'Employment check pending.',
      },
      jobId: javaJob,
      stage: 'Offered',
      extras: {
        offered_ctc: 24,
        expected_joining_date: dateOnly(20),
        offer_drop_risk: 'High',
      },
      interview: {
        round_name: 'HR Round',
        interviewer_names: 'Neha Kulkarni, HRBP',
        scheduled_at: daysFromNow(3),
        meeting_link: 'https://meet.google.com/seed-ananya',
        notes: 'Offer discussion.',
      },
    },
    {
      profile: {
        full_name: 'Rohan Mehta',
        email: 'rohan.mehta.seed@meridian.test',
        phone: '9876500002',
        notice_period_days: 30,
        current_ctc: 14,
        expected_ctc: 18,
        source_type: 'Staffing Agency',
        agency_name: 'TeamLease',
        agency_fee_pct: 8.33,
        agency_fee_amount: calcAgencyFeeAmount(18, 8.33),
        current_company: 'Wipro',
        total_experience_years: 5.5,
        skills: ['Java', 'Microservices'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-40),
        retention_expiry_date: daysFromNow(8),
        bgv_status: 'Cleared',
        bgv_vendor_name: 'OnGrid',
        bgv_remarks: 'All checks green.',
        bgv_completed_at: daysFromNow(-2),
      },
      jobId: javaJob,
      stage: 'Joined',
      extras: {
        offered_ctc: 18,
        expected_joining_date: dateOnly(-5),
      },
      interview: null,
    },
    {
      profile: {
        full_name: 'Sana Qureshi',
        email: 'sana.qureshi.seed@meridian.test',
        phone: '9876500003',
        notice_period_days: 7,
        current_ctc: 11,
        expected_ctc: 15,
        source_type: 'LinkedIn',
        current_company: 'Freshworks',
        total_experience_years: 4,
        skills: ['React', 'TypeScript', 'Tailwind'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-5),
        retention_expiry_date: daysFromNow(175),
        bgv_status: 'Pending',
        bgv_vendor_name: 'SpringVerify',
      },
      jobId: reactJob,
      stage: 'Client Round',
      interview: {
        round_name: 'Client Interview',
        interviewer_names: 'Arjun Mehta, Lead Architect',
        scheduled_at: daysFromNow(2),
        meeting_link: 'https://teams.microsoft.com/l/meetup-join/seed-sana',
        notes: 'Bring portfolio.',
      },
    },
    {
      profile: {
        full_name: 'Vikram Nair',
        email: 'vikram.nair.seed@meridian.test',
        phone: '9876500004',
        notice_period_days: 60,
        current_ctc: 20,
        expected_ctc: 26,
        source_type: 'Naukri',
        current_company: 'Accenture',
        total_experience_years: 8,
        skills: ['AWS', 'Kubernetes', 'Terraform'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-20),
        retention_expiry_date: daysFromNow(-3),
        bgv_status: 'Failed',
        bgv_vendor_name: 'AuthBridge',
        bgv_remarks: 'Address mismatch.',
        bgv_completed_at: daysFromNow(-1),
      },
      jobId: devopsJob,
      stage: 'Rejected',
      extras: { rejection_reason: 'Technical Fail' },
      interview: null,
    },
    {
      profile: {
        full_name: 'Meera Joshi',
        email: 'meera.joshi.seed@meridian.test',
        phone: '9876500005',
        notice_period_days: 0,
        current_ctc: 9,
        expected_ctc: 13,
        source_type: 'Referral',
        current_company: 'Persistent',
        total_experience_years: 3,
        skills: ['React', 'JavaScript'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-2),
        retention_expiry_date: daysFromNow(178),
        bgv_status: 'Pending',
      },
      jobId: reactJob,
      stage: 'Applied',
      interview: null,
    },
    {
      profile: {
        full_name: 'Karthik Rao',
        email: 'karthik.rao.seed@meridian.test',
        phone: '9876500006',
        notice_period_days: 45,
        current_ctc: 17,
        expected_ctc: 22,
        source_type: 'Career Site',
        current_company: 'L&T Infotech',
        total_experience_years: 6,
        skills: ['Java', 'SQL', 'Redis'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-15),
        retention_expiry_date: daysFromNow(160),
        bgv_status: 'In Progress',
        bgv_vendor_name: 'OnGrid',
      },
      jobId: javaJob,
      stage: 'BGV',
      interview: {
        round_name: 'L1 Technical',
        interviewer_names: 'Suresh Patil, Principal Engineer',
        scheduled_at: daysFromNow(-4),
        meeting_link: 'https://meet.google.com/seed-karthik',
        notes: 'Completed. Move to BGV.',
      },
    },
    {
      profile: {
        full_name: 'Divya Menon',
        email: 'divya.menon.seed@meridian.test',
        phone: '9876500007',
        notice_period_days: 20,
        current_ctc: 12,
        expected_ctc: 16,
        source_type: 'LinkedIn',
        current_company: 'Zoho',
        total_experience_years: 4.5,
        skills: ['React', 'GraphQL'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-8),
        retention_expiry_date: daysFromNow(12),
        bgv_status: 'Pending',
      },
      jobId: reactJob,
      stage: 'Screened',
      interview: {
        round_name: 'System Design',
        interviewer_names: 'Arjun Mehta, Lead Architect',
        scheduled_at: daysFromNow(6),
        meeting_link: 'https://meet.google.com/seed-divya',
        notes: 'Frontend architecture round.',
      },
    },
    {
      profile: {
        full_name: 'Amit Kulkarni',
        email: 'amit.kulkarni.seed@meridian.test',
        phone: '9876500008',
        notice_period_days: 90,
        current_ctc: 19,
        expected_ctc: 25,
        source_type: 'Naukri',
        current_company: 'Capgemini',
        total_experience_years: 9,
        skills: ['AWS', 'CI/CD', 'Python'],
        assigned_recruiter_id: recruiterId,
        assigned_recruiter_name: recruiterName,
        status: 'Sourced',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: daysFromNow(-30),
        retention_expiry_date: daysFromNow(150),
        bgv_status: 'Pending',
      },
      jobId: devopsJob,
      stage: 'Internal Interview',
      interview: {
        round_name: 'L1 Technical',
        interviewer_names: 'Ritu Desai, SRE Manager',
        scheduled_at: daysFromNow(-1),
        meeting_link: 'https://meet.google.com/seed-amit',
        notes: 'Infra design.',
      },
    },
  ];

  for (const seed of candidates) {
    const email = String(seed.profile.email);
    const { data: existing } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    const candidateId =
      existing?.id || (await insertOne(supabase, 'candidates', seed.profile));

    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)
      .eq('job_id', seed.jobId)
      .maybeSingle();
    if (!existingApp?.id) {
      await insertOne(supabase, 'applications', {
        candidate_id: candidateId,
        job_id: seed.jobId,
        recruiter_id: recruiterId,
        recruiter_name: recruiterName,
        stage: seed.stage,
        ...(seed.extras || {}),
      });
    }

    if (seed.interview) {
      await insertOne(supabase, 'interviews', {
        candidate_id: candidateId,
        job_id: seed.jobId,
        ...seed.interview,
      });
    }

    await insertActivity(supabase, {
      candidate_id: candidateId,
      recruiter_id: recruiterId,
      created_by: recruiterName,
      activity_type: 'Stage Changed',
      notes: `Moved stage to ${seed.stage}`,
    });
    if (seed.interview) {
      await insertActivity(supabase, {
        candidate_id: candidateId,
        recruiter_id: recruiterId,
        created_by: recruiterName,
        activity_type: 'Interview Scheduled',
        notes: `${seed.interview.round_name} on ${seed.interview.scheduled_at}`,
      });
    }
    if (seed.profile.bgv_status && seed.profile.bgv_status !== 'Pending') {
      await insertActivity(supabase, {
        candidate_id: candidateId,
        recruiter_id: recruiterId,
        created_by: recruiterName,
        activity_type: 'BGV Status Changed',
        notes: String(seed.profile.bgv_status),
      });
    }
  }

  console.log('Seed complete: 2 projects, 3 jobs, 8 candidates with applications, interviews, and activity.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

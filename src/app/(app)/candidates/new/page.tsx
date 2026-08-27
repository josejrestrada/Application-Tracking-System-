'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { CANDIDATE_JOB_SELECT, supabase } from '@/lib/supabase';
import { retentionExpiryFromCreatedAt } from '@/lib/dpdp';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AlertCircle, UserCheck } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  max_notice_period_days: number;
}

type CandidateRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notice_period_days: number | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  assigned_job_id: string | null;
  assigned_recruiter_name: string | null;
  status: string | null;
  created_at?: string | null;
  jobs?: { id: string; title: string } | { id: string; title: string }[] | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function digitsPhone(value: string) {
  return value.replace(/\D/g, '').replace(/^91/, '').slice(-10);
}

function phonesMatch(stored: string | null | undefined, input: string) {
  const a = digitsPhone(stored || '');
  const b = digitsPhone(input);
  return a.length >= 10 && a === b;
}

function jobTitleFromCandidate(candidate: CandidateRecord) {
  const jobs = candidate.jobs;
  if (Array.isArray(jobs)) return jobs[0]?.title;
  return jobs?.title;
}

function collisionMessage(candidate: CandidateRecord, jobTitle?: string) {
  const title = jobTitle || jobTitleFromCandidate(candidate) || 'this position';
  const recruiter = candidate.assigned_recruiter_name || 'System';
  return `COLLISION PREVENTED: Candidate "${candidate.full_name}" is ALREADY assigned to "${title}" by recruiter "${recruiter}". Select a different position.`;
}

async function findExistingByEmailOrPhone(email: string, phone: string) {
  const emailNorm = normalizeEmail(email);
  const phoneTrim = phone.trim();
  const lookups: Promise<{ data: CandidateRecord[] | null }>[] = [];

  if (emailNorm.length >= 5) {
    lookups.push(
      supabase
        .from('candidates')
        .select(CANDIDATE_JOB_SELECT)
        .ilike('email', emailNorm)
        .limit(5)
        .then(({ data, error }) => {
          if (error) throw error;
          return { data: (data as CandidateRecord[]) || [] };
        })
    );
  }

  if (phoneTrim.length >= 5) {
    lookups.push(
      supabase
        .from('candidates')
        .select(CANDIDATE_JOB_SELECT)
        .eq('phone', phoneTrim)
        .limit(5)
        .then(({ data, error }) => {
          if (error) throw error;
          return { data: (data as CandidateRecord[]) || [] };
        })
    );
  }

  if (lookups.length === 0) return { match: null as CandidateRecord | null, conflict: null as string | null };

  const results = await Promise.all(lookups);
  const byId = new Map<string, CandidateRecord>();
  for (const result of results) {
    for (const row of result.data || []) {
      byId.set(row.id, row);
    }
  }

  const matches = [...byId.values()].filter((row) => {
    const emailHit = emailNorm.length >= 5 && normalizeEmail(row.email || '') === emailNorm;
    const phoneHit = phonesMatch(row.phone, phoneTrim);
    return emailHit || phoneHit;
  });

  if (matches.length === 0) return { match: null, conflict: null };

  const emailMatch = matches.find((row) => normalizeEmail(row.email || '') === emailNorm);
  const phoneMatch = matches.find((row) => phonesMatch(row.phone, phoneTrim));
  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    return {
      match: null,
      conflict: `Email matches "${emailMatch.full_name}" but phone matches "${phoneMatch.full_name}". Resolve the contact details before saving.`,
    };
  }

  return { match: emailMatch || phoneMatch || matches[0], conflict: null };
}

export default function NewCandidatePage() {
  const { user } = useUser();
  const router = useRouter();

  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    notice_period_days: '',
    current_ctc: '',
    expected_ctc: '',
    source_type: 'Naukri',
    agency_fee_pct: '8.33',
    assigned_job_id: '',
  });

  const [existingCandidate, setExistingCandidate] = useState<CandidateRecord | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobConflict, setJobConflict] = useState<string | null>(null);
  const [dpdpConsent, setDpdpConsent] = useState(false);

  // Fetch active open jobs from Supabase
  useEffect(() => {
    async function fetchJobs() {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, max_notice_period_days')
        .eq('status', 'open');
      setAvailableJobs(data || []);
    }
    fetchJobs();
  }, []);

  const applyCollision = (candidate: CandidateRecord | null, jobId: string) => {
    if (candidate && jobId && candidate.assigned_job_id === jobId) {
      const jobTitle = availableJobs.find((j) => j.id === jobId)?.title;
      setJobConflict(collisionMessage(candidate, jobTitle));
      return true;
    }
    setJobConflict(null);
    return false;
  };

  const checkDuplicateCandidate = async (nextEmail: string, nextPhone: string) => {
    if (normalizeEmail(nextEmail).length < 5 && nextPhone.trim().length < 5) return;
    setChecking(true);

    try {
      const { match, conflict } = await findExistingByEmailOrPhone(nextEmail, nextPhone);
      if (conflict) {
        setExistingCandidate(null);
        setJobConflict(conflict);
        return;
      }

      setExistingCandidate(match);
      if (match) {
        setFormData((prev) => ({
          ...prev,
          full_name: match.full_name || prev.full_name,
          notice_period_days: match.notice_period_days?.toString() || prev.notice_period_days,
          current_ctc: match.current_ctc?.toString() || prev.current_ctc,
          expected_ctc: match.expected_ctc?.toString() || prev.expected_ctc,
        }));
        applyCollision(match, formData.assigned_job_id);
      } else {
        setJobConflict(null);
      }
    } catch (err) {
      console.error(err);
      setJobConflict('Unable to check existing candidates. Try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleJobSelect = (jobId: string) => {
    setFormData((prev) => ({ ...prev, assigned_job_id: jobId }));
    applyCollision(existingCandidate, jobId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jobConflict) return;
    setSubmitting(true);

    try {
      const { match, conflict } = await findExistingByEmailOrPhone(formData.email, formData.phone);
      if (conflict) {
        setJobConflict(conflict);
        setSubmitting(false);
        return;
      }

      if (match && formData.assigned_job_id && match.assigned_job_id === formData.assigned_job_id) {
        applyCollision(match, formData.assigned_job_id);
        setExistingCandidate(match);
        setSubmitting(false);
        return;
      }

      const profile = {
        full_name: formData.full_name,
        email: normalizeEmail(formData.email),
        phone: formData.phone.trim(),
        notice_period_days: parseInt(formData.notice_period_days, 10) || 0,
        current_ctc: parseFloat(formData.current_ctc) || 0,
        expected_ctc: parseFloat(formData.expected_ctc) || 0,
        source_type: formData.source_type,
        agency_fee_pct: parseFloat(formData.agency_fee_pct) || 8.33,
        assigned_job_id: formData.assigned_job_id || null,
        assigned_recruiter_id: user?.id,
        assigned_recruiter_name:
          user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Recruiter',
        dpdp_consent_given: true,
        dpdp_consent_timestamp: new Date().toISOString(),
        retention_expiry_date: retentionExpiryFromCreatedAt(match?.created_at),
      };

      let error;

      if (match) {
        const { error: updateError } = await supabase
          .from('candidates')
          .update(profile)
          .eq('id', match.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('candidates').insert([
          { ...profile, status: 'Sourced' },
        ]);
        error = insertError;
      }

      if (error) {
        alert('Error saving candidate: ' + error.message);
        setSubmitting(false);
        return;
      }

      router.push('/candidates');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error saving candidate.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Candidate Intake & Position Mapping</h1>
        <p className="text-sm text-gray-600 mb-6">
          Enter candidate contact details to check existing profiles and prevent recruiter collision.
        </p>

        {/* Existing Candidate Banner */}
        {existingCandidate && (
          <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-md">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-900">
                Existing Profile Found: {existingCandidate.full_name}
              </h3>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Currently assigned job: <span className="font-bold">{jobTitleFromCandidate(existingCandidate) || 'Unassigned / Open Pool'}</span> 
              {' '}(Assigned Recruiter: {existingCandidate.assigned_recruiter_name || 'Unassigned'})
            </p>
          </div>
        )}

        {/* Job Collision Warning Banner */}
        {jobConflict && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-800">Recruiter Collision Warning</h3>
              <p className="text-sm text-red-700 mt-1">{jobConflict}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                required
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onBlur={(e) => checkDuplicateCandidate(e.target.value, formData.phone)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                onBlur={(e) => checkDuplicateCandidate(formData.email, e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              required
              className="mt-1 block w-full border rounded-md p-2 text-black"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-bold text-blue-900">Assign to Active Job Position</label>
            <select
              className="mt-1 block w-full border rounded-md p-2 text-black bg-blue-50/30"
              value={formData.assigned_job_id}
              onChange={(e) => handleJobSelect(e.target.value)}
            >
              <option value="">-- Select Open Job (Optional) --</option>
              {availableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} (Max Notice: {job.max_notice_period_days} Days)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Notice Period (Days)</label>
              <input
                type="number"
                required
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.notice_period_days}
                onChange={(e) => setFormData({ ...formData, notice_period_days: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Current CTC (LPA)</label>
              <input
                type="number"
                step="0.1"
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.current_ctc}
                onChange={(e) => setFormData({ ...formData, current_ctc: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Expected CTC (LPA)</label>
              <input
                type="number"
                step="0.1"
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.expected_ctc}
                onChange={(e) => setFormData({ ...formData, expected_ctc: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Sourcing Channel</label>
              <select
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.source_type}
                onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
              >
                <option value="Naukri">Naukri</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Referral">Referral</option>
                <option value="Staffing Agency">Staffing Agency</option>
                <option value="Career Site">Career Site</option>
              </select>
            </div>

            {formData.source_type === 'Staffing Agency' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Agency Fee (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full border rounded-md p-2 text-black"
                  value={formData.agency_fee_pct}
                  onChange={(e) => setFormData({ ...formData, agency_fee_pct: e.target.value })}
                />
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
            <input
              type="checkbox"
              required
              checked={dpdpConsent}
              onChange={(e) => setDpdpConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              I confirm candidate consent has been collected for processing personal data under
              India DPDP Act 2023.
            </span>
          </label>

          <button
            type="submit"
            disabled={!!jobConflict || submitting || checking || !dpdpConsent}
            className={`w-full py-3 px-4 text-white font-bold rounded-md transition ${
              jobConflict ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? 'Processing...' : existingCandidate ? 'Re-assign Candidate' : 'Add Candidate'}
          </button>
        </form>
      </div>
    </div>
  );
}
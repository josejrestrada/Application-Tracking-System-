'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { CANDIDATE_JOB_SELECT, supabase } from '@/lib/supabase';
import { retentionExpiryFromCreatedAt } from '@/lib/dpdp';
import { calcAgencyFeeAmount, formatFeeLpa } from '@/lib/agency';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AlertCircle, UserCheck } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  max_notice_period_days: number;
}

type ApplicationRow = {
  job_id: string;
  stage?: string | null;
  recruiter_name?: string | null;
  jobs?: { title?: string; max_notice_period_days?: number | null } | { title?: string; max_notice_period_days?: number | null }[] | null;
};

type CandidateRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notice_period_days: number | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  assigned_recruiter_name: string | null;
  status: string | null;
  created_at?: string | null;
  current_company?: string | null;
  total_experience_years?: number | null;
  skills?: string[] | null;
  source_type?: string | null;
  agency_name?: string | null;
  agency_fee_pct?: number | null;
  agency_fee_amount?: number | null;
  applications?: ApplicationRow[] | null;
};

function jobEmbed(job: ApplicationRow['jobs']) {
  if (Array.isArray(job)) return job[0];
  return job ?? undefined;
}

function applicationJobTitle(row: ApplicationRow) {
  return jobEmbed(row.jobs)?.title;
}

async function fetchApplicationsForCandidate(candidateId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('job_id, stage, recruiter_name, jobs(title)')
    .eq('candidate_id', candidateId);
  if (error) throw error;
  return (data as ApplicationRow[]) || [];
}

function collidingApplications(existing: ApplicationRow[], selectedJobIds: string[]) {
  const selected = new Set(selectedJobIds);
  return existing.filter((row) => selected.has(row.job_id));
}

function collisionMessage(candidate: CandidateRecord, collisions: ApplicationRow[]) {
  const names = collisions
    .map((row) => applicationJobTitle(row) || row.job_id)
    .join(', ');
  const recruiter = collisions[0]?.recruiter_name || candidate.assigned_recruiter_name || 'System';
  return `COLLISION PREVENTED: "${candidate.full_name}" has already applied to ${names} (recruiter: ${recruiter}). Deselect those jobs to continue.`;
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function skillsToInput(skills?: string[] | null) {
  return (skills || []).join(', ');
}

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

function isAllowedResume(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx');
}

function uniqueResumePath(file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}-${safeName}`;
}

async function uploadResume(file: File) {
  if (!isAllowedResume(file)) {
    throw new Error('Resume must be a PDF, DOC, or DOCX file.');
  }
  const path = uniqueResumePath(file);
  const { error } = await supabase.storage.from('resumes').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('resumes').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Unable to resolve public resume URL.');
  return data.publicUrl;
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
    agency_name: '',
    agency_fee_pct: '8.33',
    current_company: '',
    total_experience_years: '',
    skills: '',
  });
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [existingApplications, setExistingApplications] = useState<ApplicationRow[]>([]);

  const [existingCandidate, setExistingCandidate] = useState<CandidateRecord | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobConflict, setJobConflict] = useState<string | null>(null);
  const [dpdpConsent, setDpdpConsent] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

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

  const applyCollision = (candidate: CandidateRecord | null, applications: ApplicationRow[], jobIds: string[]) => {
    if (!candidate || jobIds.length === 0) {
      setJobConflict(null);
      return false;
    }
    const collisions = collidingApplications(applications, jobIds);
    if (collisions.length > 0) {
      setJobConflict(collisionMessage(candidate, collisions));
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
        setExistingApplications([]);
        setJobConflict(conflict);
        return;
      }

      setExistingCandidate(match);
      if (match) {
        const applications = await fetchApplicationsForCandidate(match.id);
        setExistingApplications(applications);
        setFormData((prev) => ({
          ...prev,
          full_name: match.full_name || prev.full_name,
          notice_period_days: match.notice_period_days?.toString() || prev.notice_period_days,
          current_ctc: match.current_ctc?.toString() || prev.current_ctc,
          expected_ctc: match.expected_ctc?.toString() || prev.expected_ctc,
          current_company: match.current_company || prev.current_company,
          source_type: match.source_type || prev.source_type,
          agency_name: match.agency_name || prev.agency_name,
          agency_fee_pct:
            match.agency_fee_pct != null ? String(match.agency_fee_pct) : prev.agency_fee_pct,
          total_experience_years:
            match.total_experience_years?.toString() || prev.total_experience_years,
          skills: match.skills?.length ? skillsToInput(match.skills) : prev.skills,
        }));
        applyCollision(match, applications, selectedJobIds);
      } else {
        setExistingApplications([]);
        setJobConflict(null);
      }
    } catch (err) {
      console.error(err);
      setJobConflict('Unable to check existing candidates. Try again.');
    } finally {
      setChecking(false);
    }
  };

  const toggleJob = (jobId: string) => {
    const next = selectedJobIds.includes(jobId)
      ? selectedJobIds.filter((id) => id !== jobId)
      : [...selectedJobIds, jobId];
    setSelectedJobIds(next);
    applyCollision(existingCandidate, existingApplications, next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jobConflict) return;
    if (selectedJobIds.length === 0) {
      setJobConflict('Select at least one open job to create an application.');
      return;
    }
    setSubmitting(true);

    try {
      const { match, conflict } = await findExistingByEmailOrPhone(formData.email, formData.phone);
      if (conflict) {
        setJobConflict(conflict);
        setSubmitting(false);
        return;
      }

      let applications: ApplicationRow[] = [];
      if (match) {
        applications = await fetchApplicationsForCandidate(match.id);
        setExistingApplications(applications);
        if (applyCollision(match, applications, selectedJobIds)) {
          setExistingCandidate(match);
          setSubmitting(false);
          return;
        }
      }

      const recruiterName =
        user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Recruiter';
      let resumeUrl: string | null = null;
      if (resumeFile) {
        resumeUrl = await uploadResume(resumeFile);
      }
      const expectedCtc = parseFloat(formData.expected_ctc) || 0;
      const isAgency = formData.source_type === 'Staffing Agency';
      const agencyFeePct = isAgency ? parseFloat(formData.agency_fee_pct) || 8.33 : null;
      const agencyName = isAgency ? formData.agency_name.trim() : '';
      if (isAgency && !agencyName) {
        alert('Enter the staffing agency name.');
        setSubmitting(false);
        return;
      }
      const profile = {
        full_name: formData.full_name,
        email: normalizeEmail(formData.email),
        phone: formData.phone.trim(),
        notice_period_days: parseInt(formData.notice_period_days, 10) || 0,
        current_ctc: parseFloat(formData.current_ctc) || 0,
        expected_ctc: expectedCtc,
        source_type: formData.source_type,
        agency_name: isAgency ? agencyName : null,
        agency_fee_pct: agencyFeePct,
        agency_fee_amount: isAgency ? calcAgencyFeeAmount(expectedCtc, agencyFeePct || 0) : null,
        current_company: formData.current_company.trim() || null,
        total_experience_years: parseFloat(formData.total_experience_years) || 0,
        skills: splitCsv(formData.skills),
        assigned_recruiter_id: user?.id,
        assigned_recruiter_name: recruiterName,
        dpdp_consent_given: true,
        dpdp_consent_timestamp: new Date().toISOString(),
        retention_expiry_date: retentionExpiryFromCreatedAt(match?.created_at),
        ...(resumeUrl ? { resume_url: resumeUrl } : {}),
      };

      let candidateId = match?.id;

      if (match) {
        const { error: updateError } = await supabase
          .from('candidates')
          .update(profile)
          .eq('id', match.id);
        if (updateError) {
          alert('Error saving candidate: ' + updateError.message);
          setSubmitting(false);
          return;
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('candidates')
          .insert([{ ...profile, status: 'Sourced' }])
          .select('id')
          .single();
        if (insertError || !inserted) {
          alert('Error saving candidate: ' + (insertError?.message || 'Missing candidate id.'));
          setSubmitting(false);
          return;
        }
        candidateId = inserted.id;
      }

      const alreadyApplied = new Set(applications.map((row) => row.job_id));
      const newJobIds = selectedJobIds.filter((id) => !alreadyApplied.has(id));
      if (newJobIds.length > 0 && candidateId) {
        const { error: appError } = await supabase.from('applications').insert(
          newJobIds.map((jobId) => ({
            candidate_id: candidateId,
            job_id: jobId,
            recruiter_id: user?.id,
            recruiter_name: recruiterName,
            stage: 'Applied',
          }))
        );
        if (appError) {
          alert('Candidate saved, but applications failed: ' + appError.message);
          setSubmitting(false);
          return;
        }
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
              Existing applications:{' '}
              <span className="font-bold">
                {existingApplications.length > 0
                  ? existingApplications.map((row) => applicationJobTitle(row) || row.job_id).join(', ')
                  : 'None yet'}
              </span>
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
            <p className="block text-sm font-bold text-blue-900">Apply to open job positions</p>
            <p className="text-xs text-gray-500 mt-1 mb-2">Select one or more roles. Duplicate applications to the same job are blocked.</p>
            <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/30 p-3 max-h-56 overflow-y-auto">
              {availableJobs.length === 0 ? (
                <p className="text-sm text-gray-500">No open jobs. Create a role under Projects & Jobs first.</p>
              ) : (
                availableJobs.map((job) => {
                  const alreadyApplied = existingApplications.some((row) => row.job_id === job.id);
                  return (
                    <label key={job.id} className="flex items-start gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={selectedJobIds.includes(job.id)}
                        onChange={() => toggleJob(job.id)}
                        className="mt-0.5"
                      />
                      <span>
                        {job.title} (Max Notice: {job.max_notice_period_days} Days)
                        {alreadyApplied && (
                          <span className="ml-2 text-xs font-semibold text-red-700">Already applied</span>
                        )}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
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
              <label className="block text-sm font-medium text-gray-700">Current company</label>
              <input
                type="text"
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.current_company}
                onChange={(e) => setFormData({ ...formData, current_company: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total experience (years)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                className="mt-1 block w-full border rounded-md p-2 text-black"
                value={formData.total_experience_years}
                onChange={(e) => setFormData({ ...formData, total_experience_years: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Skills (comma-separated)</label>
            <input
              type="text"
              placeholder="Java, Spring Boot, Kafka"
              className="mt-1 block w-full border rounded-md p-2 text-black"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Resume Upload</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
            <p className="mt-1 text-xs text-gray-500">PDF, DOC, or DOCX. Stored in the resumes bucket.</p>
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
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Agency name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hudson RPO"
                    className="mt-1 block w-full border rounded-md p-2 text-black"
                    value={formData.agency_name}
                    onChange={(e) => setFormData({ ...formData, agency_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Agency Fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    className="mt-1 block w-full border rounded-md p-2 text-black"
                    value={formData.agency_fee_pct}
                    onChange={(e) => setFormData({ ...formData, agency_fee_pct: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Fee amount:{' '}
                    {formatFeeLpa(
                      calcAgencyFeeAmount(
                        parseFloat(formData.expected_ctc) || 0,
                        parseFloat(formData.agency_fee_pct) || 8.33
                      )
                    )}{' '}
                    (expected CTC × fee %)
                  </p>
                </div>
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
            {submitting ? 'Processing...' : existingCandidate ? 'Add applications' : 'Add Candidate'}
          </button>
        </form>
      </div>
    </div>
  );
}
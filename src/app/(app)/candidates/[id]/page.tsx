'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import { CANDIDATE_JOB_SELECT, supabase } from '@/lib/supabase';
import { daysUntilRetentionExpiry } from '@/lib/dpdp';

const PIPELINE_STAGES = [
  'Applied',
  'Screened',
  'Internal Interview',
  'Client Round',
  'Offered',
  'BGV',
  'Joined',
  'Rejected',
  'Dropped Out',
] as const;

type JobEmbed = {
  title?: string;
  max_notice_period_days?: number | null;
};

const REJECTION_REASONS = [
  'Technical Fail',
  'Culture Fit',
  'Compensation Mismatch',
  'Notice Period Too Long',
  'Client Rejected',
  'Other',
] as const;

type Application = {
  id?: string;
  job_id: string;
  stage?: string | null;
  recruiter_name?: string | null;
  offered_ctc?: number | null;
  expected_joining_date?: string | null;
  rejection_reason?: string | null;
  jobs?: JobEmbed | JobEmbed[] | null;
};

type StagePrompt = {
  application: Application;
  stage: 'Offered' | 'Rejected';
};

type Activity = {
  id: string;
  candidate_id?: string;
  recruiter_id?: string | null;
  recruiter_name?: string | null;
  activity_type?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type Candidate = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  current_company?: string | null;
  total_experience_years?: number | null;
  skills?: string[] | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  notice_period_days?: number | null;
  retention_expiry_date?: string | null;
  created_at?: string | null;
  source_type?: string | null;
  assigned_recruiter_name?: string | null;
  status?: string | null;
  resume_url?: string | null;
  applications?: Application[] | null;
};

function jobFromApplication(application: Application) {
  const job = application.jobs;
  if (Array.isArray(job)) return job[0];
  return job ?? undefined;
}

function formatWhen(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function CandidateOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [stagePrompt, setStagePrompt] = useState<StagePrompt | null>(null);
  const [offeredCtc, setOfferedCtc] = useState('');
  const [expectedJoiningDate, setExpectedJoiningDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);

  const recruiterName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Recruiter';

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data: candidateRow, error: candidateError }, { data: activityRows, error: activityError }] =
      await Promise.all([
        supabase.from('candidates').select(CANDIDATE_JOB_SELECT).eq('id', id).maybeSingle(),
        supabase
          .from('candidate_activities')
          .select('*')
          .eq('candidate_id', id)
          .order('created_at', { ascending: false }),
      ]);
    if (candidateError) {
      alert('Unable to load candidate: ' + candidateError.message);
    }
    if (activityError) {
      console.error(activityError);
    }
    setCandidate((candidateRow as Candidate) || null);
    setActivities((activityRows as Activity[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function logActivity(activityType: string, notes: string) {
    const { error } = await supabase.from('candidate_activities').insert([
      {
        candidate_id: id,
        recruiter_id: user?.id,
        recruiter_name: recruiterName,
        activity_type: activityType,
        notes,
      },
    ]);
    if (error) throw error;
  }

  async function updateStage(
    application: Application,
    stage: string,
    extras?: {
      offered_ctc?: number | null;
      expected_joining_date?: string | null;
      rejection_reason?: string | null;
    }
  ) {
    if (!application.job_id || (application.stage === stage && !extras)) return;
    setUpdatingJobId(application.job_id);
    try {
      const payload = {
        stage,
        ...(stage === 'Offered'
          ? {
              offered_ctc: extras?.offered_ctc ?? null,
              expected_joining_date: extras?.expected_joining_date ?? null,
              rejection_reason: null,
            }
          : {}),
        ...(stage === 'Rejected'
          ? {
              rejection_reason: extras?.rejection_reason ?? null,
            }
          : {}),
      };
      let query = supabase
        .from('applications')
        .update(payload)
        .eq('candidate_id', id)
        .eq('job_id', application.job_id);
      if (application.id) {
        query = supabase.from('applications').update(payload).eq('id', application.id);
      }
      const { error } = await query;
      if (error) throw error;
      const extraNote =
        stage === 'Offered' && extras
          ? ` (offered CTC ${extras.offered_ctc} LPA, joining ${extras.expected_joining_date})`
          : stage === 'Rejected' && extras?.rejection_reason
            ? ` (${extras.rejection_reason})`
            : '';
      await logActivity('Stage Changed', `Moved stage to ${stage}${extraNote}`);
      setStagePrompt(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update stage.');
    } finally {
      setUpdatingJobId(null);
    }
  }

  function requestStageChange(application: Application, stage: string) {
    if (stage === 'Offered' || stage === 'Rejected') {
      setOfferedCtc(application.offered_ctc?.toString() || '');
      setExpectedJoiningDate(
        application.expected_joining_date
          ? String(application.expected_joining_date).slice(0, 10)
          : ''
      );
      setRejectionReason(application.rejection_reason || REJECTION_REASONS[0]);
      setStagePrompt({ application, stage });
      return;
    }
    void updateStage(application, stage);
  }

  function confirmStagePrompt() {
    if (!stagePrompt) return;
    if (stagePrompt.stage === 'Offered') {
      if (!offeredCtc || !expectedJoiningDate) {
        alert('Enter offered CTC and expected joining date.');
        return;
      }
      void updateStage(stagePrompt.application, 'Offered', {
        offered_ctc: parseFloat(offeredCtc),
        expected_joining_date: expectedJoiningDate,
      });
      return;
    }
    void updateStage(stagePrompt.application, 'Rejected', {
      rejection_reason: rejectionReason,
    });
  }

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      await logActivity('Note', text);
      setNote('');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to save note.');
    } finally {
      setSavingNote(false);
    }
  }

  const remaining = daysUntilRetentionExpiry(
    candidate?.retention_expiry_date,
    candidate?.created_at
  );
  const applications = candidate?.applications || [];
  const skills = Array.isArray(candidate?.skills) ? candidate.skills : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <Link href="/candidates" className="text-sm text-blue-700 hover:underline">
          ← Candidate directory
        </Link>

        {loading ? (
          <p className="text-gray-500">Loading candidate overview...</p>
        ) : !candidate ? (
          <p className="text-gray-500">Candidate not found.</p>
        ) : (
          <>
            <section className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{candidate.full_name}</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {candidate.email} · {candidate.phone}
                  </p>
                  {candidate.resume_url && (
                    <a
                      href={candidate.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      View / Download Resume
                    </a>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    remaining < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}
                >
                  {remaining < 0 ? 'DPDP Expired' : `DPDP Active · ${remaining}d left`}
                </span>
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Company</dt>
                  <dd className="font-medium text-gray-900">{candidate.current_company || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Experience</dt>
                  <dd className="font-medium text-gray-900">
                    {candidate.total_experience_years ?? 0} years
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Notice period</dt>
                  <dd className="font-medium text-gray-900">{candidate.notice_period_days ?? 0} days</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">CTC</dt>
                  <dd className="font-medium text-gray-900">
                    {candidate.current_ctc ?? 0} → {candidate.expected_ctc ?? 0} LPA
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Source</dt>
                  <dd className="font-medium text-gray-900">{candidate.source_type || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">DPDP expiry</dt>
                  <dd className="font-medium text-gray-900">
                    {candidate.retention_expiry_date
                      ? new Date(candidate.retention_expiry_date).toLocaleDateString()
                      : '—'}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {skills.length === 0
                    ? '—'
                    : skills.map((skill) => (
                        <span
                          key={skill}
                          className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                </div>
              </div>
            </section>

            <section className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Applications & stage control</h2>
              {applications.length === 0 ? (
                <p className="text-sm text-gray-500">No job applications yet.</p>
              ) : (
                <div className="space-y-3">
                  {applications.map((application) => {
                    const job = jobFromApplication(application);
                    return (
                      <div
                        key={application.id || application.job_id}
                        className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-3"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{job?.title || 'Unknown role'}</p>
                          <p className="text-xs text-gray-500">
                            Recruiter: {application.recruiter_name || candidate.assigned_recruiter_name || '—'}
                            {job?.max_notice_period_days != null
                              ? ` · Max NP ${job.max_notice_period_days}d`
                              : ''}
                          </p>
                          {(application.offered_ctc != null || application.expected_joining_date) && (
                            <p className="text-xs text-gray-700 mt-1">
                              Offered CTC: {application.offered_ctc ?? '—'} LPA · Joining:{' '}
                              {application.expected_joining_date
                                ? String(application.expected_joining_date).slice(0, 10)
                                : '—'}
                            </p>
                          )}
                          {application.rejection_reason && (
                            <p className="text-xs text-red-700 mt-1">
                              Rejection reason: {application.rejection_reason}
                            </p>
                          )}
                        </div>
                        <label className="text-sm text-gray-700">
                          Stage
                          <select
                            className="ml-2 border rounded-md p-2 text-black"
                            value={application.stage || 'Applied'}
                            disabled={updatingJobId === application.job_id}
                            onChange={(e) => requestStageChange(application, e.target.value)}
                          >
                            {!PIPELINE_STAGES.includes(
                              (application.stage || 'Applied') as (typeof PIPELINE_STAGES)[number]
                            ) && (
                              <option value={application.stage || 'Applied'}>
                                {application.stage}
                              </option>
                            )}
                            {PIPELINE_STAGES.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Notes & activity</h2>
              <div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Add a free-text note for this candidate..."
                  className="w-full border rounded-md p-2 text-black"
                />
                <button
                  type="button"
                  onClick={() => void addNote()}
                  disabled={savingNote || !note.trim()}
                  className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-400"
                >
                  {savingNote ? 'Saving...' : 'Add note'}
                </button>
              </div>
              <ol className="space-y-3">
                {activities.length === 0 ? (
                  <li className="text-sm text-gray-500">No activity yet.</li>
                ) : (
                  activities.map((activity) => (
                    <li key={activity.id} className="border-l-4 border-blue-200 pl-3">
                      <p className="text-xs text-gray-500">
                        {activity.activity_type || 'Note'} ·{' '}
                        {activity.recruiter_name || 'Unknown recruiter'} ·{' '}
                        {formatWhen(activity.created_at)}
                      </p>
                      <p className="text-sm text-gray-900 mt-1">{activity.notes}</p>
                    </li>
                  ))
                )}
              </ol>
            </section>
          </>
        )}
      </div>

      {stagePrompt && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {stagePrompt.stage === 'Offered' ? 'Record offer details' : 'Record rejection reason'}
            </h2>
            {stagePrompt.stage === 'Offered' ? (
              <>
                <label className="block text-sm text-gray-700">
                  Offered CTC (LPA)
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={offeredCtc}
                    onChange={(e) => setOfferedCtc(e.target.value)}
                    className="mt-1 w-full border rounded-md p-2 text-black"
                    required
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  Expected joining date
                  <input
                    type="date"
                    value={expectedJoiningDate}
                    onChange={(e) => setExpectedJoiningDate(e.target.value)}
                    className="mt-1 w-full border rounded-md p-2 text-black"
                    required
                  />
                </label>
              </>
            ) : (
              <label className="block text-sm text-gray-700">
                Rejection reason
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1 w-full border rounded-md p-2 text-black"
                >
                  {REJECTION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStagePrompt(null)}
                className="px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStagePrompt}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Save and move stage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

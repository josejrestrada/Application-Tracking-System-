'use client';

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { CANDIDATE_JOB_SELECT, supabase } from '@/lib/supabase';
import { daysUntilRetentionExpiry } from '@/lib/dpdp';
import Link from 'next/link';

const NOTICE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: '15', label: 'Immediate / 15 Days' },
  { value: '30', label: '30 Days' },
  { value: '60', label: '60 Days' },
  { value: '90', label: '90 Days' },
] as const;

type ApplicationJob = {
  title?: string;
  max_notice_period_days?: number | null;
};

type Application = {
  job_id?: string;
  stage?: string | null;
  jobs?: ApplicationJob | ApplicationJob[] | null;
};

function applicationJob(application: Application) {
  const job = application.jobs;
  if (Array.isArray(job)) return job[0];
  return job ?? undefined;
}

function skillList(candidate: { skills?: string[] | null }) {
  return Array.isArray(candidate.skills) ? candidate.skills : [];
}

function candidateApplications(candidate: { applications?: Application[] | null }) {
  return candidate.applications || [];
}

function matchesSearch(candidate: any, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const skills = skillList(candidate).join(' ');
  const haystack = [candidate.full_name, candidate.email, candidate.current_company, skills]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function matchesNotice(candidate: any, maxDays: string) {
  if (maxDays === 'all') return true;
  const notice = Number(candidate.notice_period_days || 0);
  return notice <= Number(maxDays);
}

function matchesExperience(candidate: any, minYears: string, maxYears: string) {
  const years = Number(candidate.total_experience_years || 0);
  if (minYears !== '' && years < Number(minYears)) return false;
  if (maxYears !== '' && years > Number(maxYears)) return false;
  return true;
}

function NoticeMatchBadge({
  noticePeriodDays,
  maxNoticePeriodDays,
}: {
  noticePeriodDays?: number | null;
  maxNoticePeriodDays?: number | null;
}) {
  const notice = Number(noticePeriodDays || 0);
  if (maxNoticePeriodDays == null) {
    return (
      <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-700">
        {notice} Days
      </span>
    );
  }
  const max = Number(maxNoticePeriodDays);
  if (notice <= max) {
    return (
      <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">
        Eligible (≤ {max}d)
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">
      Exceeds Max ({notice}d &gt; {max}d)
    </span>
  );
}

function DpdpStatusBadge({
  expiry,
  createdAt,
}: {
  expiry?: string | null;
  createdAt?: string | null;
}) {
  const remaining = daysUntilRetentionExpiry(expiry, createdAt);
  if (remaining < 0) {
    return (
      <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">
        Consent Expired
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">
      Consent Active · {remaining}d left
    </span>
  );
}

export default function CandidatesListPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [anonymizingId, setAnonymizingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [noticeFilter, setNoticeFilter] = useState<string>('all');
  const [minExperience, setMinExperience] = useState('');
  const [maxExperience, setMaxExperience] = useState('');

  const filteredCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          matchesSearch(candidate, searchQuery) &&
          matchesNotice(candidate, noticeFilter) &&
          matchesExperience(candidate, minExperience, maxExperience)
      ),
    [candidates, searchQuery, noticeFilter, minExperience, maxExperience]
  );

  async function fetchCandidates() {
    const { data } = await supabase
      .from('candidates')
      .select(CANDIDATE_JOB_SELECT)
      .order('created_at', { ascending: false });
    setCandidates(data || []);
    setLoading(false);
  }

  useEffect(() => {
    void fetchCandidates();
  }, []);

  async function anonymizeCandidate(candidate: { id: string; status?: string }) {
    if (candidate.status === 'Anonymized') return;
    const confirmed = window.confirm(
      'This will permanently scrub name, email, and phone (Right to be Forgotten). Continue?'
    );
    if (!confirmed) return;
    setAnonymizingId(candidate.id);
    const { error } = await supabase
      .from('candidates')
      .update({
        full_name: 'Anonymized Candidate',
        email: 'purged@dpdp.local',
        phone: '0000000000',
        status: 'Anonymized',
      })
      .eq('id', candidate.id);
    setAnonymizingId(null);
    if (error) {
      alert('Unable to anonymize candidate: ' + error.message);
      return;
    }
    await fetchCandidates();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Candidate Directory</h1>
            <p className="text-sm text-gray-600">All candidates, applications by job and stage, notice matching, and recruiter ownership.</p>
          </div>
          <Link
            href="/candidates/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition"
          >
            + Add Candidate
          </Link>
        </div>

        <div className="mb-4 grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-4">
          <label className="block text-sm text-gray-700 md:col-span-2">
            Search
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, email, company, or skill"
              className="mt-1 w-full border rounded-md p-2 text-black"
            />
          </label>
          <label className="block text-sm text-gray-700">
            Notice period
            <select
              value={noticeFilter}
              onChange={(e) => setNoticeFilter(e.target.value)}
              className="mt-1 w-full border rounded-md p-2 text-black"
            >
              {NOTICE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-gray-700">
              Min exp (yrs)
              <input
                type="number"
                min={0}
                step="0.1"
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                className="mt-1 w-full border rounded-md p-2 text-black"
              />
            </label>
            <label className="block text-sm text-gray-700">
              Max exp (yrs)
              <input
                type="number"
                min={0}
                step="0.1"
                value={maxExperience}
                onChange={(e) => setMaxExperience(e.target.value)}
                className="mt-1 w-full border rounded-md p-2 text-black"
              />
            </label>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading pipeline...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Candidate Name</th>
                  <th className="px-4 py-3 text-left">Company / Experience</th>
                  <th className="px-4 py-3 text-left">Skills</th>
                  <th className="px-4 py-3 text-left">Contact Info</th>
                  <th className="px-4 py-3 text-left">Applications</th>
                  <th className="px-4 py-3 text-left">Notice Period</th>
                  <th className="px-4 py-3 text-left">Recruiter Owner</th>
                  <th className="px-4 py-3 text-left">DPDP Status / Expiry</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No candidates in database. Click "+ Add Candidate" to enter your first candidate.
                    </td>
                  </tr>
                ) : filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No candidates match the current search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link href={`/candidates/${c.id}`} className="text-blue-700 hover:underline">
                          {c.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p>{c.current_company || '—'}</p>
                        <p className="text-xs text-gray-500">{c.total_experience_years ?? 0} yrs</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {skillList(c).length === 0
                            ? '—'
                            : skillList(c).map((skill: string) => (
                                <span
                                  key={skill}
                                  className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs"
                                >
                                  {skill}
                                </span>
                              ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{c.email}<br/><span className="text-xs text-gray-500">{c.phone}</span></td>
                      <td className="px-4 py-3">
                        {candidateApplications(c).length === 0 ? (
                          <span className="text-gray-500">No applications</span>
                        ) : (
                          <ul className="space-y-2">
                            {candidateApplications(c).map((application, index) => {
                              const job = applicationJob(application);
                              return (
                                <li key={`${c.id}-${application.job_id || index}`}>
                                  <p className="font-medium text-blue-700">{job?.title || 'Unknown role'}</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded text-xs font-semibold">
                                      {application.stage || 'Applied'}
                                    </span>
                                    <NoticeMatchBadge
                                      noticePeriodDays={c.notice_period_days}
                                      maxNoticePeriodDays={job?.max_notice_period_days}
                                    />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.notice_period_days ?? 0} Days</td>
                      <td className="px-4 py-3 text-gray-700">{c.assigned_recruiter_name || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <DpdpStatusBadge
                          expiry={c.retention_expiry_date}
                          createdAt={c.created_at}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.status === 'Anonymized' ? (
                          <span className="text-xs text-gray-400">Purged</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void anonymizeCandidate(c)}
                            disabled={anonymizingId === c.id}
                            className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                          >
                            {anonymizingId === c.id ? 'Anonymizing...' : 'Right to be Forgotten'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 
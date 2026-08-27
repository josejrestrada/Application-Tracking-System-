'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
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

const SOURCE_CHANNELS = [
  'Naukri',
  'LinkedIn',
  'Referral',
  'Staffing Agency',
  'Direct',
] as const;

const TERMINAL_STAGES = new Set(['Rejected', 'Dropped Out']);

type JobRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type JobEmbed = {
  id?: string;
  title?: string | null;
  created_at?: string | null;
  status?: string | null;
};

type ApplicationRow = {
  id: string;
  candidate_id: string;
  job_id?: string | null;
  stage?: string | null;
  offer_drop_risk?: string | null;
  expected_joining_date?: string | null;
  recruiter_name?: string | null;
  jobs?: JobEmbed | JobEmbed[] | null;
};

type CandidateRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  source_type?: string | null;
  status?: string | null;
  retention_expiry_date?: string | null;
  created_at?: string | null;
};

function jobFromApplication(application: ApplicationRow) {
  const job = application.jobs;
  if (Array.isArray(job)) return job[0];
  return job ?? undefined;
}

function daysBetween(fromIso?: string | null, toIso?: string | null) {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function normalizeSource(value?: string | null) {
  const raw = (value || '').trim();
  if (!raw) return 'Direct';
  if (raw === 'Career Site' || raw.toLowerCase() === 'direct') return 'Direct';
  if ((SOURCE_CHANNELS as readonly string[]).includes(raw)) return raw;
  return raw;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [jobsRes, candidatesRes, projectsRes] = await Promise.all([
        supabase.from('jobs').select('id, title, status, created_at'),
        supabase
          .from('candidates')
          .select('id, full_name, email, source_type, status, retention_expiry_date, created_at'),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
      ]);

      let applicationsRes = await supabase
        .from('applications')
        .select(
          'id, candidate_id, job_id, stage, offer_drop_risk, expected_joining_date, recruiter_name, jobs(id, title, created_at, status)'
        );
      if (applicationsRes.error && /offer_drop_risk/i.test(applicationsRes.error.message)) {
        applicationsRes = await supabase
          .from('applications')
          .select(
            'id, candidate_id, job_id, stage, expected_joining_date, recruiter_name, jobs(id, title, created_at, status)'
          );
      }

      const firstError =
        jobsRes.error || candidatesRes.error || applicationsRes.error || projectsRes.error;
      if (firstError) {
        setError(firstError.message);
        setJobs((jobsRes.data as JobRow[]) || []);
        setCandidates((candidatesRes.data as CandidateRow[]) || []);
        setApplications((applicationsRes.data as ApplicationRow[]) || []);
        setProjectCount(projectsRes.count || 0);
        setLoading(false);
        return;
      }

      setError(null);
      setJobs((jobsRes.data as JobRow[]) || []);
      setCandidates((candidatesRes.data as CandidateRow[]) || []);
      setApplications((applicationsRes.data as ApplicationRow[]) || []);
      setProjectCount(projectsRes.count || 0);
      setLoading(false);
    }
    void load();
  }, []);

  const metrics = useMemo(() => {
    const candidateById = new Map(candidates.map((row) => [row.id, row]));
    const openJobs = jobs.filter((job) => (job.status || '').toLowerCase() === 'open');

    const appsByCandidate = new Map<string, ApplicationRow[]>();
    for (const application of applications) {
      const list = appsByCandidate.get(application.candidate_id) || [];
      list.push(application);
      appsByCandidate.set(application.candidate_id, list);
    }

    const activeCandidates = candidates.filter((candidate) => {
      if (candidate.status === 'Anonymized') return false;
      const apps = appsByCandidate.get(candidate.id) || [];
      if (apps.length === 0) return true;
      return apps.some((application) => !TERMINAL_STAGES.has(application.stage || ''));
    });

    const offersExtended = applications.filter((application) => {
      const stage = application.stage || '';
      return stage === 'Offered' || stage === 'Joined';
    });

    const fillDays = applications
      .filter((application) => application.stage === 'Joined')
      .map((application) => {
        const job = jobFromApplication(application);
        return daysBetween(job?.created_at, application.expected_joining_date);
      })
      .filter((value): value is number => value != null && value >= 0);
    const avgTimeToFill =
      fillDays.length === 0
        ? null
        : Math.round(fillDays.reduce((sum, days) => sum + days, 0) / fillDays.length);

    const pipeline = PIPELINE_STAGES.map((stage) => ({
      stage,
      count: applications.filter((application) => (application.stage || 'Applied') === stage).length,
    }));
    const pipelineMax = Math.max(1, ...pipeline.map((row) => row.count));

    const highRiskOffers = applications
      .filter((application) => (application.offer_drop_risk || '').toLowerCase() === 'high')
      .map((application) => ({
        application,
        candidate: candidateById.get(application.candidate_id),
        job: jobFromApplication(application),
      }));

    const dpdpWarnings = candidates
      .filter((candidate) => candidate.status !== 'Anonymized')
      .map((candidate) => ({
        candidate,
        days: daysUntilRetentionExpiry(candidate.retention_expiry_date, candidate.created_at),
      }))
      .filter((row) => row.days <= 15)
      .sort((a, b) => a.days - b.days);

    const sourceCounts = SOURCE_CHANNELS.map((channel) => ({
      channel,
      count: candidates.filter((candidate) => normalizeSource(candidate.source_type) === channel)
        .length,
    }));
    const knownSources = new Set(SOURCE_CHANNELS as readonly string[]);
    const otherSourceCount = candidates.filter((candidate) => {
      const source = normalizeSource(candidate.source_type);
      return !knownSources.has(source);
    }).length;
    const sourceMax = Math.max(1, ...sourceCounts.map((row) => row.count), otherSourceCount);

    return {
      openJobs: openJobs.length,
      activeCandidates: activeCandidates.length,
      offersExtended: offersExtended.length,
      avgTimeToFill,
      fillSampleSize: fillDays.length,
      pipeline,
      pipelineMax,
      highRiskOffers,
      dpdpWarnings,
      sourceCounts,
      otherSourceCount,
      sourceMax,
    };
  }, [applications, candidates, jobs]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recruiter dashboard</h1>
            <p className="text-sm text-gray-600">
              Operational ATS metrics across openings, pipeline, offers, and DPDP retention.
              {projectCount > 0 ? ` ${projectCount} client project${projectCount === 1 ? '' : 's'} on file.` : ''}
            </p>
          </div>
          <Link
            href="/candidates"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open directory
          </Link>
        </header>

        {loading ? (
          <p className="text-gray-500">Loading analytics...</p>
        ) : (
          <>
            {error && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Some metrics may be incomplete: {error}
              </p>
            )}

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Active openings" value={String(metrics.openJobs)} hint="Jobs with status open" />
              <KpiCard
                label="Total active candidates"
                value={String(metrics.activeCandidates)}
                hint="Not Rejected or Dropped Out"
              />
              <KpiCard
                label="Offers extended"
                value={String(metrics.offersExtended)}
                hint="Applications in Offered or Joined"
              />
              <KpiCard
                label="Avg time-to-fill"
                value={metrics.avgTimeToFill == null ? '—' : `${metrics.avgTimeToFill}d`}
                hint={
                  metrics.fillSampleSize === 0
                    ? 'Needs Joined apps with joining date'
                    : `Across ${metrics.fillSampleSize} joined hire${metrics.fillSampleSize === 1 ? '' : 's'}`
                }
              />
            </section>

            <section className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Pipeline breakdown</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                {metrics.pipeline.map((row) => (
                  <div key={row.stage} className="rounded-lg border p-3">
                    <p className="text-2xl font-semibold text-gray-900">{row.count}</p>
                    <p className="text-xs text-gray-600 mt-1">{row.stage}</p>
                    <div className="mt-2 h-1.5 rounded bg-gray-100">
                      <div
                        className="h-1.5 rounded bg-blue-600"
                        style={{ width: `${Math.round((row.count / metrics.pipelineMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="bg-white border rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">High risk offers</h2>
                <p className="text-xs text-gray-500 mb-3">Applications with offer_drop_risk = High</p>
                {metrics.highRiskOffers.length === 0 ? (
                  <p className="text-sm text-gray-500">No high-risk offers right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {metrics.highRiskOffers.map(({ application, candidate, job }) => (
                      <li
                        key={application.id}
                        className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm"
                      >
                        <Link
                          href={`/candidates/${application.candidate_id}`}
                          className="font-medium text-red-900 hover:underline"
                        >
                          {candidate?.full_name || 'Unknown candidate'}
                        </Link>
                        <p className="text-xs text-red-800 mt-1">
                          {job?.title || 'Unknown role'} · {application.stage || 'Offered'}
                          {application.expected_joining_date
                            ? ` · Joining ${String(application.expected_joining_date).slice(0, 10)}`
                            : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-white border rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">DPDP retention expiry</h2>
                <p className="text-xs text-gray-500 mb-3">Expired or within the next 15 days</p>
                {metrics.dpdpWarnings.length === 0 ? (
                  <p className="text-sm text-gray-500">No upcoming or expired retention dates.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-gray-600">
                        <tr>
                          <th className="pb-2 font-medium">Candidate</th>
                          <th className="pb-2 font-medium">Expiry</th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {metrics.dpdpWarnings.map(({ candidate, days }) => (
                          <tr key={candidate.id}>
                            <td className="py-2">
                              <Link href={`/candidates/${candidate.id}`} className="text-blue-700 hover:underline">
                                {candidate.full_name || 'Unnamed'}
                              </Link>
                            </td>
                            <td className="py-2 text-gray-700">
                              {candidate.retention_expiry_date
                                ? new Date(candidate.retention_expiry_date).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="py-2">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                  days < 0
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <section className="bg-white border rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Recruiter sourcing breakdown</h2>
              <div className="space-y-3">
                {metrics.sourceCounts.map((row) => (
                  <SourceRow
                    key={row.channel}
                    label={row.channel}
                    count={row.count}
                    max={metrics.sourceMax}
                  />
                ))}
                {metrics.otherSourceCount > 0 && (
                  <SourceRow label="Other" count={metrics.otherSourceCount} max={metrics.sourceMax} />
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-800 mt-1">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}

function SourceRow({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-800">{label}</span>
        <span className="font-semibold text-gray-900">{count}</span>
      </div>
      <div className="mt-1 h-2 rounded bg-gray-100">
        <div
          className="h-2 rounded bg-blue-600"
          style={{ width: `${Math.round((count / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

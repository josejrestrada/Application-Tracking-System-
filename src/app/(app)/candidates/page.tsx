'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { CANDIDATE_JOB_SELECT, supabase } from '@/lib/supabase';
import Link from 'next/link';

type AssignedJob = {
  id?: string;
  title?: string;
  max_notice_period_days?: number | null;
};

function assignedJob(candidate: { jobs?: AssignedJob | AssignedJob[] | null }) {
  const job = candidate.jobs;
  if (Array.isArray(job)) return job[0];
  return job ?? undefined;
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

export default function CandidatesListPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCandidates() {
      const { data } = await supabase
        .from('candidates')
        .select(CANDIDATE_JOB_SELECT)
        .order('created_at', { ascending: false });
      setCandidates(data || []);
      setLoading(false);
    }
    fetchCandidates();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Candidate Directory</h1>
            <p className="text-sm text-gray-600">All candidates, notice periods, assigned jobs, and recruiter ownership.</p>
          </div>
          <Link
            href="/candidates/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition"
          >
            + Add Candidate
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading pipeline...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Candidate Name</th>
                  <th className="px-4 py-3 text-left">Contact Info</th>
                  <th className="px-4 py-3 text-left">Assigned Job</th>
                  <th className="px-4 py-3 text-left">Notice Period</th>
                  <th className="px-4 py-3 text-left">Recruiter Owner</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No candidates in database. Click "+ Add Candidate" to enter your first candidate.
                    </td>
                  </tr>
                ) : (
                  candidates.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.full_name}</td>
                      <td className="px-4 py-3">{c.email}<br/><span className="text-xs text-gray-500">{c.phone}</span></td>
                      <td className="px-4 py-3 font-medium text-blue-700">{assignedJob(c)?.title || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <NoticeMatchBadge
                          noticePeriodDays={c.notice_period_days}
                          maxNoticePeriodDays={assignedJob(c)?.max_notice_period_days}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.assigned_recruiter_name || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                          {c.status}
                        </span>
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
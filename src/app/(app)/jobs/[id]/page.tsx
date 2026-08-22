"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { JobCommercialStrip, Pill } from "@/components/ui/primitives";
import {
  STAGE_LABEL,
  daysUntil,
  isNoticePeriodRisk,
  sourceDisplay,
} from "@/lib/domain";
import { useAtsStore } from "@/store/ats-store";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const job = useAtsStore((s) => s.jobs.find((j) => j.id === id));
  const candidates = useAtsStore((s) =>
    s.candidates.filter((c) => c.jobId === id)
  );

  if (!job) return <p>Requisition not found.</p>;

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-[#0f6e67]">
        ← All requisitions
      </Link>
      <header className="space-y-2">
        <p className="text-xs text-[#3d5168]">
          {job.id} · Target close {job.targetClosureDate} · {daysUntil(job.targetClosureDate)} days
        </p>
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
          {job.title}
        </h1>
        <p className="text-sm text-[#3d5168]">
          {job.location} · Recruiter {job.recruiterOwner} · HM {job.hiringManager}
        </p>
      </header>
      <JobCommercialStrip job={job} />
      {job.notes && (
        <p className="rounded-xl bg-white border border-[#d9d0c0] p-4 text-sm">{job.notes}</p>
      )}
      <section className="overflow-hidden rounded-2xl border border-[#d9d0c0] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f7f2ea] text-[#3d5168]">
            <tr>
              <th className="px-4 py-2 font-medium">Candidate</th>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">NP</th>
              <th className="px-4 py-2 font-medium">Client approval</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="border-t border-[#ece4d6]">
                <td className="px-4 py-2">
                  <Link href={`/candidates/${c.id}`} className="underline">
                    {c.fullName}
                  </Link>
                  {isNoticePeriodRisk(c, job) && (
                    <span className="ml-2">
                      <Pill tone="warn">NP risk</Pill>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{STAGE_LABEL[c.stage]}</td>
                <td className="px-4 py-2">{sourceDisplay(c)}</td>
                <td className="px-4 py-2">{c.noticePeriodDays}d</td>
                <td className="px-4 py-2 capitalize">{c.clientApprovalStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

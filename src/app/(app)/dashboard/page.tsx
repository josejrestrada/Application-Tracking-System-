"use client";

import Link from "next/link";
import {
  ACTIVE_STAGES,
  STAGE_LABEL,
  daysUntil,
  isNoticePeriodRisk,
  sourceDisplay,
} from "@/lib/domain";
import { useAtsStore } from "@/store/ats-store";
import { JobCommercialStrip, Pill } from "@/components/ui/primitives";

export default function DashboardPage() {
  const jobs = useAtsStore((s) => s.jobs);
  const candidates = useAtsStore((s) => s.candidates);
  const openJobs = jobs.filter((j) => j.status === "open");
  const active = candidates.filter(
    (c) => c.stage !== "rejected" && c.stage !== "dropped_out"
  );
  const risks = candidates.filter((c) =>
    isNoticePeriodRisk(
      c,
      jobs.find((j) => j.id === c.jobId)
    )
  );
  const clientPending = candidates.filter(
    (c) => c.stage === "client_round" && c.clientApprovalStatus === "pending"
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-[#3d5168]">Talent operations</p>
        <h1
          className="text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Command center
        </h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Open requisitions" value={String(openJobs.length)} />
        <Stat label="Active pipeline" value={String(active.length)} />
        <Stat
          label="Notice-period risks"
          value={String(risks.length)}
          warn={risks.length > 0}
        />
        <Stat
          label="Client approval pending"
          value={String(clientPending.length)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#3d5168]">
          Funnel
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {ACTIVE_STAGES.map((stage) => {
            const count = candidates.filter((c) => c.stage === stage).length;
            return (
              <div
                key={stage}
                className="rounded-xl border border-[#d9d0c0] bg-white p-3"
              >
                <p className="text-2xl font-semibold">{count}</p>
                <p className="text-xs text-[#3d5168]">{STAGE_LABEL[stage]}</p>
              </div>
            );
          })}
        </div>
      </section>

      {risks.length > 0 && (
        <section className="rounded-2xl border border-[#f6d3a8] bg-[#fff7ed] p-4">
          <h2 className="mb-1 font-semibold text-[#b45309]">
            Closure vs notice period
          </h2>
          <p className="mb-3 text-sm text-[#9a3412]">
            Highlighted when notice is over 60 days and the job must close in
            under 21 days.
          </p>
          <ul className="space-y-2">
            {risks.map((c) => {
              const job = jobs.find((j) => j.id === c.jobId);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <Link href={`/candidates/${c.id}`} className="font-medium underline">
                    {c.fullName}
                  </Link>
                  <span>
                    {c.noticePeriodDays}d NP · closes in{" "}
                    {job ? daysUntil(job.targetClosureDate) : "—"}d · {job?.title}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#3d5168]">
          Live requisitions
        </h2>
        {openJobs.map((job) => (
          <Link key={job.id} href={`/jobs/${job.id}`} className="block space-y-2 rounded-2xl border border-[#d9d0c0] bg-white p-4 hover:border-[#0f6e67]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-[#3d5168]">{job.id}</p>
                <h3 className="text-lg font-medium">{job.title}</h3>
              </div>
              <div className="flex gap-2">
                <Pill>{job.location}</Pill>
                <Pill tone="teal">{job.openings} openings</Pill>
              </div>
            </div>
            <JobCommercialStrip job={job} />
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#3d5168]">
          Waiting on client
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[#d9d0c0] bg-white">
          {clientPending.length === 0 ? (
            <p className="p-4 text-sm text-[#3d5168]">No pending client approvals.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f2ea] text-[#3d5168]">
                <tr>
                  <th className="px-4 py-2 font-medium">Candidate</th>
                  <th className="px-4 py-2 font-medium">Job</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Approval</th>
                </tr>
              </thead>
              <tbody>
                {clientPending.map((c) => (
                  <tr key={c.id} className="border-t border-[#ece4d6]">
                    <td className="px-4 py-2">
                      <Link href={`/candidates/${c.id}`} className="underline">
                        {c.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {jobs.find((j) => j.id === c.jobId)?.title}
                    </td>
                    <td className="px-4 py-2">{sourceDisplay(c)}</td>
                    <td className="px-4 py-2">
                      <Pill tone="warn">Pending</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#d9d0c0] bg-white p-4">
      <p className={`text-3xl font-semibold ${warn ? "text-[#b45309]" : ""}`}>
        {value}
      </p>
      <p className="text-sm text-[#3d5168]">{label}</p>
    </div>
  );
}

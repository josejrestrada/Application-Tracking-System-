"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { JobCommercialStrip, Pill } from "@/components/ui/primitives";
import {
  REJECT_REASON_LABEL,
  STAGE_LABEL,
  canAdvanceToOffered,
  daysUntil,
  findDuplicates,
  isNoticePeriodRisk,
  nextActiveStage,
  sourceDisplay,
} from "@/lib/domain";
import type { ClientApprovalStatus, RejectReasonCode } from "@/lib/types";
import { useAtsStore } from "@/store/ats-store";

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const candidate = useAtsStore((s) => s.candidates.find((c) => c.id === id));
  const jobs = useAtsStore((s) => s.jobs);
  const candidates = useAtsStore((s) => s.candidates);
  const events = useAtsStore((s) => s.events.filter((e) => e.candidateId === id));
  const advanceCandidate = useAtsStore((s) => s.advanceCandidate);
  const setClientApproval = useAtsStore((s) => s.setClientApproval);
  const exitPipeline = useAtsStore((s) => s.exitPipeline);
  const [error, setError] = useState("");
  const [exitOpen, setExitOpen] = useState<"rejected" | "dropped_out" | null>(null);

  const job = jobs.find((j) => j.id === candidate?.jobId);
  const dupes = useMemo(
    () =>
      candidate
        ? findDuplicates(candidates, candidate.email, candidate.phone, candidate.id)
        : [],
    [candidate, candidates]
  );

  if (!candidate || !job) return <p>Candidate not found.</p>;

  const risk = isNoticePeriodRisk(candidate, job);
  const next = nextActiveStage(candidate.stage);

  return (
    <div className="space-y-6">
      <Link href="/candidates" className="text-sm text-[#0f6e67]">
        ← Pipeline
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[#3d5168]">{candidate.id}</p>
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            {candidate.fullName}
          </h1>
          <p className="text-sm text-[#3d5168]">
            {candidate.email} · {candidate.phone} · {candidate.location}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="teal">{STAGE_LABEL[candidate.stage]}</Pill>
          <Pill>{sourceDisplay(candidate)}</Pill>
          {risk && <Pill tone="warn">Notice period vs closure risk</Pill>}
        </div>
      </header>

      {dupes.length > 0 && (
        <aside className="rounded-2xl border border-[#f6d3a8] bg-[#fff7ed] p-4 text-sm">
          <p className="font-semibold text-[#9a3412]">Duplicate detection</p>
          <p className="mt-1 text-[#9a3412]">
            Email or phone already exists on another profile in this workspace.
          </p>
          <ul className="mt-2 space-y-1">
            {dupes.map((d) => (
              <li key={`${d.candidate.id}-${d.field}`}>
                <Link href={`/candidates/${d.candidate.id}`} className="underline">
                  {d.candidate.fullName}
                </Link>{" "}
                · matched {d.field} · {STAGE_LABEL[d.candidate.stage]} ·{" "}
                {jobs.find((j) => j.id === d.candidate.jobId)?.title}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {risk && (
        <aside className="rounded-2xl border border-[#f6d3a8] bg-[#fff7ed] p-4 text-sm text-[#9a3412]">
          Notice period is {candidate.noticePeriodDays} days, but {job.title} targets
          closure in {daysUntil(job.targetClosureDate)} days (under 3 weeks). This
          candidate is unlikely to join in time unless buyout is confirmed.
        </aside>
      )}

      <JobCommercialStrip job={job} />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#d9d0c0] bg-white p-4 space-y-2 text-sm">
          <h2 className="font-semibold">Profile</h2>
          <p>Experience: {candidate.experienceYears} years</p>
          <p>Notice: {candidate.noticePeriodDays} days</p>
          <p>
            CTC: {candidate.currentCtcLpa} LPA → {candidate.expectedCtcLpa} LPA
          </p>
          <p>Skills: {candidate.skills.join(", ") || "—"}</p>
          {candidate.rejectReason && (
            <p>
              Exit reason: {REJECT_REASON_LABEL[candidate.rejectReason]}
              {candidate.rejectNotes ? ` — ${candidate.rejectNotes}` : ""}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[#d9d0c0] bg-white p-4 space-y-3 text-sm">
          <h2 className="font-semibold">Client Round interview status</h2>
          <p>
            Client Approval Status:{" "}
            <strong className="capitalize">{candidate.clientApprovalStatus}</strong>
          </p>
          {candidate.stage === "client_round" && (
            <div className="flex flex-wrap gap-2">
              {(["pending", "approved", "rejected"] as ClientApprovalStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    className="rounded-full border border-[#d9d0c0] px-3 py-1 capitalize"
                    onClick={async () => {
                      const result = await setClientApproval(candidate.id, status);
                      setError(result.ok ? "" : result.error || "");
                    }}
                  >
                    {status}
                  </button>
                )
              )}
            </div>
          )}
          {next === "offered" && !canAdvanceToOffered(candidate) && (
            <p className="text-[#b45309]">
              Offered is blocked until Client Approval Status is Approved.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {next && (
              <button
                type="button"
                className="rounded-lg bg-[#0f6e67] px-3 py-2 text-white"
                onClick={async () => {
                  const result = await advanceCandidate(candidate.id);
                  setError(result.ok ? "" : result.error || "");
                }}
              >
                Move to {STAGE_LABEL[next]}
              </button>
            )}
            {candidate.stage !== "rejected" && candidate.stage !== "dropped_out" && (
              <>
                <button
                  type="button"
                  className="rounded-lg border border-[#d9d0c0] px-3 py-2"
                  onClick={() => setExitOpen("rejected")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[#d9d0c0] px-3 py-2"
                  onClick={() => setExitOpen("dropped_out")}
                >
                  Dropped out
                </button>
              </>
            )}
          </div>
          {error && <p className="text-[#9f1239]">{error}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d9d0c0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Stage history</h2>
        <ol className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 border-b border-[#ece4d6] pb-2">
              <span>
                {e.fromStage ? STAGE_LABEL[e.fromStage] : "New"} → {STAGE_LABEL[e.toStage]}
                {e.note ? ` · ${e.note}` : ""}
              </span>
              <span className="text-[#3d5168]">
                {e.at} · {e.by}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {exitOpen && (
        <ExitDialog
          mode={exitOpen}
          onCancel={() => setExitOpen(null)}
          onConfirm={(reason, notes) => {
            void exitPipeline(candidate.id, exitOpen, reason, notes);
            setExitOpen(null);
          }}
        />
      )}
    </div>
  );
}

function ExitDialog({
  mode,
  onCancel,
  onConfirm,
}: {
  mode: "rejected" | "dropped_out";
  onCancel: () => void;
  onConfirm: (reason: RejectReasonCode, notes: string) => void;
}) {
  const [reason, setReason] = useState<RejectReasonCode>(
    mode === "dropped_out" ? "candidate_withdrew" : "tech_evaluation_failed"
  );
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[#12243a]/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold">
          Mark as {mode === "rejected" ? "Rejected" : "Dropped Out"}
        </h2>
        <label className="block text-sm">
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as RejectReasonCode)}
            className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
          >
            {Object.entries(REJECT_REASON_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#12243a] px-4 py-2 text-white"
            onClick={() => onConfirm(reason, notes)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

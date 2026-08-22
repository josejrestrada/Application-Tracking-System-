"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Pill } from "@/components/ui/primitives";
import {
  ACTIVE_STAGES,
  STAGE_LABEL,
  findDuplicates,
  isNoticePeriodRisk,
  sourceDisplay,
} from "@/lib/domain";
import type { Candidate, CandidateSourceType, HubLocation, PipelineStage } from "@/lib/types";
import { useAtsStore } from "@/store/ats-store";

export default function CandidatesPage() {
  const jobs = useAtsStore((s) => s.jobs);
  const candidates = useAtsStore((s) => s.candidates);
  const addCandidate = useAtsStore((s) => s.addCandidate);
  const advanceCandidate = useAtsStore((s) => s.advanceCandidate);
  const exitPipeline = useAtsStore((s) => s.exitPipeline);
  const [jobFilter, setJobFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [dupes, setDupes] = useState(findDuplicates(candidates, "", ""));
  const [message, setMessage] = useState("");

  const filtered = useMemo(
    () =>
      candidates.filter((c) => (jobFilter === "all" ? true : c.jobId === jobFilter)),
    [candidates, jobFilter]
  );

  function checkDupes(email: string, phone: string) {
    setDupes(findDuplicates(candidates, email, phone));
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const phone = String(data.get("phone"));
    const sourceType = String(data.get("sourceType")) as CandidateSourceType;
    await addCandidate({
      fullName: String(data.get("fullName")),
      email,
      phone,
      jobId: String(data.get("jobId")),
      stage: "applied",
      sourceType,
      consultancyName:
        sourceType === "consultancy" ? String(data.get("consultancyName")) : undefined,
      referredBy:
        sourceType === "employee_referral" ? String(data.get("referredBy")) : undefined,
      noticePeriodDays: Number(data.get("noticePeriodDays") || 0),
      currentCtcLpa: Number(data.get("currentCtcLpa") || 0),
      expectedCtcLpa: Number(data.get("expectedCtcLpa") || 0),
      experienceYears: Number(data.get("experienceYears") || 0),
      skills: String(data.get("skills") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      location: String(data.get("location")) as HubLocation,
    });
    setOpen(false);
    setDupes([]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[#3d5168]">Hiring pipeline</p>
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            Candidates
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-[#0f6e67] px-4 py-2 text-white"
        >
          Add candidate
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="rounded-lg border border-[#d9d0c0] bg-white px-3 py-2 text-sm"
        >
          <option value="all">All requisitions</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.id} · {j.title}
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-sm text-[#9f1239]">{message}</p>}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {ACTIVE_STAGES.map((stage) => {
          const column = filtered.filter((c) => c.stage === stage);
          return (
            <section
              key={stage}
              className="w-64 shrink-0 rounded-2xl border border-[#d9d0c0] bg-[#ebe4d7] p-2"
            >
              <h2 className="px-2 py-1 text-sm font-semibold">
                {STAGE_LABEL[stage]}{" "}
                <span className="text-[#3d5168]">{column.length}</span>
              </h2>
              <div className="space-y-2">
                {column.map((c) => {
                  const job = jobs.find((j) => j.id === c.jobId);
                  const risk = isNoticePeriodRisk(c, job);
                  return (
                    <article key={c.id} className="rounded-xl bg-white p-3 text-sm">
                      <Link href={`/candidates/${c.id}`} className="font-medium underline">
                        {c.fullName}
                      </Link>
                      <p className="mt-1 text-xs text-[#3d5168]">
                        {job?.title} · {job?.clientName}
                      </p>
                      <p className="mt-1 text-xs">{sourceDisplay(c)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {risk && <Pill tone="warn">NP &gt; 60d</Pill>}
                        {stage === "client_round" && (
                          <Pill
                            tone={
                              c.clientApprovalStatus === "approved"
                                ? "ok"
                                : c.clientApprovalStatus === "rejected"
                                  ? "bad"
                                  : "warn"
                            }
                          >
                            Client {c.clientApprovalStatus}
                          </Pill>
                        )}
                      </div>
                      <div className="mt-2 flex gap-1">
                        {stage !== "joined" && (
                          <button
                            type="button"
                            className="rounded border border-[#d9d0c0] px-2 py-0.5 text-xs"
                            onClick={async () => {
                              const result = await advanceCandidate(c.id);
                              setMessage(result.ok ? "" : result.error || "");
                            }}
                          >
                            Advance
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded border border-[#d9d0c0] px-2 py-0.5 text-xs"
                          onClick={() =>
                            void exitPipeline(
                              c.id,
                              "rejected",
                              "other",
                              "Rejected from board"
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <TerminalList
        title="Rejected"
        stage="rejected"
        candidates={filtered}
      />
      <TerminalList
        title="Dropped out"
        stage="dropped_out"
        candidates={filtered}
      />

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[#12243a]/40 p-4">
          <form
            onSubmit={onCreate}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 space-y-3"
          >
            <h2 className="text-lg font-semibold">Add candidate</h2>
            {dupes.length > 0 && (
              <div className="rounded-lg border border-[#f6d3a8] bg-[#fff7ed] p-3 text-sm text-[#9a3412]">
                Duplicate warning: {dupes.length} matching profile
                {dupes.length > 1 ? "s" : ""} on email or phone.
                <ul className="mt-1 list-disc pl-4">
                  {dupes.map((d) => (
                    <li key={`${d.candidate.id}-${d.field}`}>
                      {d.candidate.fullName} ({d.candidate.id}) via {d.field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Field name="fullName" label="Full name" required />
            <Field
              name="email"
              label="Email"
              type="email"
              required
              onChange={(v) => {
                const phone =
                  (document.querySelector('[name="phone"]') as HTMLInputElement)
                    ?.value || "";
                checkDupes(v, phone);
              }}
            />
            <Field
              name="phone"
              label="Phone"
              required
              onChange={(v) => {
                const email =
                  (document.querySelector('[name="email"]') as HTMLInputElement)
                    ?.value || "";
                checkDupes(email, v);
              }}
            />
            <label className="block text-sm">
              Requisition
              <select
                name="jobId"
                required
                className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
              >
                {jobs.filter((j) => j.status !== "closed").map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.clientName}
                  </option>
                ))}
              </select>
            </label>
            <SourceFields />
            <Field name="noticePeriodDays" label="Notice period (days)" type="number" />
            <Field name="experienceYears" label="Experience (years)" type="number" />
            <Field name="currentCtcLpa" label="Current CTC (LPA)" type="number" />
            <Field name="expectedCtcLpa" label="Expected CTC (LPA)" type="number" />
            <label className="block text-sm">
              Hub
              <select
                name="location"
                className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
              >
                <option>Pune</option>
                <option>Bangalore</option>
                <option>Goa</option>
              </select>
            </label>
            <Field name="skills" label="Skills (comma separated)" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-[#0f6e67] px-4 py-2 text-white">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TerminalList({
  title,
  stage,
  candidates,
}: {
  title: string;
  stage: PipelineStage;
  candidates: Candidate[];
}) {
  const rows = candidates.filter((c) => c.stage === stage);
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#3d5168]">
        {title}
      </h2>
      <ul className="space-y-1 text-sm">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/candidates/${c.id}`} className="underline">
              {c.fullName}
            </Link>{" "}
            · {STAGE_LABEL[c.stage]}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceFields() {
  const [source, setSource] = useState<CandidateSourceType>("linkedin");
  return (
    <>
      <label className="block text-sm">
        Source
        <select
          name="sourceType"
          value={source}
          onChange={(e) => setSource(e.target.value as CandidateSourceType)}
          className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
        >
          <option value="linkedin">LinkedIn</option>
          <option value="naukri">Naukri</option>
          <option value="employee_referral">Employee Referral</option>
          <option value="direct">Direct</option>
          <option value="consultancy">Consultancy</option>
        </select>
      </label>
      {source === "consultancy" && (
        <Field name="consultancyName" label="Consultancy name" required />
      )}
      {source === "employee_referral" && (
        <Field name="referredBy" label="Referred by" required />
      )}
    </>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
      />
    </label>
  );
}

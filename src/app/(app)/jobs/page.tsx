"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { JobCommercialStrip, Pill } from "@/components/ui/primitives";
import { CLASSIFICATION_LABEL, daysUntil } from "@/lib/domain";
import type { HubLocation, JobClassification, JobStatus } from "@/lib/types";
import { useAtsStore } from "@/store/ats-store";
import { useAuthStore } from "@/store/auth-store";

export default function JobsPage() {
  const jobs = useAtsStore((s) => s.jobs);
  const candidates = useAtsStore((s) => s.candidates);
  const addJob = useAtsStore((s) => s.addJob);
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | JobClassification>("all");

  const visible = useMemo(
    () =>
      jobs.filter((j) => (filter === "all" ? true : j.classification === filter)),
    [jobs, filter]
  );

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await addJob({
      title: String(data.get("title")),
      clientName: String(data.get("clientName")),
      projectName: String(data.get("projectName")),
      billingRateInr: Number(data.get("billingRateInr") || 0),
      classification: String(data.get("classification")) as JobClassification,
      status: "open",
      location: String(data.get("location")) as HubLocation,
      openings: Number(data.get("openings") || 1),
      targetClosureDate: String(data.get("targetClosureDate")),
      skills: String(data.get("skills") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      hiringManager: String(data.get("hiringManager") || user?.name || ""),
      recruiterOwner: user?.name || "Unassigned",
      notes: String(data.get("notes") || ""),
    });
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[#3d5168]">Delivery staffing</p>
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            Job requisitions
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-[#0f6e67] px-4 py-2 text-white"
        >
          New requisition
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "project_specific", "bench_hiring"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === key ? "bg-[#12243a] text-white" : "bg-white border border-[#d9d0c0]"
            }`}
          >
            {key === "all" ? "All" : CLASSIFICATION_LABEL[key]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visible.map((job) => {
          const pipeline = candidates.filter((c) => c.jobId === job.id);
          const joined = pipeline.filter((c) => c.stage === "joined").length;
          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block space-y-3 rounded-2xl border border-[#d9d0c0] bg-white p-4 hover:border-[#0f6e67]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#3d5168]">
                    {job.id} · closes {job.targetClosureDate} (
                    {daysUntil(job.targetClosureDate)}d)
                  </p>
                  <h2 className="text-xl font-medium">{job.title}</h2>
                  <p className="text-sm text-[#3d5168]">
                    {job.recruiterOwner} · {job.hiringManager} · {job.location}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={job.status} />
                  <Pill>
                    {joined}/{job.openings} joined
                  </Pill>
                  <Pill>{pipeline.length} in pipeline</Pill>
                </div>
              </div>
              <JobCommercialStrip job={job} />
            </Link>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[#12243a]/40 p-4">
          <form
            onSubmit={onCreate}
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 space-y-3"
          >
            <h2 className="text-lg font-semibold">New requisition</h2>
            <Field name="title" label="Role title" required />
            <Field name="clientName" label="Client name" required />
            <Field name="projectName" label="Project name" required />
            <label className="block text-sm">
              Classification
              <select
                name="classification"
                className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
              >
                <option value="project_specific">Project-Specific</option>
                <option value="bench_hiring">Bench Hiring</option>
              </select>
            </label>
            <Field
              name="billingRateInr"
              label="Monthly billing rate (INR, 0 for bench)"
              type="number"
            />
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
            <Field name="openings" label="Openings" type="number" />
            <Field name="targetClosureDate" label="Target closure date" type="date" required />
            <Field name="skills" label="Skills (comma separated)" />
            <Field name="hiringManager" label="Hiring manager" />
            <Field name="notes" label="Notes" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-[#0f6e67] px-4 py-2 text-white">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const tone =
    status === "open" ? "ok" : status === "on_hold" ? "warn" : "neutral";
  return <Pill tone={tone}>{status.replace("_", " ")}</Pill>;
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-lg border border-[#d9d0c0] px-3 py-2"
      />
    </label>
  );
}

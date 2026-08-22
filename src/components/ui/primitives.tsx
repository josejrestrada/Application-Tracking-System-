import { CLASSIFICATION_LABEL, formatInr } from "@/lib/domain";
import type { JobRequisition } from "@/lib/types";

export function JobCommercialStrip({ job }: { job: JobRequisition }) {
  return (
    <dl className="grid gap-3 rounded-xl border border-[#d9d0c0] bg-white px-4 py-3 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-[#3d5168]">Client</dt>
        <dd className="font-medium">{job.clientName}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-[#3d5168]">Project</dt>
        <dd className="font-medium">{job.projectName}</dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-[#3d5168]">Billing rate</dt>
        <dd className="font-medium">
          {job.classification === "bench_hiring"
            ? "Unbilled until mapped"
            : `${formatInr(job.billingRateInr)} / mo`}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-[#3d5168]">Classification</dt>
        <dd className="font-medium">{CLASSIFICATION_LABEL[job.classification]}</dd>
      </div>
    </dl>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "teal";
}) {
  const cls = {
    neutral: "bg-[#e7e0d3] text-[#12243a]",
    ok: "bg-[#d1fae5] text-[#047857]",
    warn: "bg-[#ffedd5] text-[#b45309]",
    bad: "bg-[#ffe4e6] text-[#9f1239]",
    teal: "bg-[#ccfbf1] text-[#0f6e67]",
  }[tone];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

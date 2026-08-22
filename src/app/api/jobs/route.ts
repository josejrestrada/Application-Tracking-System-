import { createJob, listJobs } from "@/server/jobs";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  return ok({ jobs: listJobs() });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error ?? fail("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  if (!body.title || !body.clientName || !body.projectName || !body.targetClosureDate) {
    return fail("Title, client name, project name, and target closure date are required.");
  }
  const job = createJob({
    title: String(body.title),
    clientName: String(body.clientName),
    projectName: String(body.projectName),
    billingRateInr: Number(body.billingRateInr || 0),
    classification: body.classification === "bench_hiring" ? "bench_hiring" : "project_specific",
    status: body.status || "open",
    location: body.location || "Pune",
    openings: Number(body.openings || 1),
    targetClosureDate: String(body.targetClosureDate),
    skills: Array.isArray(body.skills) ? body.skills : [],
    hiringManager: String(body.hiringManager || user.name),
    recruiterOwner: String(body.recruiterOwner || user.name),
    notes: String(body.notes || ""),
  });
  return ok({ job }, 201);
}

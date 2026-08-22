import { listCandidates, listEvents } from "@/server/candidates";
import { listJobs } from "@/server/jobs";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  return ok({
    jobs: listJobs(),
    candidates: listCandidates(),
    events: listEvents(),
  });
}

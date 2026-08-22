import { getJob } from "@/server/jobs";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireUser();
  if (error) return error;
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) return fail("Job not found.", 404);
  return ok({ job });
}

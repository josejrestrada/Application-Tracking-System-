import { getCandidate, listEvents } from "@/server/candidates";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireUser();
  if (error) return error;
  const { id } = await context.params;
  const candidate = getCandidate(id);
  if (!candidate) return fail("Candidate not found.", 404);
  const events = listEvents().filter((event) => event.candidateId === id);
  return ok({ candidate, events });
}

import { advanceCandidate } from "@/server/candidates";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error || !user) return error ?? fail("Unauthorized", 401);
  const { id } = await context.params;
  const result = advanceCandidate(id, user.name);
  if (!result.ok) return fail(result.error, 409);
  return ok(result);
}

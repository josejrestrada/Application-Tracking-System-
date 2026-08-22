import { setClientApproval } from "@/server/candidates";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";
import type { ClientApprovalStatus } from "@/lib/types";

const STATUSES: ClientApprovalStatus[] = ["pending", "approved", "rejected"];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error || !user) return error ?? fail("Unauthorized", 401);
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as ClientApprovalStatus;
  if (!STATUSES.includes(status)) return fail("Invalid client approval status.");
  const result = setClientApproval(id, status, user.name);
  if (!result.ok) return fail(result.error, 409);
  return ok(result);
}

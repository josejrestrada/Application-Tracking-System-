import { exitPipeline } from "@/server/candidates";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";
import type { RejectReasonCode } from "@/lib/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireUser();
  if (error || !user) return error ?? fail("Unauthorized", 401);
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const toStage = body.toStage === "dropped_out" ? "dropped_out" : "rejected";
  const reason = (body.reason || "other") as RejectReasonCode;
  const notes = String(body.notes || "");
  const result = exitPipeline(id, toStage, reason, notes, user.name);
  if (!result.ok) return fail(result.error, 404);
  return ok(result);
}

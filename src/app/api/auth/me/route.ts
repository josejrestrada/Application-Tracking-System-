import { fail, ok } from "@/server/http";
import { readSessionUser } from "@/server/session";

export async function GET() {
  const user = await readSessionUser();
  if (!user) return fail("Unauthorized", 401);
  return ok({ user });
}

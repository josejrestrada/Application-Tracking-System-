import { registerUser } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { createSessionToken, sessionCookie } from "@/server/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = registerUser({
    name: String(body.name || ""),
    email: String(body.email || ""),
    password: String(body.password || "demo"),
  });
  if (!result.ok) return fail(result.error, 409);
  const token = await createSessionToken(result.user.id);
  const response = ok({ user: result.user }, 201);
  response.cookies.set(sessionCookie(token));
  return response;
}

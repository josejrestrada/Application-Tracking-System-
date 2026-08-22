import { authenticate } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { createSessionToken, sessionCookie } from "@/server/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "");
  const password = String(body.password || "");
  const user = authenticate(email, password);
  if (!user) {
    return fail("Invalid email or password. Demo accounts use password demo.", 401);
  }
  const token = await createSessionToken(user.id);
  const response = ok({ user });
  response.cookies.set(sessionCookie(token));
  return response;
}

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearSessionCookie());
  return response;
}

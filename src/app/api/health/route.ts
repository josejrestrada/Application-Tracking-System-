import { NextResponse } from "next/server";
import { getDb } from "@/server/db";

export async function GET() {
  getDb();
  return NextResponse.json({ ok: true, service: "meridian-ats" });
}

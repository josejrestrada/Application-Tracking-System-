import { createCandidate, findDuplicateMatches, listCandidates } from "@/server/candidates";
import { fail, ok } from "@/server/http";
import { requireUser } from "@/server/session";

export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;
  const url = new URL(request.url);
  const email = url.searchParams.get("email") || "";
  const phone = url.searchParams.get("phone") || "";
  const excludeId = url.searchParams.get("excludeId") || undefined;
  if (url.searchParams.has("email") || url.searchParams.has("phone")) {
    return ok({ duplicates: findDuplicateMatches(email, phone, excludeId) });
  }
  return ok({ candidates: listCandidates() });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error || !user) return error ?? fail("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  if (!body.fullName || !body.email || !body.phone || !body.jobId) {
    return fail("Name, email, phone, and job are required.");
  }
  try {
    const result = createCandidate(
      {
        fullName: String(body.fullName),
        email: String(body.email),
        phone: String(body.phone),
        jobId: String(body.jobId),
        stage: "applied",
        sourceType: body.sourceType || "direct",
        consultancyName: body.consultancyName,
        referredBy: body.referredBy,
        noticePeriodDays: Number(body.noticePeriodDays || 0),
        currentCtcLpa: Number(body.currentCtcLpa || 0),
        expectedCtcLpa: Number(body.expectedCtcLpa || 0),
        experienceYears: Number(body.experienceYears || 0),
        skills: Array.isArray(body.skills) ? body.skills : [],
        location: body.location || "Pune",
      },
      user.name
    );
    return ok(result, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Unable to create candidate.");
  }
}

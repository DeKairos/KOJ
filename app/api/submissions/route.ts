import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contests, contestRegistrations, problemTestCases, problems, submissions } from "@/db/schema";
import { requireAuthenticatedUser } from "@/lib/auth";
import { parseSubmissionInput } from "@/lib/submission-input";

const judgeUrl = process.env.FASTAPI_URL ?? "http://127.0.0.1:8000";
const judgeApiKey = process.env.JUDGE_API_KEY ?? "local-development-judge-key";

export async function POST(request: Request) {
  let submissionId: number | undefined;
  try {
    const user = await requireAuthenticatedUser();
    const input = parseSubmissionInput(await request.json());
    const [problem] = await db
      .select()
      .from(problems)
      .where(and(eq(problems.id, input.problemId), eq(problems.status, "published")));
    if (!problem) {
      return NextResponse.json({ error: "Problem is not available" }, { status: 404 });
    }

    if (input.contestId !== null) {
      const [contest] = await db.select().from(contests).where(eq(contests.id, input.contestId));
      const [registration] = await db
        .select()
        .from(contestRegistrations)
        .where(and(eq(contestRegistrations.contestId, input.contestId), eq(contestRegistrations.userId, user.clerkId)));
      const now = new Date();
      if (!contest || contest.status !== "live" || now < contest.startsAt || now > contest.endsAt || !registration) {
        return NextResponse.json({ error: "Contest submission is not currently allowed" }, { status: 409 });
      }
    }

    const testCases = await db
      .select({ input: problemTestCases.input, expectedOutput: problemTestCases.expectedOutput })
      .from(problemTestCases)
      .where(eq(problemTestCases.problemId, input.problemId));
    if (testCases.length === 0) {
      return NextResponse.json({ error: "Problem has no test cases" }, { status: 409 });
    }

    const [created] = await db
      .insert(submissions)
      .values({ userId: user.clerkId, problemId: input.problemId, contestId: input.contestId, language: input.language, code: input.code })
      .returning();
    if (!created) {
      throw new Error("Unable to create submission");
    }
    submissionId = created.id;

    const judgeResponse = await fetch(`${judgeUrl}/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-judge-key": judgeApiKey },
      body: JSON.stringify({ submission_id: submissionId }),
    });
    if (!judgeResponse.ok) {
      throw new Error(`Judge service returned ${judgeResponse.status}`);
    }

    return NextResponse.json({ submission: created }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process submission";
    if (submissionId !== undefined) {
      await db
        .update(submissions)
        .set({ status: "runtime_error", errorMessage: message, completedAt: new Date() })
        .where(eq(submissions.id, submissionId));
    }
    const status = message === "Authentication required" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

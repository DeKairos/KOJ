import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { problems, submissions } from "@/db/schema";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    }

    const [submission] = await db
      .select({ submission: submissions, problemTitle: problems.title })
      .from(submissions)
      .innerJoin(problems, eq(problems.id, submissions.problemId))
      .where(and(eq(submissions.id, id), eq(submissions.userId, user.clerkId)));
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load submission";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 });
  }
}

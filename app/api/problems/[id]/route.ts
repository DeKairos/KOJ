import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { problems, problemTestCases } from "@/db/schema";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const problemId = Number(id);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    return NextResponse.json({ error: "Invalid problem id" }, { status: 400 });
  }

  const [problem] = await db
    .select()
    .from(problems)
    .where(and(eq(problems.id, problemId), eq(problems.status, "published")));
  if (!problem) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }

  const samples = await db
    .select({ id: problemTestCases.id, input: problemTestCases.input, expectedOutput: problemTestCases.expectedOutput, position: problemTestCases.position })
    .from(problemTestCases)
    .where(and(eq(problemTestCases.problemId, problemId), eq(problemTestCases.isSample, true)));

  return NextResponse.json({ problem, samples });
}

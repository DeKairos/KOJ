import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { problems } from "@/db/schema";
import { parseProblemInput } from "@/lib/problem-input";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const publishedProblems = await db
    .select()
    .from(problems)
    .where(eq(problems.status, "published"))
    .orderBy(desc(problems.createdAt));

  return NextResponse.json({ problems: publishedProblems });
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["problem_setter", "admin"]);
    const input = parseProblemInput(await request.json());
    const [problem] = await db
      .insert(problems)
      .values({ ...input, authorId: user.clerkId })
      .returning();

    return NextResponse.json({ problem }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create problem";
    const status = message === "Authentication required" ? 401 : message === "Insufficient permissions" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

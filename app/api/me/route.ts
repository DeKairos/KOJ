import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load user";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

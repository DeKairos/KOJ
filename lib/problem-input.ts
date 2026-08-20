import type { NewProblem } from "@/db/schema";

type ProblemInput = Pick<
  NewProblem,
  | "title"
  | "statement"
  | "inputFormat"
  | "outputFormat"
  | "constraints"
  | "explanation"
  | "difficulty"
  | "tags"
  | "timeLimitMs"
  | "memoryLimitMb"
>;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function positiveInteger(value: unknown, field: string, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }

  return value;
}

export function parseProblemInput(payload: unknown): ProblemInput {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Request body must be an object");
  }

  const input = payload as Record<string, unknown>;
  const difficulty = input.difficulty ?? "easy";
  if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
    throw new Error("difficulty must be easy, medium, or hard");
  }

  const tags = input.tags ?? [];
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
    throw new Error("tags must be an array of strings");
  }

  return {
    title: requiredString(input.title, "title"),
    statement: requiredString(input.statement, "statement"),
    inputFormat: requiredString(input.inputFormat, "inputFormat"),
    outputFormat: requiredString(input.outputFormat, "outputFormat"),
    constraints: requiredString(input.constraints, "constraints"),
    explanation: typeof input.explanation === "string" ? input.explanation.trim() : null,
    difficulty,
    tags: tags.map((tag) => tag.trim()).filter(Boolean),
    timeLimitMs: positiveInteger(input.timeLimitMs, "timeLimitMs", 1000),
    memoryLimitMb: positiveInteger(input.memoryLimitMb, "memoryLimitMb", 256),
  };
}

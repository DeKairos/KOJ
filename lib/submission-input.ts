export type SubmissionInput = {
  problemId: number;
  contestId: number | null;
  language: "python" | "cpp";
  code: string;
};

export function parseSubmissionInput(payload: unknown): SubmissionInput {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Request body must be an object");
  }

  const input = payload as Record<string, unknown>;
  const problemId = input.problemId;
  const contestId = input.contestId;
  const language = input.language;
  const code = input.code;

  if (typeof problemId !== "number" || !Number.isInteger(problemId) || problemId <= 0) {
    throw new Error("problemId must be a positive integer");
  }
  if (contestId !== undefined && contestId !== null && (typeof contestId !== "number" || !Number.isInteger(contestId) || contestId <= 0)) {
    throw new Error("contestId must be a positive integer");
  }
  if (language !== "python" && language !== "cpp") {
    throw new Error("Only Python and C++ submissions are supported");
  }
  if (typeof code !== "string" || code.trim().length === 0 || code.length > 100_000) {
    throw new Error("code must be between 1 and 100000 characters");
  }

  return { problemId, contestId: contestId ?? null, language, code };
}

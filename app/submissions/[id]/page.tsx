"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navigation from "@/app/components/Navigation";

type Submission = {
  id: number;
  language: string;
  status: string;
  executionTimeMs: number | null;
  passedTests: number | null;
  totalTests: number | null;
  errorMessage: string | null;
  submittedAt: string;
  problemTitle: string;
};

const verdictLabels: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "Time Limit Exceeded",
  memory_limit_exceeded: "Memory Limit Exceeded",
  runtime_error: "Runtime Error",
  compilation_error: "Compilation Error",
};

function statusColor(status: string): string {
  if (status === "accepted") return "text-green-400";
  if (status === "wrong_answer" || status === "runtime_error" || status === "compilation_error") return "text-red-400";
  return "text-yellow-400";
}

export default function SubmissionStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const response = await fetch(`/api/submissions/${id}`);
      if (!response.ok) {
        if (active) setError("Unable to load this submission.");
        return;
      }
      const data = (await response.json()) as { submission: Submission; problemTitle: string };
      if (!active) return;
      setSubmission({ ...data.submission, problemTitle: data.problemTitle });
      if (data.submission.status === "pending" || data.submission.status === "running") {
        timer = setTimeout(load, 1000);
      }
    };

    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const status = submission?.status ?? "pending";
  const label = verdictLabels[status] ?? status;
  const complete = submission && !["pending", "running"].includes(submission.status);
  const progress = complete ? 100 : status === "running" ? 58 : 0;

  return (
    <>
      <Navigation />
      <main className="pt-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/problems" className="text-xs font-mono text-kjtext-muted hover:text-kjprimary">← Return to problems</Link>
        <div className="mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-mono text-kjprimary">Submission monitor</p>
            <h1 className="text-3xl font-mono font-bold text-kjtext mt-2">Submission #{id}</h1>
          </div>
          <span className={`font-mono text-sm ${statusColor(status)}`}>{complete && status === "accepted" ? "✓ " : "◌ "}{label.toUpperCase()}</span>
        </div>
        {error ? <p className="mt-8 border border-red-400/30 bg-red-400/5 rounded p-4 text-sm text-red-300">{error}</p> : (
          <>
            <section className="mt-8 bg-kjsurface border border-kjborder rounded-lg p-6">
              <div className="grid sm:grid-cols-4 gap-5 text-xs font-mono">
                <div><p className="text-kjtext-muted">PROBLEM</p><p className="text-kjtext mt-2">{submission?.problemTitle ?? "Loading..."}</p></div>
                <div><p className="text-kjtext-muted">LANGUAGE</p><p className="text-kjtext mt-2">{submission?.language ?? "--"}</p></div>
                <div><p className="text-kjtext-muted">SUBMITTED</p><p className="text-kjtext mt-2">{submission ? new Date(submission.submittedAt).toLocaleString() : "--"}</p></div>
                <div><p className="text-kjtext-muted">VERDICT</p><p className={`mt-2 ${statusColor(status)}`}>{label}</p></div>
              </div>
              <div className="mt-10">
                <div className="flex justify-between text-xs font-mono text-kjtext-muted mb-2"><span>TEST CASE PROGRESS</span><span>{submission?.passedTests ?? "--"} / {submission?.totalTests ?? "--"}</span></div>
                <div className="h-2 rounded bg-kjbg overflow-hidden"><div className="h-full bg-kjprimary transition-all duration-700" style={{ width: `${progress}%` }} /></div>
              </div>
              {submission?.errorMessage && <pre className="mt-6 whitespace-pre-wrap border border-red-400/20 bg-kjbg rounded p-4 text-xs text-red-300">{submission.errorMessage}</pre>}
            </section>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="bg-kjsurface border border-kjborder rounded-lg p-5"><p className="text-xs font-mono text-kjtext-muted">RUNTIME</p><p className="text-2xl font-mono text-kjtext mt-2">{submission?.executionTimeMs == null ? "--" : `${submission.executionTimeMs} ms`}</p></div>
              <div className="bg-kjsurface border border-kjborder rounded-lg p-5"><p className="text-xs font-mono text-kjtext-muted">STATUS</p><p className={`text-2xl font-mono mt-2 ${statusColor(status)}`}>{label}</p></div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

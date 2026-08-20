"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navigation from "@/app/components/Navigation";

type Problem = {
  id: number;
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  explanation: string | null;
  difficulty: string;
  tags: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
};

type Sample = { id: number; input: string; expectedOutput: string; position: number };

const starter = "# Write your solution here\n\ndef solve():\n    pass\n\nif __name__ == \"__main__\":\n    solve()";

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(starter);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch(`/api/problems/${id}`);
      if (!response.ok) {
        if (active) setNotice("Problem not found or not published.");
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { problem: Problem; samples: Sample[] };
      if (!active) return;
      setProblem(data.problem);
      setSamples(data.samples);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [id]);

  const submit = async () => {
    if (!problem) return;
    setNotice("Submitting code...");
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: problem.id, language, code }),
    });
    const data = (await response.json()) as { submission?: { id: number }; error?: string };
    if (!response.ok || !data.submission) {
      setNotice(data.error ?? "Submission failed.");
      return;
    }
    router.push(`/submissions/${data.submission.id}`);
  };

  return (
    <>
      <Navigation />
      <main className="pt-20 min-h-screen">
        {loading ? <p className="max-w-7xl mx-auto px-4 py-12 text-sm font-mono text-kjtext-muted">Loading problem...</p> : !problem ? <p className="max-w-7xl mx-auto px-4 py-12 text-sm font-mono text-red-300">{notice}</p> : (
          <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] gap-6">
            <article className="bg-kjsurface/40 border border-kjborder rounded-lg p-6 lg:p-8">
              <Link href="/problems" className="text-xs font-mono text-kjtext-muted hover:text-kjprimary">← Back to archive</Link>
              <div className="flex flex-wrap gap-2 mt-6 mb-3"><span className="text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-1 text-xs font-mono">{problem.difficulty}</span>{problem.tags.map((tag) => <span key={tag} className="text-kjtext-muted bg-kjbg border border-kjborder rounded-full px-2 py-1 text-xs font-mono">{tag}</span>)}</div>
              <h1 className="text-3xl font-mono font-bold text-kjtext mb-8">{problem.title}</h1>
              {[ ["Problem Statement", problem.statement], ["Input Format", problem.inputFormat], ["Output Format", problem.outputFormat], ["Constraints", problem.constraints] ].map(([heading, text]) => <section key={heading} className="mb-7"><h2 className="text-xs uppercase tracking-widest font-mono text-kjprimary border-b border-kjborder pb-2 mb-3">{heading}</h2><p className="text-sm text-kjtext-muted leading-7 whitespace-pre-wrap">{text}</p></section>)}
              {samples.length > 0 && <div className="grid sm:grid-cols-2 gap-3 mb-7">{samples.slice(0, 2).map((sample) => <div key={sample.id} className="bg-kjbg border border-kjborder rounded p-4 text-xs text-kjtext"><p className="text-kjtext-muted font-mono mb-3">SAMPLE {sample.position + 1}</p><pre className="whitespace-pre-wrap">{sample.input}</pre><p className="text-kjtext-muted font-mono mt-4 mb-2">OUTPUT</p><pre className="whitespace-pre-wrap">{sample.expectedOutput}</pre></div>)}</div>}
              {problem.explanation && <section className="mb-7"><h2 className="text-xs uppercase tracking-widest font-mono text-kjprimary border-b border-kjborder pb-2 mb-3">Explanation</h2><p className="text-sm text-kjtext-muted leading-7 whitespace-pre-wrap">{problem.explanation}</p></section>}
              <div className="flex gap-5 text-xs font-mono text-kjtext-muted"><span>TIME {problem.timeLimitMs} ms</span><span>MEMORY {problem.memoryLimitMb} MB</span></div>
            </article>
            <section className="bg-kjsurface/40 border border-kjborder rounded-lg p-4 lg:p-5 h-fit lg:sticky lg:top-20">
              <div className="flex items-center justify-between border-b border-kjborder pb-3 mb-3"><p className="text-xs uppercase tracking-widest font-mono text-kjprimary">Submit solution</p><select value={language} onChange={(event) => setLanguage(event.target.value)} className="bg-kjbg border border-kjborder rounded px-3 py-2 text-xs font-mono text-kjtext"><option value="python">Python</option><option value="cpp">C++</option></select></div>
              <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} className="w-full min-h-[360px] resize-y bg-kjbg border border-kjborder rounded p-4 text-sm leading-6 font-mono text-kjtext focus:border-kjprimary focus:outline-none" />
              <div className="flex gap-3 mt-4"><button onClick={() => setNotice("Sample execution is available after the judge worker is connected.")} className="border border-kjborder text-kjtext font-mono text-xs px-4 py-2 rounded hover:border-kjprimary hover:text-kjprimary">RUN SAMPLE</button><button onClick={() => void submit()} className="bg-kjprimary text-kjbg font-mono font-bold text-xs px-5 py-2 rounded hover:glow-sm">SUBMIT</button></div>
              {notice && <p className="mt-4 border border-kjprimary/20 bg-kjprimary/5 rounded p-3 text-xs font-mono text-kjprimary">{notice}</p>}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import UploadDropzone from "@/components/UploadDropzone";
import Timeline from "@/components/Timeline";
import type { AnalysisResult, ParseResult } from "@/lib/types";

type Stage = "idle" | "extracting" | "analyzing" | "done" | "error";

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  async function handleFileSelected(file: File) {
    setError(null);
    setAnalysis(null);
    setParseResult(null);

    // --- Stage 1: extract & normalize on the server ---
    setStage("extracting");
    let parsed: ParseResult;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? `Extraction failed with status ${res.status}`);
      }

      parsed = data as ParseResult;
      setParseResult(parsed);
    } catch (err) {
      setError((err as Error).message || "Failed to extract the archive.");
      setStage("error");
      return;
    }

    // --- Stage 2: send normalized entries to the LLM agent ---
    setStage("analyzing");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: parsed.entries }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? `Analysis failed with status ${res.status}`);
      }

      setAnalysis(data as AnalysisResult);
      setStage("done");
    } catch (err) {
      setError((err as Error).message || "Failed to analyze the logs.");
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setError(null);
    setParseResult(null);
    setAnalysis(null);
  }

  const isBusy = stage === "extracting" || stage === "analyzing";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mb-10 flex items-center gap-3">
        <Image src="/logo.svg" alt="Automated RCA Log Aggregator logo" width={44} height={44} priority />
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Automated RCA Log Aggregator</h1>
          <p className="text-sm text-slate-400">
            Upload SCADA, Windows, and SQL logs to generate a unified incident timeline.
          </p>
        </div>
      </header>

      {stage !== "done" && (
        <UploadDropzone onFileSelected={handleFileSelected} disabled={isBusy} />
      )}

      {isBusy && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-base-700 bg-base-900 px-4 py-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-signal-500" />
          {stage === "extracting"
            ? "Extracting archive and normalizing log timestamps…"
            : `Analyzing ${parseResult?.entries.length ?? 0} log entries for cascading failures…`}
        </div>
      )}

      {parseResult && parseResult.warnings.length > 0 && stage !== "error" && (
        <details className="mt-4 rounded-lg border border-base-700 bg-base-900 px-4 py-3 text-sm text-slate-400">
          <summary className="cursor-pointer text-slate-300">
            {parseResult.warnings.length} parsing warning{parseResult.warnings.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {parseResult.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {stage === "error" && error && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1 text-red-300">{error}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs hover:bg-red-500/10"
          >
            <RotateCcw className="h-3 w-3" />
            Try again
          </button>
        </div>
      )}

      {stage === "done" && analysis && (
        <div className="mt-8">
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border border-base-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-base-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Analyze another bundle
            </button>
          </div>
          <Timeline result={analysis} />
        </div>
      )}
    </main>
  );
}

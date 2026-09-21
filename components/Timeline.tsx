"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, Info, XCircle, ChevronDown, Server, Database, Cpu, HelpCircle } from "lucide-react";
import clsx from "clsx";
import type { AnalysisResult, TimelineEvent, LogSource } from "@/lib/types";

const SEVERITY_CONFIG: Record<
  TimelineEvent["severity"],
  { icon: typeof Info; color: string; ring: string }
> = {
  critical: { icon: XCircle, color: "text-red-500", ring: "ring-red-500/30" },
  error: { icon: AlertOctagon, color: "text-alert-500", ring: "ring-alert-500/30" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", ring: "ring-yellow-400/30" },
  info: { icon: Info, color: "text-signal-500", ring: "ring-signal-500/30" },
};

const SOURCE_CONFIG: Record<LogSource, { icon: typeof Server; label: string }> = {
  "windows-event": { icon: Server, label: "Windows Event" },
  "sql-server": { icon: Database, label: "SQL Server" },
  scada: { icon: Cpu, label: "SCADA" },
  unknown: { icon: HelpCircle, label: "Unclassified" },
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const SeverityIcon = SEVERITY_CONFIG[event.severity]?.icon ?? Info;
  const severityColor = SEVERITY_CONFIG[event.severity]?.color ?? "text-slate-400";
  const SourceIcon = SOURCE_CONFIG[event.source]?.icon ?? HelpCircle;

  return (
    <li className="relative pl-10">
      {/* Timeline rail node */}
      <span
        className={clsx(
          "absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-base-800 ring-4",
          SEVERITY_CONFIG[event.severity]?.ring ?? "ring-base-700"
        )}
      >
        <SeverityIcon className={clsx("h-4 w-4", severityColor)} />
      </span>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full rounded-lg border border-base-700 bg-base-900 p-4 text-left transition hover:border-base-500"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{formatTimestamp(event.timestamp)}</span>
              <span className="text-base-700">•</span>
              <span className="inline-flex items-center gap-1">
                <SourceIcon className="h-3.5 w-3.5" />
                {SOURCE_CONFIG[event.source]?.label ?? event.source}
              </span>
              <span
                className={clsx(
                  "ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  severityColor,
                  "bg-current/10"
                )}
              >
                {event.severity}
              </span>
            </div>
            <h3 className="mt-1 font-medium text-slate-100">{event.title}</h3>
          </div>
          <ChevronDown
            className={clsx("h-4 w-4 shrink-0 text-slate-500 transition-transform", expanded && "rotate-180")}
          />
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-base-700 pt-3 text-sm text-slate-300">
            <p>{event.description}</p>
            {event.causalNote && (
              <p className="rounded-md bg-signal-500/10 px-3 py-2 text-signal-500">
                <span className="font-semibold">Causal link: </span>
                {event.causalNote}
              </p>
            )}
          </div>
        )}
      </button>
    </li>
  );
}

export default function Timeline({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-8">
      {result.partial && (
        <div className="flex items-start gap-2 rounded-lg border border-alert-600/40 bg-alert-600/10 px-4 py-3 text-sm text-alert-500">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Some portions of this log set could not be analyzed (the model failed on one or more chunks). This
            timeline may be incomplete — consider re-running the analysis.
          </span>
        </div>
      )}

      <section className="rounded-xl border border-base-700 bg-base-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Summary</h2>
        <p className="mt-2 text-slate-100">{result.summary}</p>

        <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Probable Root Cause</h2>
        <p className="mt-2 text-alert-500">{result.probableRootCause}</p>

        {result.crossDomainCorrelations.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Cross-Domain Correlations
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              {result.crossDomainCorrelations.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Incident Timeline ({result.timeline.length} events)
        </h2>
        {result.timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline events were identified from the provided logs.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-base-700 ml-4">
            {result.timeline.map((event, i) => (
              <TimelineEventCard key={i} event={event} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

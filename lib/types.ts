// Shared domain types used across the upload -> parse -> analyze -> render pipeline.

/** Which subsystem a raw log file was identified as belonging to. */
export type LogSource = "windows-event" | "sql-server" | "scada" | "unknown";

/** A single normalized log line, ready to be handed to the LLM. */
export interface NormalizedLogEntry {
  /** ISO-8601 timestamp. Null if the line couldn't be time-parsed. */
  timestamp: string | null;
  source: LogSource;
  /** Original filename inside the zip this entry came from. */
  fileName: string;
  /** Raw line/message text (truncated defensively before reaching the LLM). */
  message: string;
  /** Best-effort severity guess from keyword heuristics (info/warn/error/critical). */
  severity: "info" | "warning" | "error" | "critical" | "unknown";
}

/** Result of the extraction+parsing stage, before LLM analysis. */
export interface ParseResult {
  entries: NormalizedLogEntry[];
  fileSummary: {
    fileName: string;
    source: LogSource;
    lineCount: number;
    parsedTimestampCount: number;
  }[];
  warnings: string[];
}

/** A single event in the LLM-generated incident timeline. */
export interface TimelineEvent {
  timestamp: string;
  source: LogSource;
  title: string;
  description: string;
  severity: "info" | "warning" | "error" | "critical";
  /** LLM's causal note: how this event relates to the crash / prior events. */
  causalNote?: string;
}

/** Full structured output returned by the /api/analyze route. */
export interface AnalysisResult {
  summary: string;
  probableRootCause: string;
  timeline: TimelineEvent[];
  crossDomainCorrelations: string[];
}

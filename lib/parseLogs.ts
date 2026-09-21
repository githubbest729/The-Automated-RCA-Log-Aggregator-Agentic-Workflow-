import JSZip from "jszip";
import type { LogSource, NormalizedLogEntry, ParseResult } from "./types";

// --- Configuration -----------------------------------------------------

/** Reject individual log lines longer than this to avoid pathological input. */
const MAX_LINE_LENGTH = 2000;

/** Cap total normalized entries so a huge zip can't blow the LLM context window. */
const MAX_TOTAL_ENTRIES = 20000;

/** Only these extensions are treated as log/text files worth parsing. */
const PARSEABLE_EXTENSIONS = [".log", ".txt", ".csv", ".evtx.txt", ".xel.txt", ".json"];

// --- Timestamp patterns --------------------------------------------------
// Real-world logs are inconsistent. We try several common formats in order:
//   1. ISO-8601:                 2024-06-01T14:32:01.123Z
//   2. Windows Event Log style:  6/1/2024 2:32:01 PM
//   3. SQL Server trace style:   2024-06-01 14:32:01.123
//   4. Syslog-ish style:         Jun  1 14:32:01
const TIMESTAMP_PATTERNS: { regex: RegExp; parse: (m: RegExpMatchArray) => Date | null }[] = [
  {
    // ISO-8601
    regex: /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
    parse: (m) => {
      const d = new Date(m[1].replace(" ", "T"));
      return isNaN(d.getTime()) ? null : d;
    },
  },
  {
    // US-style M/D/YYYY h:mm:ss AM/PM (common in Windows Event Viewer exports)
    regex: /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s?(AM|PM)?/i,
    parse: (m) => {
      const [, datePart, timePart, ampm] = m;
      const d = new Date(`${datePart} ${timePart} ${ampm ?? ""}`.trim());
      return isNaN(d.getTime()) ? null : d;
    },
  },
  {
    // Syslog-style: "Jun  1 14:32:01" — no year, so we assume current year.
    // This is a best-effort fallback; flagged via null on failure.
    regex: /([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/,
    parse: (m) => {
      const withYear = `${m[1]} ${new Date().getFullYear()}`;
      const d = new Date(withYear);
      return isNaN(d.getTime()) ? null : d;
    },
  },
];

/** Extracts the first recognizable timestamp from a raw log line. */
function extractTimestamp(line: string): string | null {
  for (const { regex, parse } of TIMESTAMP_PATTERNS) {
    const match = line.match(regex);
    if (match) {
      const date = parse(match);
      if (date) return date.toISOString();
    }
  }
  return null;
}

/** Heuristic severity classification from keywords in the line. */
function classifySeverity(line: string): NormalizedLogEntry["severity"] {
  const lower = line.toLowerCase();
  if (/\b(fatal|critical|crash(ed)?|panic|corrupt(ion)?)\b/.test(lower)) return "critical";
  if (/\b(error|exception|fail(ed|ure)?|timeout|deadlock)\b/.test(lower)) return "error";
  if (/\b(warn(ing)?|retry|degraded|latency)\b/.test(lower)) return "warning";
  if (/\b(info|information|started|completed|success)\b/.test(lower)) return "info";
  return "unknown";
}

/** Infers which subsystem a file belongs to, from its name and early content. */
function classifySource(fileName: string, sampleContent: string): LogSource {
  const name = fileName.toLowerCase();
  const sample = sampleContent.toLowerCase();

  if (name.includes("evtx") || name.includes("eventlog") || name.includes("system32") || /source:\s*microsoft-windows/i.test(sampleContent)) {
    return "windows-event";
  }
  if (name.includes("sql") || name.includes("xel") || name.includes("mssql") || sample.includes("sql server") || sample.includes("deadlock")) {
    return "sql-server";
  }
  if (name.includes("scada") || name.includes("hmi") || name.includes("plc") || name.includes("rtu") || sample.includes("scada")) {
    return "scada";
  }
  return "unknown";
}

/** Returns true if a zip entry's name looks like a text log worth parsing. */
function isParseableFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  // Skip directories, hidden/system files (e.g. __MACOSX), and binaries.
  if (lower.endsWith("/") || lower.includes("__macosx") || lower.startsWith(".")) {
    return false;
  }
  return PARSEABLE_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
    // Fallback: no recognized extension at all is often still a plain-text log export.
    !lower.includes(".");
}

/**
 * Extracts a .zip archive (as an ArrayBuffer), reads every parseable text
 * file inside it, and normalizes each line into a structured log entry.
 *
 * Designed to fail gracefully: a single malformed file or line never aborts
 * the whole run — issues are collected into `warnings` instead.
 */
export async function extractAndParseZip(zipBuffer: ArrayBuffer): Promise<ParseResult> {
  const warnings: string[] = [];
  const entries: NormalizedLogEntry[] = [];
  const fileSummary: ParseResult["fileSummary"] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch (err) {
    throw new Error(
      `Uploaded file could not be read as a .zip archive. It may be corrupted or not actually a zip. (${(err as Error).message})`
    );
  }

  const fileEntries = Object.values(zip.files).filter((f) => !f.dir);

  if (fileEntries.length === 0) {
    warnings.push("The archive contains no files.");
    return { entries, fileSummary, warnings };
  }

  for (const file of fileEntries) {
    if (entries.length >= MAX_TOTAL_ENTRIES) {
      warnings.push(
        `Reached the maximum of ${MAX_TOTAL_ENTRIES} log entries; remaining files (including "${file.name}") were skipped. Consider splitting the upload.`
      );
      break;
    }

    if (!isParseableFile(file.name)) {
      warnings.push(`Skipped "${file.name}": not a recognized log/text format.`);
      continue;
    }

    let content: string;
    try {
      content = await file.async("text");
    } catch (err) {
      warnings.push(`Failed to read "${file.name}": ${(err as Error).message}`);
      continue;
    }

    if (!content || content.trim().length === 0) {
      warnings.push(`Skipped "${file.name}": file is empty.`);
      continue;
    }

    const source = classifySource(file.name, content.slice(0, 2000));
    const rawLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    let parsedTimestampCount = 0;
    let lineCount = 0;

    for (const rawLine of rawLines) {
      if (entries.length >= MAX_TOTAL_ENTRIES) break;

      const line = rawLine.length > MAX_LINE_LENGTH ? rawLine.slice(0, MAX_LINE_LENGTH) + " …[truncated]" : rawLine;
      const timestamp = extractTimestamp(line);
      if (timestamp) parsedTimestampCount++;
      lineCount++;

      entries.push({
        timestamp,
        source,
        fileName: file.name,
        message: line,
        severity: classifySeverity(line),
      });
    }

    fileSummary.push({
      fileName: file.name,
      source,
      lineCount,
      parsedTimestampCount,
    });

    if (parsedTimestampCount === 0 && lineCount > 0) {
      warnings.push(
        `No timestamps could be parsed from "${file.name}" (${lineCount} lines). These entries will be included but may not place correctly on the timeline.`
      );
    }
  }

  // Sort chronologically where possible; entries with no timestamp sink to the end
  // in their original file order, since we can't place them reliably.
  entries.sort((a, b) => {
    if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return 0;
  });

  return { entries, fileSummary, warnings };
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult, NormalizedLogEntry, TimelineEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120; // LLM analysis of large log sets can take a while

// --- Configuration -------------------------------------------------------

// Keep chunks well under the model's context window, leaving room for the
// system prompt, prior-chunk summary context, and the response itself.
const MAX_ENTRIES_PER_CHUNK = 800;
const MODEL = "claude-sonnet-4-5"; // swap for a different Claude model as needed

const SYSTEM_PROMPT = `You are an expert industrial-systems Root Cause Analysis (RCA) agent for enterprise SCADA technical support.

You will be given normalized log entries pulled from three distinct domains that were bundled together after a system crash:
- "windows-event": Windows Event Log entries (OS, services, drivers)
- "sql-server": SQL Server trace/error log entries (deadlocks, timeouts, connection failures)
- "scada": SCADA/HMI/PLC application diagnostic entries (tag failures, comm loss, alarms)
- "unknown": entries that couldn't be confidently classified

Your job is to find CASCADING FAILURES: causal chains that cross domain boundaries. A single SQL timeout is noise; a SQL deadlock at 14:32:01 followed by a SCADA tag-read failure at 14:32:04 followed by a Windows service crash at 14:32:09 is a cascade — and that pattern, across domains, in tight time proximity, is exactly what you must surface.

Rules:
1. Only report events that are actually present in the provided log entries. Never invent timestamps, error codes, or messages.
2. Prioritize entries with severity "error" or "critical", but include "warning" entries when they are part of a causal chain leading to a failure.
3. Order the timeline chronologically.
4. For each timeline event, write a "causalNote" ONLY when you can articulate a specific relationship to a preceding or following event (e.g. "Occurs 3 seconds after the SQL deadlock in event #2, suggesting the SCADA data layer lost its connection as a result"). Omit it if there's no clear causal link.
5. Identify cross-domain correlations explicitly — this is the primary value of your analysis over reading each log separately.
6. Be conservative: if the logs don't show a clear crash cause, say so honestly in "probableRootCause" rather than speculating.
7. Ignore purely informational/routine entries (startup messages, heartbeats, successful transactions) unless they establish necessary context for the failure chain.`;

// The tool schema forces the model to return well-formed, typed JSON instead
// of free text we'd have to hope parses correctly.
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "submit_rca_analysis",
  description: "Submit the structured root-cause-analysis timeline for this batch of log entries.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "2-4 sentence plain-language summary of what happened, for a technician who hasn't read the raw logs.",
      },
      probableRootCause: {
        type: "string",
        description: "Best-supported root cause, or an honest statement that it's inconclusive from these logs.",
      },
      timeline: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", description: "ISO-8601 timestamp copied from the source entry." },
            source: { type: "string", enum: ["windows-event", "sql-server", "scada", "unknown"] },
            title: { type: "string", description: "Short (<10 word) event label." },
            description: { type: "string", description: "What happened, grounded in the actual log message." },
            severity: { type: "string", enum: ["info", "warning", "error", "critical"] },
            causalNote: { type: "string", description: "Optional causal link to another event. Omit if none." },
          },
          required: ["timestamp", "source", "title", "description", "severity"],
        },
      },
      crossDomainCorrelations: {
        type: "array",
        items: { type: "string" },
        description: "Plain-language statements of cascades that cross Windows/SQL/SCADA boundaries.",
      },
    },
    required: ["summary", "probableRootCause", "timeline", "crossDomainCorrelations"],
  },
};

/** Splits the full entry list into model-sized chunks, preserving chronological order. */
function chunkEntries(entries: NormalizedLogEntry[], size: number): NormalizedLogEntry[][] {
  const chunks: NormalizedLogEntry[][] = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size));
  }
  return chunks;
}

/** Serializes entries compactly to keep token usage down. */
function serializeChunk(entries: NormalizedLogEntry[]): string {
  return entries
    .map((e) => `[${e.timestamp ?? "UNKNOWN_TIME"}] (${e.source}/${e.severity}) ${e.fileName}: ${e.message}`)
    .join("\n");
}

/** Calls Claude on a single chunk and extracts the structured tool-use result. */
async function analyzeChunk(
  client: Anthropic,
  entries: NormalizedLogEntry[],
  chunkIndex: number,
  totalChunks: number
): Promise<AnalysisResult> {
  const contextNote =
    totalChunks > 1
      ? `This is chunk ${chunkIndex + 1} of ${totalChunks} from a larger log set, already in chronological order. Analyze only this chunk's entries; correlation across chunks is handled in a later merge step.`
      : "This is the complete log set for this incident.";

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_rca_analysis" },
    messages: [
      {
        role: "user",
        content: `${contextNote}\n\nLog entries:\n${serializeChunk(entries)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error(`Model did not return a structured analysis for chunk ${chunkIndex + 1}.`);
  }

  return toolUse.input as AnalysisResult;
}

/** Merges per-chunk analyses into one final result, re-sorting the combined timeline. */
function mergeAnalyses(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 1) return results[0];

  const timeline: TimelineEvent[] = results
    .flatMap((r) => r.timeline)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    summary: results.map((r) => r.summary).join(" "),
    probableRootCause:
      results.find((r) => r.probableRootCause && !/inconclusive/i.test(r.probableRootCause))?.probableRootCause ??
      results[results.length - 1].probableRootCause,
    timeline,
    crossDomainCorrelations: Array.from(new Set(results.flatMap((r) => r.crossDomainCorrelations))),
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: ANTHROPIC_API_KEY is not set." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const entries: NormalizedLogEntry[] | undefined = body?.entries;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'entries' array (output of /api/parse)." },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });
    const chunks = chunkEntries(entries, MAX_ENTRIES_PER_CHUNK);

    const chunkResults: AnalysisResult[] = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await analyzeChunk(client, chunks[i], i, chunks.length);
        chunkResults.push(result);
      } catch (err) {
        // A single failed chunk shouldn't discard everything else we successfully analyzed.
        console.error(`[/api/analyze] chunk ${i + 1}/${chunks.length} failed:`, err);
      }
    }

    if (chunkResults.length === 0) {
      return NextResponse.json(
        { error: "The analysis model failed on every chunk of the log data. Please try again." },
        { status: 502 }
      );
    }

    const merged = mergeAnalyses(chunkResults);
    const partial = chunkResults.length < chunks.length;

    return NextResponse.json({ ...merged, partial }, { status: 200 });
  } catch (err) {
    console.error("[/api/analyze] fatal error:", err);
    const message = (err as Error).message ?? "unknown error";
    // Surface Anthropic rate-limit/overload errors distinctly so the UI can suggest a retry.
    const status = /rate.?limit|overloaded/i.test(message) ? 429 : 500;
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status });
  }
}

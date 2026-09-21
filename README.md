# Automated RCA Log Aggregator

Upload a `.zip` of disparate SCADA, Windows Event, and SQL Server logs.
The app extracts and normalizes the entries, then routes them through an
LLM agent (Claude, via the Anthropic SDK) to produce a unified,
chronological root-cause-analysis timeline of the cascading failures that
led up to a system crash.

## Stack

- Next.js 14 (App Router) + TypeScript
- Bun as package manager/runtime (npm-compatible `package.json`)
- Tailwind CSS
- `jszip` for archive extraction
- `@anthropic-ai/sdk` for the analysis agent
- Deployed to Render via GitHub Actions

## Setup

See `SETUP_COMMANDS.md` for the full init → GitHub → deploy command sequence.

```bash
bun install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
bun run dev
```

## Architecture

```
app/
  page.tsx                 Frontend: upload -> extract -> analyze -> render
  layout.tsx                SEO metadata, fonts, global shell
  api/parse/route.ts        Unzips + normalizes log timestamps (no LLM call)
  api/analyze/route.ts      Chunks normalized entries, calls Claude with a
                             tool-forced schema, merges chunk results
components/
  UploadDropzone.tsx         Drag-and-drop .zip upload with client-side validation
  Timeline.tsx                Renders the AnalysisResult as an interactive timeline
lib/
  parseLogs.ts                Extraction, timestamp normalization, source/severity heuristics
  types.ts                    Shared types across the pipeline
```

## Notes on scaling this further

- **Very large bundles**: `MAX_ENTRIES_PER_CHUNK` in `api/analyze/route.ts`
  controls how many log lines go to the model per call. Chunk results are
  merged and re-sorted, but cross-chunk causal links (an event in chunk 1
  causing an event in chunk 3) won't be detected — for very large incidents,
  consider a second "reducer" LLM pass over the per-chunk summaries.
- **Timestamp parsing**: `lib/parseLogs.ts` currently handles ISO-8601,
  US-style Windows Event Viewer exports, and syslog-style timestamps. Add
  patterns to `TIMESTAMP_PATTERNS` for any additional log formats you
  encounter (e.g. raw `.evtx` binary exports need to be pre-converted to text
  before upload; this tool expects text/log/csv files inside the zip).
- **Authentication**: this scaffold has no auth/session layer. Since SCADA
  incident logs are sensitive, add an auth gate (e.g. NextAuth or your
  enterprise SSO) before deploying anywhere reachable outside your network.

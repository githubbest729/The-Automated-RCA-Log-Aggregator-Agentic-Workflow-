import { NextRequest, NextResponse } from "next/server";
import { extractAndParseZip } from "@/lib/parseLogs";

// This route only extracts and normalizes — it does not call the LLM.
// Keeping extraction and analysis as separate endpoints lets the frontend
// show parsed file stats immediately, before the (slower, costlier) LLM call.

export const runtime = "nodejs"; // JSZip needs Node APIs, not the Edge runtime
export const maxDuration = 60; // seconds — large zips can take a while to walk

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024); // 50MB default

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file was provided. Attach a .zip file under the 'file' form field." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json(
        { error: `Expected a .zip file, got "${file.name}". Please upload a .zip archive.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is ${(
            MAX_UPLOAD_BYTES /
            1024 /
            1024
          ).toFixed(0)}MB. Try splitting the log bundle into smaller archives.`,
        },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    const result = await extractAndParseZip(buffer);

    if (result.entries.length === 0) {
      return NextResponse.json(
        {
          error:
            "No log entries could be extracted from this archive. Check that it contains readable .log/.txt/.csv files.",
          warnings: result.warnings,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // Catch-all: malformed zips, unexpected encoding issues, etc. should
    // never 500 opaquely — surface a readable message to the UI.
    console.error("[/api/parse] extraction failed:", err);
    return NextResponse.json(
      { error: `Failed to process the archive: ${(err as Error).message ?? "unknown error"}` },
      { status: 500 }
    );
  }
}

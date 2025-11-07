import { NextRequest, NextResponse } from "next/server";
import { saveMaterialFile } from "@/lib/storage/materials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
const MAX_FILES = 10;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files");
    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (entries.length > MAX_FILES) {
      return NextResponse.json({ error: `Too many files. Maximum is ${MAX_FILES}` }, { status: 400 });
    }

    const saved = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) {
        continue;
      }

      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File ${entry.name} exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` }, { status: 400 });
      }

      const arrayBuffer = await entry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const stored = await saveMaterialFile({
        buffer,
        originalName: entry.name,
        mimeType: entry.type || null,
        fileSize: entry.size,
      });
      saved.push(stored);
    }

    if (saved.length === 0) {
      return NextResponse.json({ error: "No valid files provided" }, { status: 400 });
    }

    return NextResponse.json({ files: saved });
  } catch (error) {
    console.error("Failed to upload material files", error);
    return NextResponse.json({ error: "Failed to upload files" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { saveMaterialFile } from "@/lib/storage/materials";

export const dynamic = "force-dynamic";

const MAX_FILE_MB = Number(process.env.MATERIALS_MAX_FILE_MB ?? 10);
const MAX_FILE_BYTES = Math.max(1, Math.floor(MAX_FILE_MB * 1024 * 1024));

const isReadOnlyFsError = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EROFS" || code === "EACCES";
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    
    if (!files.length) {
      return NextResponse.json({ success: false, error: "No files uploaded." }, { status: 400 });
    }

    const uploaded = [];
    
    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }
      
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `File \"${file.name}\" exceeds the ${MAX_FILE_MB}MB limit.`,
          },
          { status: 413 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const savedFile = await saveMaterialFile({
        buffer,
        originalName: file.name,
        mimeType: file.type || null,
        fileSize: file.size,
      });
      
      uploaded.push(savedFile);
    }

    return NextResponse.json({ success: true, files: uploaded });
  } catch (error) {
    if (isReadOnlyFsError(error)) {
      console.error("Failed to upload files: read-only filesystem", error);
      return NextResponse.json(
        {
          success: false,
          error: "Uploads are not supported in this deployment. Configure external storage (e.g., Vercel Blob or S3).",
        },
        { status: 503 },
      );
    }
    console.error("Failed to upload files", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}

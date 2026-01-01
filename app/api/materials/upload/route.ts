import { NextRequest, NextResponse } from "next/server";
import { saveMaterialFile } from "@/lib/storage/materials";

export const dynamic = "force-dynamic";

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
    console.error("Failed to upload files", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}

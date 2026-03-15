import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { del, put } from "@vercel/blob";

const PROFILE_IMAGE_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "profiles");

export type SavedProfileImage = {
  fileName: string;
  storedFileName: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string | null;
  fileSize: number;
};

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(PROFILE_IMAGE_UPLOAD_ROOT, { recursive: true });
}

function createStoredFileName(originalName: string): string {
  const trimmed = originalName.trim().replace(/\s+/g, " ") || "profile-image";
  const safeName = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext) || "profile-image";
  return `${base}-${randomUUID()}${ext}`;
}

export async function saveProfileImage(options: {
  buffer: Buffer;
  originalName: string;
  mimeType: string | null;
  fileSize: number;
}): Promise<SavedProfileImage> {
  const storedFileName = createStoredFileName(options.originalName || "profile-image");
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    const blobPath = path.posix.join("profiles", storedFileName);
    const { url } = await put(blobPath, options.buffer, {
      access: "public",
      contentType: options.mimeType ?? undefined,
      addRandomSuffix: false,
    });

    return {
      fileName: options.originalName,
      storedFileName,
      storagePath: url,
      publicUrl: url,
      mimeType: options.mimeType,
      fileSize: options.fileSize,
    };
  }

  await ensureUploadDir();
  const filePath = path.join(PROFILE_IMAGE_UPLOAD_ROOT, storedFileName);
  await fs.writeFile(filePath, options.buffer);

  const storagePath = path.posix.join("uploads", "profiles", storedFileName);
  const publicUrl = `/${storagePath}`;

  return {
    fileName: options.originalName,
    storedFileName,
    storagePath,
    publicUrl,
    mimeType: options.mimeType,
    fileSize: options.fileSize,
  };
}

export async function deleteProfileImage(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;

  if (/^https?:\/\//i.test(storagePath)) {
    try {
      await del(storagePath);
    } catch (error) {
      console.warn(`Failed to remove blob profile image at ${storagePath}:`, error);
    }
    return;
  }

  try {
    const normalized = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
    const filePath = path.join(process.cwd(), "public", normalized);
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    console.warn(`Failed to remove profile image at ${storagePath}:`, error);
  }
}

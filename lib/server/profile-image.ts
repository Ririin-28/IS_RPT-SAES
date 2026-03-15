import {
  PROFILE_IMAGE_ALLOWED_MIME_TYPES,
  PROFILE_IMAGE_INVALID_SIZE_MESSAGE,
  PROFILE_IMAGE_INVALID_TYPE_MESSAGE,
  PROFILE_IMAGE_MAX_FILE_BYTES,
  getProfileImageValidationMessage,
} from "@/lib/profile-image-config";
import { getTableColumns, query } from "@/lib/db";
import { deleteProfileImage, saveProfileImage, type SavedProfileImage } from "@/lib/storage/profile-images";

export const USER_PROFILE_IMAGE_COLUMN = "profile_image_url";

export class ProfileImageValidationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProfileImageValidationError";
    this.status = status;
  }
}

export async function ensureUserProfileImageColumn(): Promise<Set<string>> {
  const userColumns = await getTableColumns("users");
  if (userColumns.has(USER_PROFILE_IMAGE_COLUMN)) {
    return userColumns;
  }

  try {
    await query(
      `ALTER TABLE users ADD COLUMN ${USER_PROFILE_IMAGE_COLUMN} VARCHAR(1024) NULL`,
    );
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }

  return new Set([...userColumns, USER_PROFILE_IMAGE_COLUMN]);
}

export function validateProfileImageFile(file: File): void {
  const validationMessage = getProfileImageValidationMessage(file);
  if (!validationMessage) {
    return;
  }

  if (!PROFILE_IMAGE_ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ProfileImageValidationError(PROFILE_IMAGE_INVALID_TYPE_MESSAGE, 400);
  }

  if (file.size > PROFILE_IMAGE_MAX_FILE_BYTES) {
    throw new ProfileImageValidationError(PROFILE_IMAGE_INVALID_SIZE_MESSAGE, 413);
  }

  throw new ProfileImageValidationError(validationMessage, 400);
}

export async function uploadProfileImage(file: File): Promise<SavedProfileImage> {
  validateProfileImageFile(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveProfileImage({
    buffer,
    originalName: file.name,
    mimeType: file.type || null,
    fileSize: file.size,
  });
}

export async function cleanupProfileImage(storagePath: string | null | undefined): Promise<void> {
  await deleteProfileImage(storagePath);
}

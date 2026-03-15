export const PROFILE_IMAGE_ALLOWED_MIME_TYPES = new Set(["image/jpeg"]);
export const PROFILE_IMAGE_ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg"]);
export const PROFILE_IMAGE_ACCEPT_ATTRIBUTE = ".jpg,.jpeg";
export const PROFILE_IMAGE_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_INVALID_TYPE_MESSAGE = "Only JPG/JPEG profile images are supported.";
export const PROFILE_IMAGE_INVALID_SIZE_MESSAGE = "Profile image must be 5 MB or smaller.";
export const PROFILE_IMAGE_REQUIREMENTS_TEXT = "JPG/JPEG only. Maximum file size: 5 MB.";

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }

  return fileName.slice(lastDot).toLowerCase();
}

export function getProfileImageValidationMessage(file: Pick<File, "name" | "type" | "size">): string | null {
  const fileExtension = getFileExtension(file.name);
  if (!PROFILE_IMAGE_ALLOWED_EXTENSIONS.has(fileExtension)) {
    return PROFILE_IMAGE_INVALID_TYPE_MESSAGE;
  }

  if (!PROFILE_IMAGE_ALLOWED_MIME_TYPES.has(file.type)) {
    return PROFILE_IMAGE_INVALID_TYPE_MESSAGE;
  }

  if (file.size > PROFILE_IMAGE_MAX_FILE_BYTES) {
    return PROFILE_IMAGE_INVALID_SIZE_MESSAGE;
  }

  return null;
}

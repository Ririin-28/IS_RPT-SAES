import {
  ProfileImageValidationError,
  validateProfileImageFile,
} from "../lib/server/profile-image";

describe("profile image validation", () => {
  test("accepts supported image types within size limit", () => {
    const file = new File(["image"], "profile.jpg", { type: "image/jpeg" });
    expect(() => validateProfileImageFile(file)).not.toThrow();
  });

  test("rejects unsupported image types", () => {
    const file = new File(["image"], "profile.png", { type: "image/png" });

    expect(() => validateProfileImageFile(file)).toThrow(ProfileImageValidationError);
    try {
      validateProfileImageFile(file);
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileImageValidationError);
      expect((error as ProfileImageValidationError).status).toBe(400);
    }
  });

  test("rejects files with non-jpg extensions even if mime type is jpeg", () => {
    const file = new File(["image"], "profile.txt", { type: "image/jpeg" });

    expect(() => validateProfileImageFile(file)).toThrow(ProfileImageValidationError);
    try {
      validateProfileImageFile(file);
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileImageValidationError);
      expect((error as ProfileImageValidationError).status).toBe(400);
    }
  });

  test("rejects oversized images", () => {
    const oversizedBuffer = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([oversizedBuffer], "profile.jpeg", { type: "image/jpeg" });

    expect(() => validateProfileImageFile(file)).toThrow(ProfileImageValidationError);
    try {
      validateProfileImageFile(file);
    } catch (error) {
      expect(error).toBeInstanceOf(ProfileImageValidationError);
      expect((error as ProfileImageValidationError).status).toBe(413);
    }
  });
});

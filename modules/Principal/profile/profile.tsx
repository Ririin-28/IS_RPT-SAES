"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import ProfileImageCropModal from "@/components/Common/Modals/ProfileImageCropModal";
import ToastActivity from "@/components/ToastActivity";
import UserAvatar from "@/components/Common/UserAvatar";
import {
  PROFILE_IMAGE_ACCEPT_ATTRIBUTE,
  PROFILE_IMAGE_REQUIREMENTS_TEXT,
  getProfileImageValidationMessage,
} from "@/lib/profile-image-config";
import { getStoredUserProfile, storeUserProfile } from "@/lib/utils/user-profile";

type PrincipalProfileState = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  position: string;
  profilePicture: string;
};

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function createEmptyProfile(): PrincipalProfileState {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    position: "Principal",
    profilePicture: "",
  };
}

const ROLE_LABELS: Record<string, string> = {
  principal: "Principal",
  admin: "IT Admin",
  it_admin: "IT Admin",
  itadmin: "IT Admin",
  teacher: "Teacher",
  parent: "Parent",
  master_teacher: "Master Teacher",
  masterteacher: "Master Teacher",
};

function formatRole(rawRole?: string | null): string {
  if (!rawRole) {
    return "Principal";
  }
  const normalized = rawRole.toLowerCase().replace(/\s+/g, "_");
  if (ROLE_LABELS[normalized]) {
    return ROLE_LABELS[normalized];
  }
  return rawRole
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export default function PrincipalProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [formData, setFormData] = useState<PrincipalProfileState>(() => createEmptyProfile());
  const [initialData, setInitialData] = useState<PrincipalProfileState | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedProfileImageFile, setSelectedProfileImageFile] = useState<File | null>(null);
  const [cropModalFile, setCropModalFile] = useState<File | null>(null);
  const [saveToast, setSaveToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "error";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoadingProfile(true);
      setProfileError(null);

      try {
        const storedProfile = getStoredUserProfile();
        const response = await fetch("/api/principal/profile", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "Unable to load profile.");
        }

        const profile = payload.profile ?? {};

        const derivedRole =
          typeof storedProfile?.role === "string" && storedProfile.role
            ? storedProfile.role
            : profile.role;

        const nextState: PrincipalProfileState = {
          firstName: toText(profile.firstName).trim(),
          middleName: toText(profile.middleName).trim(),
          lastName: toText(profile.lastName).trim(),
          email: toText(profile.email).trim(),
          contactNumber: toText(profile.contactNumber).trim(),
          position: formatRole(derivedRole),
          profilePicture: toText(profile.profileImageUrl).trim(),
        };

        storeUserProfile({
          firstName: nextState.firstName || storedProfile?.firstName || "",
          middleName: nextState.middleName || storedProfile?.middleName || "",
          lastName: nextState.lastName || storedProfile?.lastName || "",
          role: derivedRole ?? storedProfile?.role ?? null,
          userId: storedProfile?.userId ?? profile.userId ?? null,
          email: nextState.email || storedProfile?.email || null,
          profileImageUrl: nextState.profilePicture || storedProfile?.profileImageUrl || null,
        });

        setFormData(nextState);
        setInitialData(nextState);
        setSelectedProfileImageFile(null);
        setCropModalFile(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Failed to load principal profile", error);
        const message = error instanceof Error ? error.message : "Failed to load profile.";
        setProfileError(message);
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [reloadVersion]);

  useEffect(() => {
    if (!saveToast) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setSaveToast(null);
    }, 3500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [saveToast]);

  const handleRetry = () => {
    setReloadVersion((previous) => previous + 1);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPasswordData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSave = async () => {
    try {
      const storedProfile = getStoredUserProfile();
      const requestInit: RequestInit = { method: "PUT" };

      if (selectedProfileImageFile) {
        const requestBody = new FormData();
        requestBody.set("firstName", formData.firstName);
        requestBody.set("middleName", formData.middleName);
        requestBody.set("lastName", formData.lastName);
        requestBody.set("email", formData.email);
        requestBody.set("contactNumber", formData.contactNumber);
        requestBody.set("profileImage", selectedProfileImageFile);
        requestInit.body = requestBody;
      } else {
        requestInit.headers = { "Content-Type": "application/json" };
        requestInit.body = JSON.stringify({
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          email: formData.email,
          contactNumber: formData.contactNumber,
        });
      }

      const response = await fetch("/api/principal/profile", requestInit);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to save profile.");
      }

      const nextProfileImageUrl =
        typeof payload?.profile?.profileImageUrl === "string"
          ? payload.profile.profileImageUrl
          : initialData?.profilePicture ?? formData.profilePicture;

      const nextState: PrincipalProfileState = {
        ...formData,
        profilePicture: nextProfileImageUrl || "",
      };

      setFormData(nextState);
      setInitialData(nextState);
      setSelectedProfileImageFile(null);
      setCropModalFile(null);
      setIsEditing(false);
      setSaveToast({
        title: "Profile Saved",
        message: "Profile changes were saved successfully.",
        tone: "success",
      });

      storeUserProfile({
        firstName: nextState.firstName || storedProfile?.firstName || "",
        middleName: nextState.middleName || storedProfile?.middleName || "",
        lastName: nextState.lastName || storedProfile?.lastName || "",
        role: storedProfile?.role ?? null,
        userId: storedProfile?.userId ?? null,
        email: nextState.email || storedProfile?.email || null,
        profileImageUrl: nextState.profilePicture || null,
      });
    } catch (error) {
      console.error("Failed to save profile", error);
      setSaveToast({
        title: "Save Failed",
        message: error instanceof Error ? error.message : "Failed to save profile.",
        tone: "error",
      });
    }
  };

  const handleCancel = () => {
    if (initialData) {
      setFormData(initialData);
    }
    setSelectedProfileImageFile(null);
    setCropModalFile(null);
    setIsEditing(false);
  };

  const handlePasswordSave = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setSaveToast({
        title: "Update Failed",
        message: "New passwords do not match.",
        tone: "error",
      });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setSaveToast({
        title: "Update Failed",
        message: "Password must be at least 8 characters.",
        tone: "error",
      });
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        setSaveToast({
          title: "Password Updated",
          message: "Password changed successfully.",
          tone: "success",
        });
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setIsChangingPassword(false);
      } else {
        const data = await response.json();
        setSaveToast({
          title: "Update Failed",
          message: data.error || "Failed to change password.",
          tone: "error",
        });
      }
    } catch {
      setSaveToast({
        title: "Update Failed",
        message: "Error changing password.",
        tone: "error",
      });
    }
  };

  const handlePasswordCancel = () => {
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsChangingPassword(false);
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const validationMessage = getProfileImageValidationMessage(file);
    if (validationMessage) {
      event.target.value = "";
      setSaveToast({
        title: "Invalid Image",
        message: validationMessage,
        tone: "error",
      });
      return;
    }

    setCropModalFile(file);
  };

  const handleCropConfirm = (result: { file: File; previewUrl: string }) => {
    setIsEditing(true);
    setSelectedProfileImageFile(result.file);
    setCropModalFile(null);
    setFormData((previous) => ({
      ...previous,
      profilePicture: result.previewUrl,
    }));
  };

  const positionDisplay = formData.position || "Principal";

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <Sidebar />
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="My Profile" />
        <main className="flex-1 overflow-y-auto">
          <div className="relative p-4 h-full sm:p-5 md:p-6">
            <div className="relative h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
              <div className="max-w-4xl mx-auto">
                {isLoadingProfile ? (
                  <div className="py-16 text-center text-gray-600">Loading profile...</div>
                ) : profileError ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-center">
                    <p className="text-red-600 text-base font-medium">{profileError}</p>
                    <SecondaryButton onClick={handleRetry}>Try Again</SecondaryButton>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center mb-6">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
                          <UserAvatar
                            profileImageUrl={formData.profilePicture}
                            firstName={formData.firstName}
                            lastName={formData.lastName}
                            alt="Principal profile"
                            imageClassName="h-full w-full object-cover"
                            fallbackClassName="h-full w-full"
                            size={96}
                          />
                        </div>
                        <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#013300] rounded-full flex items-center justify-center cursor-pointer hover:bg-green-700 transition-colors shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <input
                            type="file"
                            accept={PROFILE_IMAGE_ACCEPT_ATTRIBUTE}
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div className="mt-3 px-4 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
                        <span className="text-sm font-medium text-gray-700">{positionDisplay}</span>
                      </div>
                      <p className="mt-3 text-center text-xs text-gray-500">{PROFILE_IMAGE_REQUIREMENTS_TEXT}</p>
                      {selectedProfileImageFile ? (
                        <button
                          type="button"
                          onClick={() => setCropModalFile(selectedProfileImageFile)}
                          className="mt-2 text-xs font-semibold text-[#013300] transition hover:text-green-800"
                        >
                          Adjust Photo
                        </button>
                      ) : null}
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 mb-5">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">First Name</label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                          <input
                            type="text"
                            name="middleName"
                            value={formData.middleName}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Last Name</label>
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        {!isEditing ? (
                          <PrimaryButton onClick={() => setIsEditing(true)}>Edit Profile</PrimaryButton>
                        ) : (
                          <>
                            <SecondaryButton onClick={handleCancel}>Cancel</SecondaryButton>
                            <PrimaryButton onClick={handleSave}>Save Changes</PrimaryButton>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 mb-5">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Email</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Contact Number</label>
                          <input
                            type="text"
                            name="contactNumber"
                            value={formData.contactNumber}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Security Settings</h3>
                      {!isChangingPassword ? (
                        <SecondaryButton onClick={() => setIsChangingPassword(true)}>
                          Change Password
                        </SecondaryButton>
                      ) : (
                        <>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">Current Password</label>
                              <input
                                type="password"
                                name="currentPassword"
                                value={passwordData.currentPassword}
                                onChange={handlePasswordChange}
                                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                                placeholder="Enter current password"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">New Password</label>
                              <input
                                type="password"
                                name="newPassword"
                                value={passwordData.newPassword}
                                onChange={handlePasswordChange}
                                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                                placeholder="Enter new password (min 8 characters)"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                              <input
                                type="password"
                                name="confirmPassword"
                                value={passwordData.confirmPassword}
                                onChange={handlePasswordChange}
                                className="w-full bg-white border border-gray-300 text-black rounded-md px-3 py-2 text-sm"
                                placeholder="Confirm new password"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 pt-4">
                            <SecondaryButton onClick={handlePasswordCancel}>Cancel</SecondaryButton>
                            <PrimaryButton onClick={handlePasswordSave}>Update Password</PrimaryButton>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      <ProfileImageCropModal
        isOpen={Boolean(cropModalFile)}
        file={cropModalFile}
        onClose={() => setCropModalFile(null)}
        onConfirm={handleCropConfirm}
      />
      {saveToast && (
        <ToastActivity
          title={saveToast.title}
          message={saveToast.message}
          tone={saveToast.tone}
          onClose={() => setSaveToast(null)}
          timeoutMs={3500}
        />
      )}
    </div>
  );
}

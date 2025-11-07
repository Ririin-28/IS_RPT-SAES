"use client";
import { ChangeEvent, useEffect, useState } from "react";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
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
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
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

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoadingProfile(true);
      setProfileError(null);

      try {
        const storedProfile = getStoredUserProfile();
        const rawUserId = storedProfile?.userId;
        const userIdNumber = typeof rawUserId === "string" ? Number(rawUserId) : rawUserId;

        if (!userIdNumber || !Number.isFinite(userIdNumber)) {
          throw new Error("Missing user information. Please log in again.");
        }

        const response = await fetch(
          `/api/principal/profile?userId=${encodeURIComponent(String(userIdNumber))}`,
          { cache: "no-store" },
        );

        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload?.success) {
          const message = payload?.error ?? "Unable to load profile.";
          setProfileError(message);
          return;
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
          profilePicture: "",
        };

        try {
          storeUserProfile({
            firstName: nextState.firstName || storedProfile?.firstName || "",
            middleName: nextState.middleName || storedProfile?.middleName || "",
            lastName: nextState.lastName || storedProfile?.lastName || "",
            role: derivedRole ?? storedProfile?.role ?? null,
            userId: storedProfile?.userId ?? profile.userId ?? null,
            email: nextState.email || storedProfile?.email || null,
          });
        } catch (error) {
          console.warn("Unable to sync stored user profile", error);
        }

        setFormData(nextState);
        setInitialData(nextState);
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

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [reloadVersion]);

  const handleRetry = () => {
    setReloadVersion((previous) => previous + 1);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const storedProfile = getStoredUserProfile();
      const rawUserId = storedProfile?.userId;
      const userIdNumber = typeof rawUserId === "string" ? Number(rawUserId) : rawUserId;

      if (!userIdNumber || !Number.isFinite(userIdNumber)) {
        setModalMessage("Unable to save: Missing user information.");
        setShowModal(true);
        return;
      }

      const response = await fetch(
        `/api/principal/profile?userId=${encodeURIComponent(String(userIdNumber))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            email: formData.email,
            contactNumber: formData.contactNumber,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to save profile.");
      }

      setInitialData({ ...formData });
      setIsEditing(false);
      setModalMessage("Profile updated successfully!");
      setShowModal(true);

      try {
        storeUserProfile({
          firstName: formData.firstName || storedProfile?.firstName || "",
          middleName: formData.middleName || storedProfile?.middleName || "",
          lastName: formData.lastName || storedProfile?.lastName || "",
          role: storedProfile?.role ?? null,
          userId: storedProfile?.userId ?? null,
          email: formData.email || storedProfile?.email || null,
        });
      } catch (err) {
        console.warn("Unable to update stored profile", err);
      }
    } catch (error) {
      console.error("Failed to save profile", error);
      setModalMessage(error instanceof Error ? error.message : "Failed to save profile.");
      setShowModal(true);
    }
  };

  const handleCancel = () => {
    if (initialData) {
      setFormData({ ...initialData });
    }
    setIsEditing(false);
  };

  const handlePasswordSave = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setModalMessage("New passwords do not match");
      setShowModal(true);
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setModalMessage("Password must be at least 8 characters");
      setShowModal(true);
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
        setModalMessage("Password changed successfully");
        setShowModal(true);
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setIsChangingPassword(false);
      } else {
        const data = await response.json();
        setModalMessage(data.error || "Failed to change password");
        setShowModal(true);
      }
    } catch (error) {
      setModalMessage("Error changing password");
      setShowModal(true);
    }
  };

  const handlePasswordCancel = () => {
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsChangingPassword(false);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePicture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const positionDisplay = formData.position || "Principal";

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="My Profile" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
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
                          {formData.profilePicture ? (
                            <img src={formData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <svg width="64" height="64" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
                              <circle cx="12" cy="8" r="5" />
                              <path d="M4 20v-2c0-3 4-5 8-5s8 2 8 5v2" />
                            </svg>
                          )}
                        </div>
                        <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#013300] rounded-full flex items-center justify-center cursor-pointer hover:bg-green-700 transition-colors shadow-md">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                      </div>
                      <div className="mt-3 px-4 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
                        <span className="text-sm font-medium text-gray-700">{positionDisplay}</span>
                      </div>
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
      <ConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={() => setShowModal(false)}
        title="Profile Update"
        message={modalMessage}
      />
    </div>
  );
}

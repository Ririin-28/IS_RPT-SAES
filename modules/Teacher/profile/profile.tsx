"use client";
import Sidebar from "@/components/Teacher/Sidebar";
import Header from "@/components/Teacher/Header";
import { useState, useEffect } from "react";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";

export default function TeacherProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    grade: "",
    subject: "",
    position: "",
    profilePicture: "",
  });
  const [initialData, setInitialData] = useState<typeof formData | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const storedProfile = getStoredUserProfile();
        const userId = storedProfile?.userId;
        if (!userId) return;

        const response = await fetch(`/api/teacher/profile?userId=${userId}`, { cache: "no-store" });
        const data = await response.json();
        if (data.success && data.profile) {
          const profileData = {
            firstName: data.profile.firstName || "",
            middleName: data.profile.middleName || "",
            lastName: data.profile.lastName || "",
            email: data.profile.email || "",
            contactNumber: data.profile.contactNumber || "",
            grade: data.profile.gradeLabel || "",
            subject: data.profile.subjectHandled || "English, Filipino, Math",
            position: data.profile.role ? data.profile.role.charAt(0).toUpperCase() + data.profile.role.slice(1).toLowerCase() : "Teacher",
            profilePicture: "",
          };
          setFormData(profileData);
          setInitialData(profileData);
        }
      } catch (error) {
        console.error("Failed to load profile", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const storedProfile = getStoredUserProfile();
      const userId = storedProfile?.userId;

      if (!userId) {
        setModalMessage("Unable to save: Missing user information.");
        setShowModal(true);
        return;
      }

      const response = await fetch(
        `/api/teacher/profile?userId=${encodeURIComponent(String(userId))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            email: formData.email,
            contactNumber: formData.contactNumber,
            subject: formData.subject,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to save profile.");
      }

      setInitialData(formData);
      setIsEditing(false);
      setModalMessage("Profile updated successfully!");
      setShowModal(true);
    } catch (error) {
      console.error("Failed to save profile", error);
      setModalMessage(error instanceof Error ? error.message : "Failed to save profile.");
      setShowModal(true);
    }
  };

  const handleCancel = () => {
    if (initialData) {
      setFormData(initialData);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePicture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

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
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="relative z-10 h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_20px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-5 md:p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-600">Loading profile...</p>
                </div>
              ) : (
              <div className="max-w-4xl mx-auto">
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
                    <span className="text-sm font-medium text-gray-700">{formData.position}</span>
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
                      <PrimaryButton onClick={() => setIsEditing(true)}>
                        Edit Profile
                      </PrimaryButton>
                    ) : (
                      <>
                        <SecondaryButton onClick={handleCancel}>
                          Cancel
                        </SecondaryButton>
                        <PrimaryButton onClick={handleSave}>
                          Save Changes
                        </PrimaryButton>
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

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 mb-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Teaching Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Position</label>
                      <div className="w-full bg-white/50 border border-gray-200 text-gray-700 rounded-md px-3 py-2 text-sm font-medium">
                        {formData.position}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Grade Handled</label>
                      <div className="w-full bg-gray-100 border border-gray-300 text-gray-700 rounded-md px-3 py-2 text-sm font-medium">
                        {formData.grade || "Not Assigned"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Subject Handled</label>
                      <div className="w-full bg-gray-100 border border-gray-300 text-gray-700 rounded-md px-3 py-2 text-sm font-medium">
                        {formData.subject}
                      </div>
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
                        <SecondaryButton onClick={handlePasswordCancel}>
                          Cancel
                        </SecondaryButton>
                        <PrimaryButton onClick={handlePasswordSave}>
                          Update Password
                        </PrimaryButton>
                      </div>
                    </>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <ConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={() => setShowModal(false)}
        title="Password Change"
        message={modalMessage}
      />
    </div>
  );
}

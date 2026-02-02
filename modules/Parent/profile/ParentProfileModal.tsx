"use client";

import { useState } from "react";
import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

type ParentProfileData = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  email: string | null;
  address: string | null;
  contactNumber: string | null;
};

interface ParentProfileModalProps {
  show: boolean;
  onClose: () => void;
  parent: ParentProfileData | null;
}

export default function ParentProfileModal({ show, onClose, parent }: ParentProfileModalProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [modalMessage, setModalMessage] = useState<string | null>(null);

  if (!show) return null;

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setPasswordData((previous) => ({ ...previous, [name]: value }));
  };

  const handlePasswordSave = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setModalMessage("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setModalMessage("Password must be at least 8 characters");
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

      if (!response.ok) {
        let errorMessage = "Failed to change password";
        try {
          const data = await response.json();
          if (data && typeof data.error === "string" && data.error.trim().length > 0) {
            errorMessage = data.error;
          }
        } catch {
        }
        setModalMessage(errorMessage);
        return;
      }

      setModalMessage("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsChangingPassword(false);
    } catch {
      setModalMessage("Error changing password");
    }
  };

  const footer = (
    <div className="flex justify-end gap-3">
      {isChangingPassword && (
        <SecondaryButton
          onClick={() => {
            setIsChangingPassword(false);
            setPasswordData({
              currentPassword: "",
              newPassword: "",
              confirmPassword: "",
            });
          }}
        >
          Cancel
        </SecondaryButton>
      )}
      {!isChangingPassword && (
        <SecondaryButton onClick={onClose}>
          Close
        </SecondaryButton>
      )}
      {!isChangingPassword && (
        <PrimaryButton onClick={() => setIsChangingPassword(true)}>
          Change Password
        </PrimaryButton>
      )}
      {isChangingPassword && (
        <PrimaryButton onClick={handlePasswordSave}>
          Update Password
        </PrimaryButton>
      )}
    </div>
  );

  const fullName =
    [parent?.firstName, parent?.middleName, parent?.lastName]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join(" ") || "Parent";

  return (
    <BaseModal show={show} onClose={onClose} title="My Profile" maxWidth="2xl" footer={footer}>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
            <svg width="64" height="64" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="5" />
              <path d="M4 20v-2c0-3 4-5 8-5s8 2 8 5v2" />
            </svg>
          </div>
          <div className="px-4 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
            <span className="text-sm font-medium text-gray-700">Parent</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">{fullName}</div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <ModalSection title="Personal Details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ModalInfoItem label="First Name" value={parent?.firstName ?? ""} />
              <ModalInfoItem label="Middle Name" value={parent?.middleName ?? ""} />
              <ModalInfoItem label="Last Name" value={parent?.lastName ?? ""} />
            </div>
          </ModalSection>

          <ModalSection title="Contact Details">
            <div className="grid grid-cols-1 gap-4">
              <ModalInfoItem label="Email" value={parent?.email ?? ""} />
              <ModalInfoItem label="Contact Number" value={parent?.contactNumber ?? ""} />
              <ModalInfoItem label="Address" value={parent?.address ?? ""} />
            </div>
          </ModalSection>
        </div>

        <ModalSection title="Security Settings">
          {!isChangingPassword ? (
            <p className="text-sm text-gray-600">
              Use the Change Password button below to update your account password.
            </p>
          ) : (
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
          )}
        </ModalSection>

        {modalMessage && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800">
            <div className="flex items-center justify-between gap-3">
              <span>{modalMessage}</span>
              <button
                type="button"
                className="text-xs font-semibold text-green-700 hover:text-green-900"
                onClick={() => setModalMessage(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}


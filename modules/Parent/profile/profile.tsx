"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import ProfileDropdown from "@/components/Common/ProfileDropdown";
import { performClientLogout } from "@/lib/utils/logout";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import ParentProfileModal from "./ParentProfileModal";

type ParentProfileData = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  email: string | null;
  address: string | null;
  contactNumber: string | null;
};

type ParentDashboardChild = {
  studentId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
};

type ParentDashboardResponse = {
  children?: ParentDashboardChild[];
  child?: ParentDashboardChild | null;
};

type ChildOption = {
  id: string;
  label: string;
};

export default function ParentProfile() {
  const router = useRouter();
  const [parent, setParent] = useState<ParentProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [childOptions, setChildOptions] = useState<ChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const profile = getStoredUserProfile();
    const userId = Number(profile?.userId);

    if (!Number.isFinite(userId)) {
      setIsLoading(false);
      setError("Unable to determine the signed-in parent. Please sign in again.");
      return;
    }

    const controller = new AbortController();

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ userId: String(userId) });
        const response = await fetch(`/api/parent/profile?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || !payload || typeof payload !== "object" || payload === null) {
          const message =
            typeof payload === "object" && payload && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : `Failed to load profile (${response.status})`;
          throw new Error(message);
        }

        const data = payload as {
          success: boolean;
          profile?: ParentProfileData | null;
          error?: string;
        };

        if (!data.success || !data.profile) {
          throw new Error(data.error || "Unable to load parent profile.");
        }

        setParent(data.profile);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load profile.";
        setError(message);
        setParent(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const profile = getStoredUserProfile();
    const userId = Number(profile?.userId);

    if (!Number.isFinite(userId)) {
      return;
    }

    const controller = new AbortController();

    const formatChildLabel = (first?: string | null, middle?: string | null, last?: string | null) => {
      const safeFirst = typeof first === "string" ? first.trim() : "";
      const safeLast = typeof last === "string" ? last.trim() : "";
      const middleInitial = typeof middle === "string" && middle.trim().length > 0 ? `${middle.trim()[0].toUpperCase()}.` : "";
      const combined = [safeFirst, middleInitial, safeLast].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      return combined.length > 0 ? combined : "Student";
    };

    const loadChildren = async () => {
      try {
        const query = new URLSearchParams({ userId: String(userId) });
        const response = await fetch(`/api/parent/dashboard?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || !payload || typeof payload !== "object" || payload === null) {
          throw new Error(`Failed to load children (${response.status})`);
        }

        const data = payload as ParentDashboardResponse;
        const derivedOptions: ChildOption[] = (data.children ?? []).map((child) => ({
          id: String(child.studentId),
          label: formatChildLabel(child.firstName, child.middleName, child.lastName),
        }));

        if (derivedOptions.length === 0 && data.child) {
          derivedOptions.push({
            id: String(data.child.studentId),
            label: formatChildLabel(data.child.firstName, data.child.middleName, data.child.lastName),
          });
        }

        const activeChildId = data.child ? String(data.child.studentId) : null;

        setChildOptions(derivedOptions);
        setSelectedChildId((previous) => previous ?? activeChildId ?? derivedOptions[0]?.id ?? null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.warn("Unable to load child list for profile dropdown", err);
      }
    };

    loadChildren();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!showProfileDropdown) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (
        !profileButtonRef.current?.contains(event.target as Node) &&
        !dropdownRef.current?.contains(event.target as Node)
      ) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showProfileDropdown]);

  const fullName =
    [parent?.firstName, parent?.middleName, parent?.lastName]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join(" ") || "Parent";

  const handleBackToDashboard = () => {
    router.push("/Parent/dashboard");
  };

  const handleOpenProfileModal = () => {
    setShowProfileModal(true);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <div className="relative z-10 bg-[#F4FBF4] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between rounded-[26px] bg-[#ECF9ED] px-6 py-4 shadow-[0_12px_32px_rgba(12,59,31,0.08)]">
            <h1 className="text-2xl font-semibold text-[#0C3B1F]">My Profile</h1>
            <div className="relative flex items-center">
              <button
                ref={profileButtonRef}
                type="button"
                aria-label="Profile"
                onClick={() => setShowProfileDropdown((value) => !value)}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-[#013300] hover:border-[#013300] hover:border-2 hover:scale-[1.08] hover:shadow transition"
              >
                <svg width="32" height="32" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20v-2c0-2.5 3.5-4 8-4s8 1.5 8 4v2" />
                </svg>
              </button>
              {showProfileDropdown && (
                <div ref={dropdownRef}>
                  <ProfileDropdown
                    onProfile={() => {
                      setShowProfileDropdown(false);
                      router.push("/Parent/profile");
                    }}
                    onLogout={() => {
                      setShowProfileDropdown(false);
                      performClientLogout(router);
                    }}
                    childOptions={childOptions}
                    selectedChildId={selectedChildId}
                    onChildSelect={(childId) => {
                      setSelectedChildId(childId);
                      setShowProfileDropdown(false);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-[#E2E8DD] bg-white p-6 shadow-[0_30px_80px_rgba(12,59,31,0.08)] sm:p-8">
          {isLoading ? (
            <div className="py-14 text-center text-gray-600">Loading profile...</div>
          ) : error ? (
            <div className="py-14 text-center">
              <p className="mb-4 text-base font-medium text-red-600">{error}</p>
              <PrimaryButton onClick={() => window.location.reload()}>Try Again</PrimaryButton>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#E4F7E4] shadow-lg">
                    <svg width="64" height="64" fill="none" stroke="#013300" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="5" />
                      <path d="M4 20v-2c0-3 4-5 8-5s8 2 8 5v2" />
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenProfileModal}
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-white bg-[#0C3B1F] text-white shadow-lg transition hover:bg-[#125428]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
                <div className="rounded-full border border-[#E5EAE0] bg-white/80 px-5 py-1 shadow-sm">
                  <span className="text-sm font-medium text-gray-700">Parent</span>
                </div>
                <div className="text-2xl font-semibold text-gray-900">{fullName}</div>
              </div>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="inline-flex items-center gap-2 self-center rounded-full border border-[#0C3B1F] px-6 py-2 text-sm font-semibold text-[#0C3B1F] transition hover:bg-[#0C3B1F] hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back to Dashboard
                </button>
              </div>

              <div className="mt-8 space-y-8">
                <section className="rounded-2xl border border-[#ECF1E8] bg-[#F9FBF8] p-5 shadow-[inset_0_1px_0_rgba(12,59,31,0.05)]">
                  <h2 className="text-lg font-semibold text-gray-900">Personal Details</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">First Name</p>
                      <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-gray-900 shadow-[0_6px_16px_rgba(12,59,31,0.05)]">
                        {parent?.firstName || "—"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Middle Name</p>
                      <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-gray-900 shadow-[0_6px_16px_rgba(12,59,31,0.05)]">
                        {parent?.middleName || "—"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Last Name</p>
                      <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-gray-900 shadow-[0_6px_16px_rgba(12,59,31,0.05)]">
                        {parent?.lastName || "—"}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#ECF1E8] bg-[#F9FBF8] p-5 shadow-[inset_0_1px_0_rgba(12,59,31,0.05)]">
                  <h2 className="text-lg font-semibold text-gray-900">Contact Details</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Email</p>
                      <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-gray-900 shadow-[0_6px_16px_rgba(12,59,31,0.05)]">
                        {parent?.email || "—"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Contact Number</p>
                      <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-gray-900 shadow-[0_6px_16px_rgba(12,59,31,0.05)]">
                        {parent?.contactNumber || "—"}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#ECF1E8] bg-[#F9FBF8] p-5 shadow-[inset_0_1px_0_rgba(12,59,31,0.05)]">
                  <h2 className="text-lg font-semibold text-gray-900">Address</h2>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Home Address</p>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-gray-900 shadow-[0_6px_16px_rgba(12,59,31,0.05)]">
                      {parent?.address || "—"}
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex justify-end pt-4">
                <PrimaryButton onClick={handleOpenProfileModal}>Edit Profile</PrimaryButton>
              </div>
            </>
          )}
        </div>
      </div>
      <ParentProfileModal show={showProfileModal} onClose={() => setShowProfileModal(false)} parent={parent} />
    </div>
  );
}

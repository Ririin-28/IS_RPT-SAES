"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiLogOut } from "react-icons/fi";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import LogoutConfirmationModal from "@/components/Common/Modals/LogoutConfirmationModal";
import UserAvatar from "@/components/Common/UserAvatar";
import { resolveParentUserId } from "@/lib/utils/parent-session-client";
import { performClientLogout } from "@/lib/utils/logout";

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
  lrn?: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  grade?: string | null;
  section?: string | null;
  teacherName?: string | null;
};

type ParentDashboardResponse = {
  children?: ParentDashboardChild[];
  child?: ParentDashboardChild | null;
};

function formatChildLabel(first?: string | null, middle?: string | null, last?: string | null) {
  const safeFirst = typeof first === "string" ? first.trim() : "";
  const safeLast = typeof last === "string" ? last.trim() : "";
  const middleInitial = typeof middle === "string" && middle.trim().length > 0 ? `${middle.trim()[0].toUpperCase()}.` : "";
  const combined = [safeFirst, middleInitial, safeLast].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return combined.length > 0 ? combined : "Student";
}

function FieldCard({ label, value, spanFull = false }: { label: string; value: string; spanFull?: boolean }) {
  return (
    <div className={`space-y-2 ${spanFull ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <div className="border-b border-[#E3EBE4] px-0 py-3 text-sm text-gray-900 lg:rounded-[18px] lg:border lg:border-white lg:bg-white lg:px-4 lg:shadow-sm">
        {value || "--"}
      </div>
    </div>
  );
}

export default function ParentProfile() {
  const router = useRouter();
  const [parent, setParent] = useState<ParentProfileData | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isChildrenLoading, setIsChildrenLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkedChildren, setLinkedChildren] = useState<ParentDashboardChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadProfile = async () => {
      setIsProfileLoading(true);
      setError(null);
      try {
        const userId = await resolveParentUserId();
        if (controller.signal.aborted) {
          return;
        }

        if (userId === null) {
          throw new Error("Unable to determine the signed-in parent. Please sign in again.");
        }

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
          setIsProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadChildren = async () => {
      setIsChildrenLoading(true);
      try {
        const userId = await resolveParentUserId();
        if (controller.signal.aborted || userId === null) {
          return;
        }

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
        const availableChildren: ParentDashboardChild[] = data.children && data.children.length > 0
          ? data.children
          : data.child
            ? [data.child]
            : [];

        const activeChildId = data.child ? String(data.child.studentId) : null;

        setLinkedChildren(availableChildren);
        setSelectedChildId((previous) => previous ?? activeChildId ?? availableChildren[0]?.studentId ?? null);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.warn("Unable to load child list for profile page", err);
      } finally {
        if (!controller.signal.aborted) {
          setIsChildrenLoading(false);
        }
      }
    };

    loadChildren();

    return () => {
      controller.abort();
    };
  }, []);

  const fullName =
    [parent?.firstName, parent?.middleName, parent?.lastName]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join(" ") || "Parent";
  const activeChild =
    linkedChildren.find((child) => child.studentId === selectedChildId) ??
    linkedChildren[0] ??
    null;
  const isPageLoading = isProfileLoading || isChildrenLoading;
  const activeChildName =
    activeChild
      ? [activeChild.firstName, activeChild.middleName, activeChild.lastName]
          .filter((part) => typeof part === "string" && part.trim().length > 0)
          .join(" ")
      : "--";

  return (
    <div className="relative h-dvh overflow-hidden bg-white lg:h-auto lg:min-h-screen lg:overflow-visible">
      <div className="relative z-10 mx-auto h-[calc(100dvh-4.75rem)] max-w-5xl px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4 lg:h-auto lg:max-w-6xl lg:px-6 lg:pb-6">
        <div className="h-full overflow-y-auto rounded-[24px] border border-[#DCE6DD] bg-white p-4 shadow-sm lg:h-auto lg:border-0 lg:p-0 lg:shadow-none">
          {isPageLoading ? (
            <div className="flex h-full min-h-full items-center justify-center px-6 py-10 text-center">
              <div className="max-w-sm">
                <div className="mx-auto h-10 w-10 rounded-full border-4 border-[#D7E9DB] border-t-[#0C6932] animate-spin" />
                <p className="mt-4 text-base font-semibold leading-8 text-[#0C3B1F]">Loading profile</p>
                <p className="mt-1 text-sm leading-6 text-[#58705D]">
                  Please wait while the profile details are being loaded.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="py-14 text-center">
              <p className="mb-4 text-base font-medium text-red-600">{error}</p>
              <PrimaryButton onClick={() => window.location.reload()}>Try Again</PrimaryButton>
            </div>
          ) : (
            <>
              <div className="border-b border-[#E3EBE4] pb-5 lg:rounded-[24px] lg:border lg:border-[#DDE7DE] lg:bg-[#F9FCF9] lg:p-8 lg:shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative mx-auto sm:mx-0">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#E4F7E4] shadow-sm lg:h-24 lg:w-24">
                        <UserAvatar
                          firstName={parent?.firstName}
                          lastName={parent?.lastName}
                          alt="Parent profile"
                          imageClassName="h-full w-full object-cover"
                          fallbackClassName="h-full w-full"
                          size={96}
                        />
                      </div>
                    </div>

                    <div className="text-center sm:text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F] lg:text-[11px] lg:tracking-[0.28em]">Account Overview</p>
                      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0C3B1F] lg:mt-2 lg:text-3xl">{fullName}</h1>
                    </div>
                  </div>

                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:mt-6 lg:gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-6">
                  <section className="border-b border-[#E3EBE4] pb-5 lg:rounded-[24px] lg:border lg:border-[#E2E8DD] lg:bg-[#F9FBF8] lg:p-5 lg:shadow-sm">
                    <h2 className="text-lg font-semibold tracking-tight text-gray-900">Parents&apos; Information</h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FieldCard label="Full Name" value={fullName} spanFull />
                      <FieldCard label="Phone Number" value={parent?.contactNumber || "--"} />
                      <FieldCard label="Email" value={parent?.email || "--"} />
                      <FieldCard label="Home Address" value={parent?.address || "--"} spanFull />
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="border-b border-[#E3EBE4] pb-5 lg:rounded-[24px] lg:border lg:border-[#E2E8DD] lg:bg-[#F9FBF8] lg:p-5 lg:shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight text-gray-900">Child&apos;s Information</h2>
                      </div>
                      {linkedChildren.length > 1 ? (
                        <div className="sm:max-w-[240px]">
                          <label
                            htmlFor="profile-student-switcher"
                            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500"
                          >
                            Viewing Student
                          </label>
                          <select
                            id="profile-student-switcher"
                            value={selectedChildId ?? activeChild?.studentId ?? ""}
                            onChange={(event) => setSelectedChildId(event.target.value)}
                            className="mt-2 w-full rounded-[18px] border border-[#DCE6DD] bg-white px-4 py-3 text-sm font-medium text-[#102A18] outline-none transition focus:border-[#BCD2C1]"
                          >
                            {linkedChildren.map((child) => (
                              <option key={child.studentId} value={child.studentId}>
                                {formatChildLabel(child.firstName, child.middleName, child.lastName)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FieldCard label="Full Name" value={activeChildName || "--"} spanFull />
                      <FieldCard label="LRN" value={activeChild?.lrn || "--"} />
                      <FieldCard label="Teacher's Name" value={activeChild?.teacherName || "--"} />
                      <FieldCard label="Grade" value={activeChild?.grade || "--"} />
                      <FieldCard label="Section" value={activeChild?.section || "--"} />
                    </div>
                  </section>
                </div>
              </div>

              <div className="mt-6 border-b border-[#E3EBE4] pb-5 lg:rounded-[24px] lg:border lg:border-[#E2E8DD] lg:bg-[#F9FBF8] lg:p-5 lg:shadow-sm">
                <DangerButton type="button" className="flex w-full items-center justify-center gap-2" onClick={() => setShowLogoutConfirm(true)}>
                  <FiLogOut className="text-base" />
                  <span>Logout</span>
                </DangerButton>
              </div>

              <LogoutConfirmationModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={() => performClientLogout(router)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import ParentSidebar from "@/components/Parent/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import { resolveParentUserId } from "@/lib/utils/parent-session-client";

type ParentNotification = {
  id: number;
  studentId: string;
  subject: string;
  date: string;
  message: string;
  status: "unread" | "read";
  createdAt: string;
};

const formatChildName = (firstName?: string | null, middleName?: string | null, lastName?: string | null) => {
  const safeFirst = typeof firstName === "string" ? firstName.trim() : "";
  const safeLast = typeof lastName === "string" ? lastName.trim() : "";
  const middleInitial = typeof middleName === "string" && middleName.trim().length > 0
    ? `${middleName.trim()[0].toUpperCase()}.`
    : "";

  return [safeFirst, middleInitial, safeLast].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
};

const formatDisplayDate = (input: string) => {
  const date = input.includes("T") ? new Date(input) : new Date(`${input}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const isAbsentNotification = (message: string) =>
  message.toLowerCase().startsWith("dear parent, your child was marked absent on");

const getNotificationDateValue = (note: ParentNotification) => {
  const source = note.createdAt || note.date;
  const parsed = source.includes("T") ? new Date(source) : new Date(`${source}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getNotificationSectionLabel = (note: ParentNotification) => {
  const date = getNotificationDateValue(note);
  if (!date) {
    return "Earlier";
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const noteStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((todayStart.getTime() - noteStart.getTime()) / 86400000);

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays <= 7) {
    return "This Week";
  }

  return "Earlier";
};

const getNotificationPresentation = (note: ParentNotification) => {
  if (isAbsentNotification(note.message)) {
    return {
      title: `Absent in ${note.subject || "Remedial"}`,
      message: `Marked absent on ${formatDisplayDate(note.date)}.`,
      toneClasses: "bg-[#C94B4B]",
      subjectLabel: note.subject || "Absent",
    };
  }

  if (note.message.toLowerCase().includes("has been approved")) {
    return {
      title: note.subject ? `${note.subject} Schedule Approved` : "Schedule Approved",
      message: note.message,
      toneClasses: "bg-[#2C6EA1]",
      subjectLabel: note.subject || "Schedule",
    };
  }

  return {
    title: note.subject ? `${note.subject} Update` : "School Update",
    message: note.message,
    toneClasses: "bg-[#0C6932]",
    subjectLabel: note.subject || "Update",
  };
};

export default function ParentNotifications() {
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentLabels, setStudentLabels] = useState<Record<string, string>>({});
  const groupedNotifications = useMemo(() => {
    const sections: Array<{ label: string; items: ParentNotification[] }> = [];

    for (const notification of notifications) {
      const label = getNotificationSectionLabel(notification);
      const previous = sections[sections.length - 1];

      if (!previous || previous.label !== label) {
        sections.push({ label, items: [notification] });
        continue;
      }

      previous.items.push(notification);
    }

    return sections;
  }, [notifications]);

  const resolveParentStudentIds = useMemo(() => {
    return async (userId: number, signal: AbortSignal) => {
      const response = await fetch(`/api/parent/dashboard?userId=${encodeURIComponent(String(userId))}`, {
        method: "GET",
        cache: "no-store",
        signal,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Failed to resolve parent students.");
      }

      const ids = new Set<string>();
      const labels: Record<string, string> = {};
      const addId = (value: unknown) => {
        if (value === null || value === undefined) return;
        const text = String(value).trim();
        if (text) ids.add(text);
      };
      const addLabel = (child: any) => {
        const id = String(child?.studentId ?? child?.student_id ?? child?.id ?? "").trim();
        if (!id) {
          return;
        }

        const label = formatChildName(child?.firstName ?? child?.first_name, child?.middleName ?? child?.middle_name, child?.lastName ?? child?.last_name);
        if (label) {
          labels[id] = label;
        }
      };

      if (Array.isArray(payload.children)) {
        payload.children.forEach((child: any) => {
          addId(child.studentId ?? child.student_id ?? child.id);
          addLabel(child);
        });
      }
      if (payload.child) {
        addId(payload.child.studentId ?? payload.child.student_id ?? payload.child.id);
        addLabel(payload.child);
      }

      if (Object.keys(labels).length > 0) {
        setStudentLabels(labels);
      }

      return Array.from(ids);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    const loadNotifications = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const userId = await resolveParentUserId();
        if (!userId) {
          throw new Error("Unable to determine the signed-in parent. Please sign in again.");
        }

        const studentIds = await resolveParentStudentIds(userId, controller.signal);
        if (studentIds.length === 0) {
          throw new Error("No linked students were found for this parent.");
        }

        params.set("studentIds", studentIds.join(","));

        const query = params.toString();
        const response = await fetch(query ? `/api/parent/notifications?${query}` : "/api/parent/notifications", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.success || !Array.isArray(payload.notifications)) {
          throw new Error(payload?.error ?? "Failed to load notifications.");
        }

        if (isCancelled) {
          return;
        }

        const mappedNotifications = payload.notifications.map((notification: any) => ({
          id: Number(notification.id),
          studentId: String(notification.studentId ?? notification.student_id ?? "").trim(),
          subject: notification.subject ?? "",
          date: notification.date ?? notification.createdAt ?? "",
          message: notification.message ?? "",
          status: notification.status === "read" ? "read" : "unread",
          createdAt: notification.createdAt ?? new Date().toISOString(),
        }));

        const hasUnreadPersistedNotifications = mappedNotifications.some(
          (notification: ParentNotification) => notification.id > 0 && notification.status === "unread",
        );

        setNotifications(
          hasUnreadPersistedNotifications
            ? mappedNotifications.map((notification: ParentNotification) => ({ ...notification, status: "read" as const }))
            : mappedNotifications,
        );

        if (hasUnreadPersistedNotifications) {
          void fetch("/api/parent/notifications", {
            method: "PATCH",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAll: true }),
          });
        }
      } catch (err) {
        if (isCancelled || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        console.error("Failed to load parent notifications", err);
        setError(err instanceof Error ? err.message : "Failed to load notifications.");
        setNotifications([]);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadNotifications();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [resolveParentStudentIds]);

  return (
    <div className="relative h-dvh bg-white lg:flex lg:h-screen lg:overflow-hidden">
      <ParentSidebar />
      <div className="relative z-10 flex-1 overflow-hidden lg:flex lg:flex-col lg:overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <div className="mx-auto h-[calc(100dvh-4.75rem)] w-full max-w-4xl px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4 lg:h-full lg:max-w-7xl lg:p-6">
            <div className="relative h-full overflow-y-auto rounded-[24px] border border-[#DCE6DD] bg-white p-4 shadow-sm lg:p-8">
              <div className="mb-4 flex flex-col gap-2 lg:mb-6 lg:gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6A816F] lg:text-[11px] lg:tracking-[0.28em]">Inbox</p>
                  <SecondaryHeader title="Notifications" />
                </div>
              </div>
              <div className="mt-3 lg:mt-6">
                {loading && (
                  <div className="py-12 text-center text-sm text-[#617561]">Loading notifications...</div>
                )}

                {!loading && error && (
                  <div className="py-12 text-center text-sm text-red-600">{error}</div>
                )}

                {!loading && !error && notifications.length === 0 && (
                  <div className="py-12 text-center text-sm text-[#617561]">
                    You have no notifications at the moment.
                  </div>
                )}

                {!loading && !error && groupedNotifications.map((group) => (
                  <section key={group.label} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A816F] lg:text-[11px] lg:tracking-[0.22em]">
                        {group.label}
                      </p>
                      <div className="h-px flex-1 bg-[#E3EBE4]" />
                    </div>

                    <div className="space-y-2">
                      {group.items.map((note) => {
                        const presentation = getNotificationPresentation(note);
                        const studentLabel = studentLabels[note.studentId] ?? note.studentId;

                        return (
                          <div
                            key={note.id}
                            className={`rounded-[18px] border px-3.5 py-3 shadow-sm transition lg:px-4 ${
                              note.status === "unread"
                                ? "border-[#D0E5D5] bg-[#F4FAF5]"
                                : "border-[#DFE7E0] bg-white"
                            }`}
                          >
                            <div className="flex gap-2.5">
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${presentation.toneClasses}`} aria-hidden="true" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold leading-5 text-[#143120]">
                                      {presentation.title}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-[11px] font-medium text-[#6B806D] lg:text-xs">
                                    {formatDisplayDate(note.date)}
                                  </p>
                                </div>

                                <p className="mt-1 text-sm leading-5 text-[#556A58]">
                                  {presentation.message}
                                </p>

                                <div className="mt-1.5 flex items-center justify-between gap-3 text-[12px] leading-5 text-[#617561]">
                                  <div className="min-w-0 space-y-0.5">
                                    {studentLabel ? (
                                      <p className="truncate">
                                        Student: <span className="font-medium text-[#2E4334]">{studentLabel}</span>
                                      </p>
                                    ) : null}
                                    <p className="truncate">
                                      Subject: <span className="font-medium text-[#2E4334]">{presentation.subjectLabel}</span>
                                    </p>
                                  </div>
                                  {note.status === "unread" ? (
                                    <span className="shrink-0 font-semibold uppercase tracking-[0.12em] text-[#C94B4B]">
                                      Unread
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import ParentHeader from "@/components/Parent/Header";
import ParentSidebar from "@/components/Parent/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

type ParentNotification = {
  id: number;
  studentId: number;
  subject: string;
  date: string;
  message: string;
  status: "unread" | "read";
  createdAt: string;
};

const formatDisplayDate = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function ParentNotifications() {
  const profile = useMemo(() => getStoredUserProfile(), []);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isCancelled = false;

    const loadNotifications = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const rawStudentId = profile?.userId;
        if (typeof rawStudentId === "number" && Number.isFinite(rawStudentId) && rawStudentId > 0) {
          params.set("studentIds", String(rawStudentId));
        } else if (typeof rawStudentId === "string" && rawStudentId.trim()) {
          const parsed = Number(rawStudentId.trim());
          if (Number.isFinite(parsed) && parsed > 0) {
            params.set("studentIds", String(parsed));
          }
        }

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

        setNotifications(
          payload.notifications.map((notification: any) => ({
            id: Number(notification.id),
            studentId: Number(notification.studentId ?? notification.student_id ?? 0) || 0,
            subject: notification.subject ?? "",
            date: notification.date ?? notification.createdAt ?? "",
            message: notification.message ?? "",
            status: notification.status === "read" ? "read" : "unread",
            createdAt: notification.createdAt ?? new Date().toISOString(),
          }))
        );
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
  }, [profile?.userId]);

  const handleSubmitReason = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: Wire to backend endpoint for submitting absence reasons once available.
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <ParentSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <ParentHeader title="Notifications" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <SecondaryHeader title="Notifications" />
              <div className="mt-6">
                {loading && (
                  <div className="py-12 text-center text-sm text-gray-500">Loading notifications...</div>
                )}

                {!loading && error && (
                  <div className="py-12 text-center text-sm text-red-600">{error}</div>
                )}

                {!loading && !error && notifications.length === 0 && (
                  <div className="py-12 text-center text-sm text-gray-500">
                    You have no notifications at the moment.
                  </div>
                )}

                {!loading && !error && notifications.map((note) => (
                  <div
                    key={note.id}
                    className={`mb-4 p-4 rounded shadow flex flex-col gap-2 border ${
                      note.status === "unread"
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <TertiaryHeader title={formatDisplayDate(note.date)} />
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${
                          note.status === "unread"
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {note.status}
                      </span>
                    </div>
                    <div className="text-green-900 font-semibold">{note.message}</div>
                    <div className="text-sm text-gray-500">
                      Subject: <span className="font-medium text-gray-700">{note.subject}</span>
                    </div>
                    <form className="flex flex-col sm:flex-row gap-2 mt-2" onSubmit={handleSubmitReason}>
                      <input
                        type="text"
                        placeholder="Reason for absence..."
                        className="border-2 border-gray-300 rounded-lg px-4 py-3 flex-1 bg-white text-black placeholder-green-700 focus:outline-none focus:border-gray-500 transition"
                        aria-label="Reason for absence"
                      />
                      <PrimaryButton type="submit">Send</PrimaryButton>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

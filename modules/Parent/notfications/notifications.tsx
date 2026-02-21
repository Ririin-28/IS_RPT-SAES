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
  studentId: string;
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

const TAGALOG_WEEKDAYS = [
  "Linggo",
  "Lunes",
  "Martes",
  "Miyerkules",
  "Huwebes",
  "Biyernes",
  "Sabado",
];

const formatAbsentDate = (input: string, locale: "en" | "tl") => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  const weekday = locale === "tl"
    ? TAGALOG_WEEKDAYS[date.getDay()]
    : date.toLocaleDateString("en-US", { weekday: "long" });
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${weekday}, ${month}-${day}-${year}`;
};

const isAbsentNotification = (message: string) =>
  message.toLowerCase().startsWith("dear parent, your child was marked absent on");

const buildAbsentMessage = (date: string, locale: "en" | "tl") => {
  const dateLabel = formatAbsentDate(date, locale);
  if (locale === "tl") {
    return `Mahal na Magulang, ang inyong anak ay minarkahang absent noong ${dateLabel}.`;
  }
  return `Dear Parent, your child was marked absent on ${dateLabel}.`;
};

export default function ParentNotifications() {
  const profile = useMemo(() => getStoredUserProfile(), []);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translated, setTranslated] = useState<Record<number, boolean>>({});

  const resolveUserId = useMemo(() => {
    const rawUserId = profile?.userId;
    if (typeof rawUserId === "number" && Number.isFinite(rawUserId)) {
      return rawUserId;
    }
    if (typeof rawUserId === "string" && rawUserId.trim()) {
      const parsed = Number(rawUserId.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }, [profile?.userId]);

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
      const addId = (value: unknown) => {
        if (value === null || value === undefined) return;
        const text = String(value).trim();
        if (text) ids.add(text);
      };

      if (Array.isArray(payload.children)) {
        payload.children.forEach((child: any) => {
          addId(child.studentId ?? child.student_id ?? child.id);
        });
      }
      if (payload.child) {
        addId(payload.child.studentId ?? payload.child.student_id ?? payload.child.id);
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
        if (!resolveUserId) {
          throw new Error("Unable to determine the signed-in parent. Please sign in again.");
        }

        const studentIds = await resolveParentStudentIds(resolveUserId, controller.signal);
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

        setNotifications(
          payload.notifications.map((notification: any) => ({
            id: Number(notification.id),
            studentId: String(notification.studentId ?? notification.student_id ?? "").trim(),
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
  }, [resolveParentStudentIds, resolveUserId]);

  const handleSubmitReason = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: Wire to backend endpoint for submitting absence reasons once available.
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <ParentSidebar />
      <div className="relative z-10 flex-1 pt-16 flex flex-col overflow-hidden">
        <ParentHeader title="Notifications" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="relative h-full min-h-[400px] overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
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
                    {(() => {
                      const showTranslation = isAbsentNotification(note.message);
                      const isTranslated = translated[note.id] ?? false;
                      const displayMessage = showTranslation
                        ? buildAbsentMessage(note.date, isTranslated ? "tl" : "en")
                        : note.message;
                      return (
                        <>
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
                          <div className="text-green-900 font-semibold">{displayMessage}</div>
                          {showTranslation && (
                            <button
                              type="button"
                              onClick={() =>
                                setTranslated((prev) => ({
                                  ...prev,
                                  [note.id]: !prev[note.id],
                                }))
                              }
                              className="self-start text-xs font-semibold text-green-700 hover:text-green-900 underline"
                            >
                              {isTranslated ? "Show English" : "Translate to Tagalog"}
                            </button>
                          )}
                        </>
                      );
                    })()}
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

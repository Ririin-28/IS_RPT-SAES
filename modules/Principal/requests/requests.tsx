"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Principal/Sidebar";
import PrincipalHeader from "@/components/Principal/Header";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import BaseModal, { ModalLabel } from "@/components/Common/Modals/BaseModal";

interface CalendarRequestRow {
  id: string;
  title: string | null;
  requester: string | null;
  requesterId?: string | null;
  grade: string | null;
  subject: string | null;
  quarter?: string | null;
  status: string | null;
  requestedDate: string | null;
  requestedTimestamp?: number | null;
  type: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  activitiesPlan?: Array<{
    title: string | null;
    description: string | null;
    activityDate: string | null;
    startTime: string | null;
    endTime: string | null;
    day: string | null;
    quarter?: string | null;
    subject?: string | null;
    grade?: string | null;
  }> | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  updatedAt?: string | null;
  displayLabel: string;
  displayStatus: string | null;
  sourceTable: string;
  relatedRowIds?: string[];
  planBatchId?: string | null;
  rejectionReason?: string | null;
}

type ActionType = "approve" | "reject";

type ActivitiesListItem = {
  label: string;
  detail: string;
  dateLabel?: string | null;
};

const DEFAULT_REQUEST_STATUS = "Pending";
const DEFAULT_APPROVER_NAME = "Principal";

const formatDate = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const deriveActivities = (request: CalendarRequestRow): ActivitiesListItem[] => {
  if (Array.isArray(request.activitiesPlan) && request.activitiesPlan.length > 0) {
    const parseActivityDate = (value: string | null): Date | null => {
      if (!value) return null;
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
      const fallback = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(fallback.getTime())) return fallback;
      return null;
    };

    const sortedActivities = [...request.activitiesPlan].sort((a, b) => {
      const aDate = parseActivityDate(a.activityDate);
      const bDate = parseActivityDate(b.activityDate);
      const aTime = aDate ? aDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = bDate ? bDate.getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    return sortedActivities.map((activity, index) => {
      const parsed = parseActivityDate(activity.activityDate);
      const dateLabel = parsed
        ? parsed.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : activity.activityDate;

      const resolvedDate = dateLabel ?? activity.day ?? "";
      const resolvedTitle = activity.title ?? request.title ?? `Activity ${index + 1}`;
      const detailTokens = [`Title: ${resolvedTitle}`];

      return {
        label: resolvedDate ? `Date: ${resolvedDate}` : `Date: Activity ${index + 1}`,
        detail: detailTokens.join(" • "),
        dateLabel: null,
      } satisfies ActivitiesListItem;
    });
  }

  const description = (request.description ?? "").trim();
  if (description.length > 0) {
    const tokens = description
      .split(/\r?\n|;|\|/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length > 0) {
      return tokens.map((token, index) => {
        const splitMatch = token.split(/\s*[-–:\u2014]\s*/);
        if (splitMatch.length >= 2) {
          const [maybeDay, detail] = splitMatch;
          return {
            label: maybeDay,
            detail,
          } satisfies ActivitiesListItem;
        }
        return {
          label: `Activity ${index + 1}`,
          detail: token,
        } satisfies ActivitiesListItem;
      });
    }
  }

  const startDate = request.startDate ? new Date(`${request.startDate}T00:00:00`) : null;
  const endDate = request.endDate ? new Date(`${request.endDate}T00:00:00`) : null;

  if (startDate && !Number.isNaN(startDate.getTime()) && endDate && !Number.isNaN(endDate.getTime())) {
    const items: ActivitiesListItem[] = [];
    const maxDays = 10;
    const current = new Date(startDate);
    let count = 0;
    while (current <= endDate && count < maxDays) {
      const label = current.toLocaleDateString("en-US", { weekday: "long" });
      const detail = request.subject
        ? `Focus on ${request.subject}`
        : request.title ?? "Scheduled activity";
      items.push({
        label,
        detail,
        dateLabel: current.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      });
      current.setDate(current.getDate() + 1);
      count += 1;
    }
    return items;
  }

  return [
    {
      label: "Schedule",
      detail: (
        [request.quarter ?? null, request.subject ?? null, request.grade ?? null]
          .filter(Boolean)
          .join(" • ") || request.title
      ) ?? "Activity details pending",
    },
  ];
};

const statusTone = (statusRaw: string | null) => {
  const normalized = (statusRaw ?? DEFAULT_REQUEST_STATUS).toLowerCase();
  if (normalized.includes("decline") || normalized.includes("reject") || normalized.includes("denied")) {
    return "bg-red-100 text-red-700 border-red-200";
  }
  if (normalized.includes("approve") || normalized.includes("accept") || normalized.includes("granted")) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  return "bg-amber-100 text-amber-800 border-amber-200";
};

const normalizeStatusLabel = (statusRaw: string | null): string => {
  if (!statusRaw) {
    return DEFAULT_REQUEST_STATUS;
  }
  const trimmed = statusRaw.trim();
  if (!trimmed) {
    return DEFAULT_REQUEST_STATUS;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export default function PrincipalRequests() {
  const [requests, setRequests] = useState<CalendarRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"pending" | "history">("pending");
  const [actionState, setActionState] = useState<{ id: string | null; action: ActionType | null }>({
    id: null,
    action: null,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<CalendarRequestRow | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = viewMode === "history"
        ? "/api/principal/calendar-history"
        : "/api/principal/calendar-requests";
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; requests?: CalendarRequestRow[]; error?: string } | null;

      if (!response.ok) {
        const message = payload?.error ?? `Unable to load requests (status ${response.status})`;
        throw new Error(message);
      }

      setRequests(Array.isArray(payload?.requests) ? payload!.requests : []);
      setExpandedCards({});
    } catch (err) {
      console.error("Failed to load principal calendar requests", err);
      setError((err as Error)?.message ?? "Unable to load requests. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const toggleCard = useCallback((id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleAction = useCallback(
    async (requestInfo: CalendarRequestRow, action: ActionType, reason?: string) => {
      if (!requestInfo.sourceTable) {
        setActionError("The selected request cannot be updated.");
        return;
      }

      const requestKey = requestInfo.planBatchId ?? requestInfo.id;

      setActionState({ id: requestKey, action });
      setActionError(null);

      try {
        const response = await fetch("/api/principal/calendar-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: requestInfo.id,
            sourceTable: requestInfo.sourceTable,
            action,
            approverName: DEFAULT_APPROVER_NAME,
            rejectionReason: action === "reject" ? reason ?? null : null,
            relatedRowIds: requestInfo.relatedRowIds,
            planBatchId: requestInfo.planBatchId,
          }),
        });

        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          status?: string;
          error?: string;
        } | null;

        if (!response.ok || !payload?.success) {
          const message = payload?.error ?? `Action failed (status ${response.status})`;
          throw new Error(message);
        }

        const resolvedStatus = normalizeStatusLabel(payload.status ?? action === "approve" ? "Approved" : "Declined");

        setRequests((prev) =>
          prev.map((item) =>
            (item.planBatchId ?? item.id) === requestKey && item.sourceTable === requestInfo.sourceTable
              ? { ...item, status: resolvedStatus, displayStatus: resolvedStatus }
              : item,
          ),
        );
      } catch (err) {
        console.error(`Failed to ${action} request`, err);
        setActionError((err as Error)?.message ?? "Unable to update the request status.");
      } finally {
        setActionState({ id: null, action: null });
      }
    },
    [],
  );

  const openRejectModal = useCallback((requestInfo: CalendarRequestRow) => {
    setRejectTarget(requestInfo);
    setRejectReason("");
    setActionError(null);
    setRejectModalOpen(true);
  }, []);

  const closeRejectModal = useCallback(() => {
    setRejectModalOpen(false);
    setRejectTarget(null);
    setRejectReason("");
  }, []);


  const confirmReject = useCallback(async () => {
    if (!rejectTarget) {
      return;
    }
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setActionError("Rejection reason is required.");
      return;
    }
    await handleAction(rejectTarget, "reject", trimmed);
    closeRejectModal();
  }, [closeRejectModal, handleAction, rejectReason, rejectTarget]);

  const emptyMessage = useMemo(() => {
    if (loading) {
      return viewMode === "history" ? "Loading history..." : "Loading requests...";
    }
    if (error) {
      return error;
    }
    if (requests.length === 0) {
      return viewMode === "history"
        ? "No history available yet."
        : "No pending calendar activity requests.";
    }
    return null;
  }, [error, loading, requests.length, viewMode]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Requests" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Calendar Activity Requests</h2>
                  <p className="text-sm text-gray-600">Review master teacher submissions and manage approvals.</p>
                </div>
                <div className="flex gap-2">
                  <SecondaryButton
                    small
                    onClick={() => setViewMode("pending")}
                    className={viewMode === "pending" ? "bg-gray-200" : ""}
                    disabled={loading}
                  >
                    Pending
                  </SecondaryButton>
                  <SecondaryButton
                    small
                    onClick={() => setViewMode("history")}
                    className={viewMode === "history" ? "bg-gray-200" : ""}
                    disabled={loading}
                  >
                    History
                  </SecondaryButton>
                </div>
              </div>

              {actionError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              {emptyMessage ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  {emptyMessage}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {requests.map((request) => {
                    const requestKey = request.planBatchId ?? request.id;
                    const statusLabel = normalizeStatusLabel(request.displayStatus ?? request.status);
                    const badgeTone = statusTone(statusLabel);
                    const isExpanded = Boolean(expandedCards[requestKey]);
                    const activities = deriveActivities(request);
                    const requestedDateLabel = formatDate(request.requestedDate);
                    const actionDisabled =
                      actionState.id === requestKey || statusLabel.toLowerCase().includes("decline") || statusLabel.toLowerCase().includes("approve");
                    const isHistory = viewMode === "history";

                    return (
                      <div
                        key={`${request.sourceTable}-${requestKey}`}
                        className="rounded-2xl border border-green-200 bg-green-50/40 p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-green-950 uppercase tracking-wide">
                                {request.quarter ?? "Remedial Schedule"}
                              </p>
                              <h3 className="text-xl font-semibold text-green-950">
                                {request.subject ?? "Subject"}{request.grade ? ` • ${request.grade}` : ""}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {request.requester ?? "Master Teacher"}
                              </p>
                            </div>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone}`}>
                              {statusLabel}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1 text-sm text-gray-600">
                            {request.quarter && (
                              <p>
                                Quarter: <span className="font-medium text-gray-800">{request.quarter}</span>
                              </p>
                            )}
                            {(request.subject || request.grade) && (
                              <p>
                                Subject - Grade Level:{" "}
                                <span className="font-medium text-gray-800">
                                  {request.subject ?? "Subject"}{request.grade ? ` • ${request.grade}` : ""}
                                </span>
                              </p>
                            )}
                            {request.requester && (
                              <p>
                                Master Teacher: <span className="font-medium text-gray-800">{request.requester}</span>
                              </p>
                            )}
                            {requestedDateLabel && (
                              <p>
                                Requested on: <span className="font-medium text-gray-800">{requestedDateLabel}</span>
                              </p>
                            )}
                            {isHistory && (request.approvedBy || request.approvedAt || request.updatedAt) && (
                              <p>
                                Actioned by:{" "}
                                <span className="font-medium text-gray-800">
                                  {request.approvedBy ?? "Principal"}
                                </span>
                                {request.updatedAt && (
                                  <span className="text-gray-500"> · {formatDate(request.updatedAt.slice(0, 10))}</span>
                                )}
                              </p>
                            )}
                            {isHistory && request.description && statusLabel.toLowerCase().includes("reject") && (
                              <p>
                                Rejection reason: <span className="font-medium text-gray-800">{request.description}</span>
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleCard(requestKey)}
                            className="mt-2 flex items-center justify-between rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-900 transition-colors hover:bg-green-100"
                          >
                            <span>{isExpanded ? "Hide activity breakdown" : "View activity breakdown"}</span>
                            <svg
                              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>

                          {isExpanded && (
                            <div className="mt-3 rounded-xl border border-green-200 bg-white p-4">
                              <p className="text-sm font-semibold text-green-900 mb-3">Daily Activities</p>
                              <ul className="space-y-2 text-sm text-gray-700">
                                {activities.map((activity, index) => (
                                  <li key={`${request.id}-activity-${index}`} className="flex flex-col rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                    <span className="font-semibold text-green-900">{activity.label}</span>
                                    <span className="text-gray-700">{activity.detail}</span>
                                    {activity.dateLabel && <span className="text-xs text-gray-500">{activity.dateLabel}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {!isHistory && (
                            <div className="mt-4 flex flex-wrap gap-3">
                              <PrimaryButton
                                type="button"
                                small
                                disabled={actionDisabled || (actionState.id === requestKey && actionState.action === "approve")}
                                onClick={() => handleAction(request, "approve")}
                              >
                                {actionState.id === requestKey && actionState.action === "approve" ? "Approving..." : "Approve"}
                              </PrimaryButton>
                              <DangerButton
                                type="button"
                                small
                                disabled={actionDisabled || (actionState.id === requestKey && actionState.action === "reject")}
                                onClick={() => openRejectModal(request)}
                              >
                                {actionState.id === requestKey && actionState.action === "reject" ? "Rejecting..." : "Reject"}
                              </DangerButton>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <BaseModal
        show={rejectModalOpen}
        onClose={closeRejectModal}
        title="Reject Request"
        maxWidth="md"
        footer={(
          <>
            <SecondaryButton type="button" onClick={closeRejectModal}>
              Cancel
            </SecondaryButton>
            <DangerButton type="button" onClick={confirmReject}>
              Confirm Reject
            </DangerButton>
          </>
        )}
      >
        <div className="space-y-3">
          <ModalLabel required>Reason for rejection</ModalLabel>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-600 focus:outline-none"
            rows={4}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Enter the reason for rejecting this request"
          />
        </div>
      </BaseModal>

    </div>
  );
}

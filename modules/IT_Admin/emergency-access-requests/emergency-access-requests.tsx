"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/IT_Admin/Sidebar";
import ITAdminHeader from "@/components/IT_Admin/Header";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import BaseModal, { ModalLabel } from "@/components/Common/Modals/BaseModal";
import TableList from "@/components/Common/Tables/TableList";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import ToastActivity from "@/components/ToastActivity";

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
type StatusTab = "Pending" | "Approved" | "Returned";
type RequestScope = "All" | "Pending" | "Approved";

type ActivityRow = {
  date: Date | null;
  dateText: string;
  dayText: string;
  title: string;
};

type RequestSummary = {
  activityCount: number;
  rangeLabel: string;
  nextActivityLabel: string;
};

const DEFAULT_REQUEST_STATUS = "Pending";
const DEFAULT_APPROVER_NAME = "Principal";

const parseDateValue = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const fallback = new Date(`${value}T00:00:00`);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
};

const extractGradeNumber = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  return Number(match[1]);
};

const formatDate = (value: string | null): string | null => {
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateFromDate = (value: Date | null): string | null => {
  if (!value) return null;
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const normalizeStatusLabel = (statusRaw: string | null): string => {
  if (!statusRaw) return DEFAULT_REQUEST_STATUS;
  const trimmed = statusRaw.trim();
  if (!trimmed) return DEFAULT_REQUEST_STATUS;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const getStatusGroup = (statusRaw: string | null): StatusTab => {
  const normalized = (statusRaw ?? DEFAULT_REQUEST_STATUS).toLowerCase();
  if (normalized.includes("approve") || normalized.includes("accept") || normalized.includes("granted")) {
    return "Approved";
  }
  if (
    normalized.includes("decline") ||
    normalized.includes("reject") ||
    normalized.includes("denied") ||
    normalized.includes("return")
  ) {
    return "Returned";
  }
  return "Pending";
};

const statusTone = (statusRaw: string | null) => {
  const group = getStatusGroup(statusRaw);
  if (group === "Returned") return "bg-red-100 text-red-700 border-red-200";
  if (group === "Approved") return "bg-green-100 text-green-800 border-green-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
};

const requestKey = (request: CalendarRequestRow): string =>
  `${request.sourceTable}:${request.planBatchId ?? request.id}`;

const deriveActivityRows = (request: CalendarRequestRow): ActivityRow[] => {
  if (Array.isArray(request.activitiesPlan) && request.activitiesPlan.length > 0) {
    const rows = request.activitiesPlan.map((activity, index) => {
      const date = parseDateValue(activity.activityDate);
      const dateText = date
        ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : String(activity.activityDate ?? "-");
      const dayText = activity.day ?? (date ? date.toLocaleDateString("en-US", { weekday: "short" }) : "-");
      const title = activity.title?.trim() || request.title?.trim() || `Activity ${index + 1}`;
      return { date, dateText, dayText, title };
    });

    return rows.sort((a, b) => {
      const aTime = a.date ? a.date.getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.date ? b.date.getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }

  const start = parseDateValue(request.startDate);
  const end = parseDateValue(request.endDate);
  if (start && end) {
    const rows: ActivityRow[] = [];
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard < 180) {
      rows.push({
        date: new Date(cursor),
        dateText: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        dayText: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        title: request.title?.trim() || "Scheduled Activity",
      });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return rows;
  }

  const description = (request.description ?? "").trim();
  if (!description) return [];
  const tokens = description
    .split(/\r?\n|;|\|/)
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.map((token, index) => ({
    date: null,
    dateText: "-",
    dayText: "-",
    title: token || `Activity ${index + 1}`,
  }));
};

const summarizeRequest = (request: CalendarRequestRow): RequestSummary => {
  const rows = deriveActivityRows(request);
  const datedRows = rows.filter((row) => row.date !== null) as Array<ActivityRow & { date: Date }>;

  const activityCount = rows.length;
  const start = datedRows[0]?.date ?? parseDateValue(request.startDate);
  const end = datedRows[datedRows.length - 1]?.date ?? parseDateValue(request.endDate);
  const rangeLabel = start && end
    ? `${formatDateFromDate(start)} - ${formatDateFromDate(end)}`
    : start
      ? formatDateFromDate(start) ?? "-"
      : "-";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = datedRows.find((row) => row.date.getTime() >= today.getTime()) ?? datedRows[0];
  const nextActivityLabel = next ? formatDateFromDate(next.date) ?? "-" : "-";

  return { activityCount, rangeLabel, nextActivityLabel };
};

export default function PrincipalRequests() {
  const [allRequests, setAllRequests] = useState<CalendarRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emergencyLocked, setEmergencyLocked] = useState(true);
  const [emergencyReason, setEmergencyReason] = useState<string | null>(null);
  const [emergencyActivatedAt, setEmergencyActivatedAt] = useState<string | null>(null);
  const [emergencyExpiresAt, setEmergencyExpiresAt] = useState<string | null>(null);

  const [requestScope, setRequestScope] = useState<RequestScope>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [quarterFilter, setQuarterFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [gradeFilter, setGradeFilter] = useState("All");

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [draftQuarterFilter, setDraftQuarterFilter] = useState("All");
  const [draftSubjectFilter, setDraftSubjectFilter] = useState("All");
  const [draftGradeFilter, setDraftGradeFilter] = useState("All");

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  const [actionState, setActionState] = useState<{ id: string | null; action: ActionType | null }>({
    id: null,
    action: null,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{
    title: string;
    message: string;
    tone: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (!feedbackToast) return;
    const timerId = window.setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
    return () => window.clearTimeout(timerId);
  }, [feedbackToast]);

  useEffect(() => {
    let active = true;
    const loadEmergencyState = async () => {
      try {
        const response = await fetch("/api/it_admin/emergency-access/current", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean;
          emergency_access?: {
            active?: boolean;
            reason?: string | null;
            activated_at?: string | null;
            expires_at?: string | null;
          };
        } | null;

        if (!active) return;
        const emergency = payload?.emergency_access;
        const isActive = Boolean(emergency?.active);
        setEmergencyLocked(!isActive);
        setEmergencyReason(emergency?.reason ?? null);
        setEmergencyActivatedAt(emergency?.activated_at ?? null);
        setEmergencyExpiresAt(emergency?.expires_at ?? null);
      } catch {
        if (!active) return;
        setEmergencyLocked(true);
      }
    };
    void loadEmergencyState();
    return () => {
      active = false;
    };
  }, []);

  const fetchRequests = useCallback(async () => {
    if (emergencyLocked) {
      setAllRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [pendingResult, historyResult] = await Promise.allSettled([
        fetch("/api/it_admin/emergency-access/requests", { cache: "no-store" }),
        fetch("/api/it_admin/emergency-access/requests/history", { cache: "no-store" }),
      ]);

      const parse = async (result: PromiseSettledResult<Response>) => {
        if (result.status !== "fulfilled") {
          return { requests: [] as CalendarRequestRow[], error: "Unable to reach server." };
        }
        const payload = (await result.value.json().catch(() => null)) as {
          success?: boolean;
          requests?: CalendarRequestRow[];
          error?: string;
        } | null;

        if (!result.value.ok) {
          return {
            requests: [] as CalendarRequestRow[],
            error: payload?.error ?? `Unable to load requests (status ${result.value.status})`,
          };
        }

        return {
          requests: Array.isArray(payload?.requests) ? payload.requests : [],
          error: null as string | null,
        };
      };

      const pending = await parse(pendingResult);
      const history = await parse(historyResult);

      if (pending.error && history.error) {
        throw new Error(pending.error);
      }

      const merged = [...pending.requests, ...history.requests];
      const deduped = new Map<string, CalendarRequestRow>();

      for (const request of merged) {
        const key = requestKey(request);
        const existing = deduped.get(key);
        if (!existing) {
          deduped.set(key, request);
          continue;
        }

        const existingGroup = getStatusGroup(existing.displayStatus ?? existing.status);
        const currentGroup = getStatusGroup(request.displayStatus ?? request.status);
        if (existingGroup === "Pending" && currentGroup !== "Pending") {
          deduped.set(key, request);
          continue;
        }

        const existingTime = parseDateValue(existing.updatedAt ?? existing.requestedDate)?.getTime() ?? 0;
        const currentTime = parseDateValue(request.updatedAt ?? request.requestedDate)?.getTime() ?? 0;
        if (currentTime >= existingTime) {
          deduped.set(key, request);
        }
      }

      setAllRequests(Array.from(deduped.values()));
    } catch (err) {
      console.error("Failed to load emergency calendar requests", err);
      const message = (err as Error)?.message ?? "Unable to load requests. Please try again later.";
      setError(message);
      setFeedbackToast({
        title: "Load Failed",
        message,
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [emergencyLocked]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const selectedRequest = useMemo(
    () => allRequests.find((request) => requestKey(request) === selectedKey) ?? null,
    [allRequests, selectedKey],
  );

  useEffect(() => {
    if (selectedRequest) {
      setRemarks(selectedRequest.rejectionReason ?? "");
    }
  }, [selectedRequest]);

  const quarters = useMemo(() => {
    const base = ["All", "1st Quarter"];
    const dynamic = Array.from(new Set(allRequests.map((req) => req.quarter).filter(Boolean) as string[])).sort();
    return Array.from(new Set([...base, ...dynamic]));
  }, [allRequests]);
  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(allRequests.map((req) => req.subject).filter(Boolean) as string[])).sort()],
    [allRequests],
  );
  const gradeOptions = useMemo(() => ["All", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"], []);

  const closeFilterModal = useCallback(() => {
    setIsFilterModalOpen(false);
  }, []);

  const handleFilterButtonClick = useCallback(() => {
    if (isFilterModalOpen) {
      setIsFilterModalOpen(false);
      return;
    }
    setDraftQuarterFilter(quarterFilter);
    setDraftSubjectFilter(subjectFilter);
    setDraftGradeFilter(gradeFilter);
    setIsFilterModalOpen(true);
  }, [gradeFilter, isFilterModalOpen, quarterFilter, subjectFilter]);

  const handlePrintButtonClick = useCallback(() => {
    if (isFilterModalOpen) {
      setIsFilterModalOpen(false);
      return;
    }
    window.print();
  }, [isFilterModalOpen]);

  const openFilterModal = useCallback(() => {
    setDraftQuarterFilter(quarterFilter);
    setDraftSubjectFilter(subjectFilter);
    setDraftGradeFilter(gradeFilter);
    setIsFilterModalOpen(true);
  }, [gradeFilter, quarterFilter, subjectFilter]);

  const clearFilters = useCallback(() => {
    setDraftQuarterFilter("All");
    setDraftSubjectFilter("All");
    setDraftGradeFilter("All");
  }, []);

  const applyFilters = useCallback(() => {
    setQuarterFilter(draftQuarterFilter);
    setSubjectFilter(draftSubjectFilter);
    setGradeFilter(draftGradeFilter);
    setIsFilterModalOpen(false);
  }, [draftGradeFilter, draftQuarterFilter, draftSubjectFilter]);

  const filteredRequests = useMemo(() => {
    return allRequests.filter((request) => {
      const query = searchTerm.trim().toLowerCase();
      const group = getStatusGroup(request.displayStatus ?? request.status);
      if (requestScope === "Pending" && group !== "Pending") return false;
      if (requestScope === "Approved" && group !== "Approved") return false;
      if (quarterFilter !== "All" && (request.quarter ?? "") !== quarterFilter) return false;
      if (subjectFilter !== "All" && (request.subject ?? "") !== subjectFilter) return false;
      if (gradeFilter !== "All") {
        const selectedGradeNumber = extractGradeNumber(gradeFilter);
        const requestGradeNumber = extractGradeNumber(request.grade);
        if (selectedGradeNumber === null || requestGradeNumber !== selectedGradeNumber) return false;
      }

      if (query) {
        const haystack = [
          request.quarter,
          request.subject,
          request.grade,
          request.requester,
          request.title,
          normalizeStatusLabel(request.displayStatus ?? request.status),
          formatDate(request.requestedDate),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [allRequests, gradeFilter, quarterFilter, requestScope, searchTerm, subjectFilter]);

  const requestRows = useMemo(
    () =>
      filteredRequests.map((request) => {
        const summary = summarizeRequest(request);
        return {
          ...request,
          _requestKey: requestKey(request),
          _statusGroup: getStatusGroup(request.displayStatus ?? request.status),
          _statusLabel: normalizeStatusLabel(request.displayStatus ?? request.status),
          _requestedOn: formatDate(request.requestedDate) ?? "-",
          _activityCount: summary.activityCount,
          _rangeLabel: summary.rangeLabel,
          _nextActivityLabel: summary.nextActivityLabel,
        };
      }),
    [filteredRequests],
  );

  const handleAction = useCallback(
    async (requestInfo: CalendarRequestRow, action: ActionType, reason?: string) => {
      if (emergencyLocked) {
        setActionError("Emergency Access is inactive. Activate it first.");
        return;
      }

      if (!requestInfo.sourceTable) {
        setActionError("The selected request cannot be updated.");
        setFeedbackToast({
          title: "Action Failed",
          message: "The selected request cannot be updated.",
          tone: "error",
        });
        return;
      }

      const key = requestKey(requestInfo);
      setActionState({ id: key, action });
      setActionError(null);

      try {
        const response = await fetch("/api/it_admin/emergency-access/requests", {
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
          throw new Error(payload?.error ?? `Action failed (status ${response.status})`);
        }

        const resolvedStatus = normalizeStatusLabel(payload.status ?? (action === "approve" ? "Approved" : "Returned"));
        setAllRequests((prev) =>
          prev.map((item) =>
            requestKey(item) === key
              ? {
                  ...item,
                  status: resolvedStatus,
                  displayStatus: resolvedStatus,
                  rejectionReason: action === "reject" ? reason ?? item.rejectionReason : item.rejectionReason,
                  approvedBy: DEFAULT_APPROVER_NAME,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        setFeedbackToast({
          title: action === "approve" ? "Request Approved" : "Request Returned",
          message:
            action === "approve"
              ? "The request was approved successfully."
              : "The request was returned with your remarks.",
          tone: "success",
        });
      } catch (err) {
        console.error(`Failed to ${action} request`, err);
        const message = (err as Error)?.message ?? "Unable to update the request status.";
        setActionError(message);
        setFeedbackToast({
          title: "Action Failed",
          message,
          tone: "error",
        });
      } finally {
        setActionState({ id: null, action: null });
      }
    },
    [emergencyLocked],
  );

  const approveFromDetail = useCallback(async () => {
    if (!selectedRequest) return;
    await handleAction(selectedRequest, "approve");
  }, [handleAction, selectedRequest]);

  const returnFromDetail = useCallback(async () => {
    if (!selectedRequest) return;
    const trimmed = remarks.trim();
    if (!trimmed) {
      setActionError("Remarks are required when returning a request.");
      setFeedbackToast({
        title: "Missing Remarks",
        message: "Remarks are required when returning a request.",
        tone: "error",
      });
      return;
    }
    await handleAction(selectedRequest, "reject", trimmed);
  }, [handleAction, remarks, selectedRequest]);

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading requests...";
    if (error) return error;
    if (filteredRequests.length === 0) return "No requests match your current filters.";
    return null;
  }, [error, filteredRequests.length, loading]);

  const activityRows = selectedRequest ? deriveActivityRows(selectedRequest) : [];

  const detailStatusLabel = selectedRequest
    ? normalizeStatusLabel(selectedRequest.displayStatus ?? selectedRequest.status)
    : DEFAULT_REQUEST_STATUS;
  const detailStatusGroup = selectedRequest
    ? getStatusGroup(selectedRequest.displayStatus ?? selectedRequest.status)
    : "Pending";
  const detailSummary = selectedRequest ? summarizeRequest(selectedRequest) : null;
  const detailBusy = Boolean(selectedRequest && actionState.id === requestKey(selectedRequest));
  const detailReadOnly = detailStatusGroup !== "Pending";

  return (
    <div className="relative flex h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <Sidebar />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden pt-16">
        <ITAdminHeader title="Emergency Requests Access" />

        <main className="flex-1 overflow-y-auto">
          <div className="relative h-full p-4 sm:p-5 md:p-6">
            {!emergencyLocked ? (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Emergency Access Active</p>
                <p className="mt-1 text-sm text-amber-900">Reason: {emergencyReason ?? "--"}</p>
                <p className="mt-1 text-sm text-amber-900">Activated: {emergencyActivatedAt ?? "--"}</p>
                <p className="mt-1 text-sm text-amber-900">Expires: {emergencyExpiresAt ?? "--"}</p>
              </div>
            ) : null}
            <div className="relative h-full min-h-100">
              {emergencyLocked && (
                <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/18 p-4 backdrop-blur-[2px]">
                  <div className="w-full max-w-md rounded-[28px] border border-[#013300]/12 bg-white/95 p-6 text-center shadow-[0_28px_60px_-28px_rgba(1,51,0,0.26)]">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#013300]/8 text-[#013300]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2 5 5v6c0 5 3.4 9.4 7 11 3.6-1.6 7-6 7-11V5l-7-3Z" />
                        <path d="M9.5 12.5 11 14l3.5-3.5" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#013300]/70">
                      Access Required
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-[#013300]">Emergency Access is inactive</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Activate Emergency Access first to enable Requests actions.
                    </p>
                    <Link
                      href="/IT_Admin/emergency-access"
                      className="mt-5 inline-flex rounded-xl bg-[#013300] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#024d00]"
                    >
                      Activate Emergency Access
                    </Link>
                  </div>
                </div>
              )}
              <div className="relative h-full overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">

              <div className="mb-5 flex flex-col gap-1">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <HeaderDropdown
                      options={["All", "Pending", "Approved"]}
                      value={requestScope}
                      onChange={(value) => setRequestScope(value as RequestScope)}
                    />
                    <h2 className="mb-2 text-xl font-semibold text-[#013300]">Calendar Activity Requests</h2>
                  </div>

                  <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-2">
                    <div className="relative flex items-center gap-2">
                      <div className="relative">
                    {isFilterModalOpen && (
                      <button
                        type="button"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={closeFilterModal}
                        aria-label="Close filter panel"
                      />
                    )}

                    <button
                      type="button"
                      onClick={handleFilterButtonClick}
                      className="relative z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
                      aria-label="Filter requests"
                      title="Filter"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4" />
                      </svg>
                    </button>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="Search requests..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </div>
                    {isFilterModalOpen ? (
                      <div className="absolute right-0 top-full z-20 mt-2 w-[min(56rem,92vw)] max-w-[92vw] rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_24px_48px_rgba(15,23,42,0.22)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-slate-900">Filter Requests</p>
                          <button
                            type="button"
                            onClick={closeFilterModal}
                            className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900"
                          >
                            Close
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quarter</p>
                            <div className="flex flex-wrap gap-2">
                              {quarters.map((option) => (
                                <button
                                  key={`quarter-${option}`}
                                  type="button"
                                  onClick={() => setDraftQuarterFilter(option)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    draftQuarterFilter === option
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {option === "All" ? "All Quarters" : option}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                            <div className="flex flex-wrap gap-2">
                              {subjects.map((option) => (
                                <button
                                  key={`subject-${option}`}
                                  type="button"
                                  onClick={() => setDraftSubjectFilter(option)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    draftSubjectFilter === option
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {option === "All" ? "All Subjects" : option}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grade Level</p>
                            <div className="flex flex-wrap gap-2">
                              {gradeOptions.map((option) => (
                                <button
                                  key={`grade-${option}`}
                                  type="button"
                                  onClick={() => setDraftGradeFilter(option)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                    draftGradeFilter === option
                                      ? "border-emerald-700 bg-emerald-700 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {option === "All" ? "All Grade Levels" : option}
                                </button>
                              ))}
                            </div>
                          </div>

                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                          <SecondaryButton small className="border border-emerald-100 bg-white/80 px-3" onClick={clearFilters}>
                            Clear All
                          </SecondaryButton>
                          <PrimaryButton small className="px-3" onClick={applyFilters}>
                            Apply Filters
                          </PrimaryButton>
                        </div>
                      </div>
                    ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              {emptyMessage ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">{emptyMessage}</div>
              ) : (
                <div className="mt-4 sm:mt-6">
                  <TableList
                    showFullScreenToggle={false}
                    pageSize={10}
                    actionHeaderLabel="Action"
                    columns={[
                      { key: "quarter", title: "Quarter", render: (row: any) => row.quarter ?? "-" },
                      { key: "subject", title: "Subject", render: (row: any) => row.subject ?? "-" },
                      { key: "grade", title: "Grade Level", render: (row: any) => row.grade ?? "-" },
                      { key: "requester", title: "Master Teacher", render: (row: any) => row.requester ?? "-" },
                      { key: "requestedOn", title: "Requested On", render: (row: any) => row._requestedOn },
                      {
                        key: "status",
                        title: "Status",
                        render: (row: any) => (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(
                              row._statusLabel,
                            )}`}
                          >
                            {row._statusLabel}
                          </span>
                        ),
                      },
                    ]}
                    actions={(row: any) => (
                      <UtilityButton
                        small
                        onClick={() => {
                          setSelectedKey(row._requestKey);
                          setActionError(null);
                        }}
                      >
                        View
                      </UtilityButton>
                    )}
                    data={requestRows}
                  />
                </div>
              )}
            </div>
            </div>
          </div>
        </main>
      </div>

      <BaseModal
        show={Boolean(selectedRequest)}
        onClose={() => setSelectedKey(null)}
        title="Request Review"
        maxWidth="4xl"
        footer={
          selectedRequest ? (
            <>
              <SecondaryButton type="button" onClick={() => setSelectedKey(null)}>
                Close
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => void approveFromDetail()} disabled={detailReadOnly || detailBusy}>
                {detailBusy && actionState.action === "approve" ? "Approving..." : "Approve"}
              </PrimaryButton>
              <DangerButton type="button" onClick={() => void returnFromDetail()} disabled={detailReadOnly || detailBusy}>
                {detailBusy && actionState.action === "reject" ? "Returning..." : "Return / Request Changes"}
              </DangerButton>
            </>
          ) : null
        }
      >
        {selectedRequest && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Quarter</p>
                <p className="text-sm font-semibold text-gray-900">{selectedRequest.quarter ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Subject | Grade</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedRequest.subject ?? "-"}
                  {selectedRequest.grade ? ` | ${selectedRequest.grade}` : ""}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Master Teacher</p>
                <p className="text-sm font-semibold text-gray-900">{selectedRequest.requester ?? "-"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Status</p>
                <span
                  className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(
                    detailStatusLabel,
                  )}`}
                >
                  {detailStatusLabel}
                </span>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Request Summary</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                      <th className="px-3 py-2">Activities</th>
                      <th className="px-3 py-2">Date Range</th>
                      <th className="px-3 py-2">Next Activity</th>
                      <th className="px-3 py-2">Request History Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-900">{detailSummary?.activityCount ?? 0}</td>
                      <td className="px-3 py-2 text-gray-900">{detailSummary?.rangeLabel ?? "-"}</td>
                      <td className="px-3 py-2 text-gray-900">{detailSummary?.nextActivityLabel ?? "-"}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {formatDate(selectedRequest.updatedAt?.slice(0, 10) ?? selectedRequest.requestedDate) ?? "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Activity Breakdown</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                {activityRows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500">No activity breakdown available.</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Day</th>
                        <th className="px-3 py-2">Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityRows.map((row, index) => (
                        <tr key={`${row.title}-${index}`} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-700">{row.dateText}</td>
                          <td className="px-3 py-2 text-gray-600">{row.dayText}</td>
                          <td className="px-3 py-2 text-gray-800">{row.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Request History</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li>
                  Requested on: 
                  <span className="font-medium text-gray-900">{formatDate(selectedRequest.requestedDate) ?? "-"}</span>
                </li>
                <li>
                  Status: <span className="font-medium text-gray-900">{detailStatusLabel}</span>
                </li>
                <li>
                  Last updated: 
                  <span className="font-medium text-gray-900">
                    {formatDate(selectedRequest.updatedAt?.slice(0, 10) ?? null) ?? "-"}
                  </span>
                </li>
                <li>
                  Actioned by: <span className="font-medium text-gray-900">{selectedRequest.approvedBy ?? "-"}</span>
                </li>
                {selectedRequest.rejectionReason && (
                  <li>
                    Return reason: <span className="font-medium text-gray-900">{selectedRequest.rejectionReason}</span>
                  </li>
                )}
              </ul>

              <div className="mt-4 space-y-2">
                <ModalLabel>Remarks / Comments</ModalLabel>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-green-600 focus:outline-none disabled:bg-gray-100"
                  placeholder="Optional for approval, required for return/request changes"
                  disabled={detailReadOnly}
                />
                {detailReadOnly && (
                  <p className="text-xs text-gray-500">This request is already finalized and cannot be modified.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </BaseModal>

      {feedbackToast && (
        <ToastActivity
          title={feedbackToast.title}
          message={feedbackToast.message}
          tone={feedbackToast.tone}
          onClose={() => setFeedbackToast(null)}
          timeoutMs={3500}
        />
      )}
    </div>
  );
}

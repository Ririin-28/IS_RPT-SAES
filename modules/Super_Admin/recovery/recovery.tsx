"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ITAdminSidebar from "@/components/Super_Admin/Sidebar";
import ITAdminHeader from "@/components/Super_Admin/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import BaseModal from "@/components/Common/Modals/BaseModal";
import TableList from "@/components/Common/Tables/TableList";
import Pagination from "@/components/Common/Tables/Pagination";

type RecoveryEntity =
  | "student"
  | "principal"
  | "master_teacher"
  | "teacher"
  | "parent"
  | "activity"
  | "remedial_quarter"
  | "weekly_subject_schedule"
  | "assessment"
  | "attendance_record"
  | "performance_record";

const ENTITY_OPTIONS: Array<{ label: string; value: RecoveryEntity }> = [
  { label: "Students", value: "student" },
  { label: "Principals", value: "principal" },
  { label: "Master Teachers", value: "master_teacher" },
  { label: "Teachers", value: "teacher" },
  { label: "Parents", value: "parent" },
  { label: "Activities", value: "activity" },
  { label: "Remedial Quarters", value: "remedial_quarter" },
  { label: "Weekly Subject Schedules", value: "weekly_subject_schedule" },
  { label: "Assessments/Quizzes", value: "assessment" },
  { label: "Attendance Records", value: "attendance_record" },
  { label: "Performance Records", value: "performance_record" },
];

type RecoveryRecord = {
  id: string | number;
  occurredAt: string | null;
  reason: string | null;
  label: string | null;
  fields: Record<string, unknown>;
};

type PreviewResponse = {
  recoverable: RecoveryRecord[];
  notRecoverable: RecoveryRecord[];
  notFound: Array<string | number>;
};

export default function ITAdminRecoveryCenter() {
  const [entity, setEntity] = useState<RecoveryEntity>("student");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [records, setRecords] = useState<RecoveryRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [summaryCounts, setSummaryCounts] = useState<Array<{ entity: string; totalRecoverable: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const selectedIdValues = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const currentEntityLabel = useMemo(
    () => ENTITY_OPTIONS.find((opt) => opt.value === entity)?.label ?? entity,
    [entity],
  );

  const tableRows = useMemo(
    () =>
      records.map((record) => ({
        id: String(record.id),
        rawId: record.id,
        label: record.label ?? "—",
        reason: record.reason ?? "—",
        occurredAt: record.occurredAt ? new Date(record.occurredAt).toLocaleString() : "—",
      })),
    [records],
  );

  const tableColumns = useMemo(
    () => [
      { key: "rawId", title: "ID", render: (row: any) => <span className="font-semibold text-[#013300]">{String(row.rawId)}</span> },
      { key: "label", title: "Label" },
      { key: "reason", title: "Reason" },
      { key: "occurredAt", title: "Occurred At" },
    ],
    [],
  );

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/super_admin/recovery/summary", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Summary request failed (${response.status})`);
      }
      const payload = await response.json();
      const counts = Array.isArray(payload.counts) ? payload.counts : [];
      setSummaryCounts(
        counts.map((entry: any) => ({
          entity: String(entry.entity ?? ""),
          totalRecoverable: Number(entry.totalRecoverable ?? 0),
        })),
      );
    } catch {
      setSummaryCounts([]);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        entity,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query.trim().length > 0) {
        params.set("query", query.trim());
      }
      const response = await fetch(`/api/super_admin/recovery/list?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? `List request failed (${response.status})`);
      }
      const payload = await response.json();
      const rows = Array.isArray(payload.records) ? payload.records : [];
      setRecords(rows);
      const pagination = payload.pagination ?? {};
      setTotal(Number(pagination.total ?? rows.length));
      setSelectedIds(new Set());
    } catch (err) {
      setRecords([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "Failed to load recovery list.");
    } finally {
      setLoading(false);
    }
  }, [entity, page, pageSize, query]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const selectedCount = selectedIds.size;

  const toggleSelected = (id: string | number, checked: boolean) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(tableRows.map((record) => String(record.id))));
  };

  const handlePreview = useCallback(async () => {
    if (selectedIdValues.length === 0) {
      setError("Select at least one record to preview.");
      return;
    }

    setPreviewLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/super_admin/recovery/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, ids: selectedIdValues }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? `Preview request failed (${response.status})`);
      }

      setPreview({
        recoverable: Array.isArray(payload.recoverable) ? payload.recoverable : [],
        notRecoverable: Array.isArray(payload.notRecoverable) ? payload.notRecoverable : [],
        notFound: Array.isArray(payload.notFound) ? payload.notFound : [],
      });
      setShowPreviewModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview recovery.");
    } finally {
      setPreviewLoading(false);
    }
  }, [entity, selectedIdValues]);

  const openRestoreModal = () => {
    setShowPreviewModal(false);
    setShowRestoreModal(true);
    setReason("");
    setApprovalNote("");
    setConfirmChecked(false);
    setConfirmPhrase("");
  };

  const restoreCandidates = useMemo(() => {
    if (!preview) return [];
    return preview.recoverable.map((row) => row.id);
  }, [preview]);

  const canSubmitRestore =
    restoreCandidates.length > 0 &&
    reason.trim().length > 0 &&
    approvalNote.trim().length > 0 &&
    confirmChecked &&
    confirmPhrase.trim().toUpperCase() === "RESTORE";

  const handleRestore = useCallback(async () => {
    if (!canSubmitRestore) {
      return;
    }
    setRestoreLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/super_admin/recovery/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          ids: restoreCandidates,
          reason: reason.trim(),
          approvalNote: approvalNote.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? `Restore request failed (${response.status})`);
      }

      setMessage(`Emergency restore completed: ${payload.restoredCount ?? 0} record(s) restored.`);
      setShowRestoreModal(false);
      setPreview(null);
      setSelectedIds(new Set());
      await Promise.all([fetchList(), fetchSummary()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to perform emergency restore.");
    } finally {
      setRestoreLoading(false);
    }
  }, [canSubmitRestore, entity, fetchList, fetchSummary, reason, approvalNote, restoreCandidates]);

  const currentCount = summaryCounts.find((entry) => entry.entity === entity)?.totalRecoverable ?? 0;

  return (
    <div className="flex h-screen bg-[#f7faf8] overflow-hidden">
      <ITAdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <ITAdminHeader title="Recovery Center" />
        <main className="flex-1 overflow-y-auto pt-16">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="rounded-2xl border border-gray-200 bg-white/95 shadow-sm h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <p className="font-semibold">Critical Operations Warning</p>
                  <p className="text-sm mt-1">
                    Recovery operations may alter historical academic data. Always run Preview first before restore.
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                  <p className="font-semibold">Dual Confirmation Policy</p>
                  <p className="text-sm mt-1">
                    Reason + approval note + confirmation phrase are required for restore execution.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-0">
                  <HeaderDropdown
                    options={ENTITY_OPTIONS.map((opt) => opt.label)}
                    value={currentEntityLabel}
                    onChange={(label) => {
                      const selected = ENTITY_OPTIONS.find((opt) => opt.label === label);
                      if (selected) {
                        setEntity(selected.value);
                        setPage(1);
                      }
                    }}
                  />
                  <SecondaryHeader title="Recoverable Records" />
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Total recoverable in selection: <span className="font-semibold text-[#013300]">{currentCount}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by ID or label fields..."
                  className="w-full lg:max-w-md border border-gray-300 rounded-lg px-3 py-2 text-black"
                />
                <PrimaryButton small onClick={() => void handlePreview()} disabled={selectedCount === 0 || previewLoading}>
                  {previewLoading ? "Previewing..." : `Preview Selection (${selectedCount})`}
                </PrimaryButton>
              </div>

              {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              {loading ? (
                <div className="mt-5 rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">Loading recovery list...</div>
              ) : (
                <>
                  <div className="mt-5">
                    <TableList
                      columns={tableColumns}
                      data={tableRows}
                      selectable
                      selectedItems={selectedIds}
                      onSelectAll={toggleSelectAll}
                      onSelectItem={toggleSelected}
                      hidePagination
                    />
                  </div>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    totalItems={total}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                  />
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <BaseModal
        show={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Recovery Preview"
        maxWidth="3xl"
        footer={
          <>
            <PrimaryButton small onClick={() => setShowPreviewModal(false)}>
              Close
            </PrimaryButton>
            <DangerButton small onClick={openRestoreModal} disabled={!preview || preview.recoverable.length === 0}>
              Proceed to Emergency Restore
            </DangerButton>
          </>
        }
      >
        {!preview && <p className="text-sm text-gray-500">No preview data.</p>}
        {preview && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Recoverable: <span className="font-semibold">{preview.recoverable.length}</span> | Not Recoverable:{" "}
              <span className="font-semibold">{preview.notRecoverable.length}</span> | Not Found:{" "}
              <span className="font-semibold">{preview.notFound.length}</span>
            </p>
            <div className="max-h-72 overflow-y-auto border border-gray-200 rounded p-3">
              {preview.recoverable.length === 0 ? (
                <p className="text-sm text-gray-500">No recoverable records in selection.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {preview.recoverable.map((row) => (
                    <li key={String(row.id)} className="border-b border-gray-100 pb-2">
                      <span className="font-semibold">{String(row.id)}</span>
                      {row.label ? ` - ${row.label}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </BaseModal>

      <BaseModal
        show={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title="Emergency Restore Confirmation"
        maxWidth="2xl"
        footer={
          <>
            <PrimaryButton small onClick={() => setShowRestoreModal(false)} disabled={restoreLoading}>
              Cancel
            </PrimaryButton>
            <DangerButton small onClick={() => void handleRestore()} disabled={!canSubmitRestore || restoreLoading}>
              {restoreLoading ? "Restoring..." : "Execute Emergency Restore"}
            </DangerButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            You are about to restore <span className="font-semibold">{restoreCandidates.length}</span> record(s) for{" "}
            <span className="font-semibold">{currentEntityLabel}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black"
              placeholder="Explain why this critical recovery is needed..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Approval Note (required)</label>
            <textarea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black"
              placeholder="Reference approval details for audit trail..."
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
            <span>I understand this action affects official records and will be written to critical operations logs.</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type RESTORE to confirm</label>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black"
              placeholder="RESTORE"
            />
          </div>
        </div>
      </BaseModal>
    </div>
  );
}

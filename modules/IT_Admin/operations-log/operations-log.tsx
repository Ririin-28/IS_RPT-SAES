"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ITAdminSidebar from "@/components/Super_Admin/Sidebar";
import ITAdminHeader from "@/components/Super_Admin/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

const ACTION_OPTIONS = ["All", "Restore", "Delete", "Archive"] as const;

const ENTITY_OPTIONS = [
  "All Entities",
  "student",
  "principal",
  "master_teacher",
  "teacher",
  "parent",
  "activity",
  "remedial_quarter",
  "weekly_subject_schedule",
  "assessment",
  "attendance_record",
  "performance_record",
] as const;

type LogRow = {
  logId: number;
  action: string | null;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string | null;
  details: any;
};

export default function ITAdminOperationsLog() {
  const [actionType, setActionType] = useState<(typeof ACTION_OPTIONS)[number]>("All");
  const [entity, setEntity] = useState<(typeof ENTITY_OPTIONS)[number]>("All Entities");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (actionType !== "All") {
        params.set("actionType", actionType.toLowerCase());
      } else {
        params.set("actionType", "all");
      }
      if (entity !== "All Entities") {
        params.set("entity", entity);
      }

      const response = await fetch(`/api/super_admin/recovery/history?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? `History request failed (${response.status})`);
      }

      const pagination = payload.pagination ?? {};
      setTotal(Number(pagination.total ?? 0));
      setRows(Array.isArray(payload.records) ? payload.records : []);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "Failed to load critical operations history.");
    } finally {
      setIsLoading(false);
    }
  }, [actionType, entity, page, pageSize]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <ITAdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <ITAdminHeader title="Critical Operations Log" />
        <main className="flex-1 overflow-y-auto pt-16">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
                <p className="font-semibold">Audit Notice</p>
                <p className="text-sm mt-1">
                  This timeline contains critical recovery and deletion actions. Use it for incident investigation and accountability.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <HeaderDropdown
                    options={[...ACTION_OPTIONS]}
                    value={actionType}
                    onChange={(value) => {
                      const selected = ACTION_OPTIONS.find((opt) => opt === value) ?? "All";
                      setActionType(selected);
                      setPage(1);
                    }}
                  />
                  <SecondaryHeader title="Critical Operations" />
                </div>
                <div className="w-full sm:w-auto sm:min-w-[220px]">
                  <HeaderDropdown
                    options={[...ENTITY_OPTIONS]}
                    value={entity}
                    onChange={(value) => {
                      const selected = ENTITY_OPTIONS.find((opt) => opt === value) ?? "All Entities";
                      setEntity(selected);
                      setPage(1);
                    }}
                  />
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-4 overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">Actor</th>
                      <th className="px-3 py-2 text-left">IP Address</th>
                      <th className="px-3 py-2 text-left">Created At</th>
                      <th className="px-3 py-2 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td colSpan={5} className="px-3 py-5 text-center text-gray-500">
                          Loading critical operations...
                        </td>
                      </tr>
                    )}
                    {!isLoading && rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-5 text-center text-gray-500">
                          No critical operations found.
                        </td>
                      </tr>
                    )}
                    {!isLoading &&
                      rows.map((row) => {
                        const detailsText =
                          row.details && typeof row.details === "object"
                            ? JSON.stringify(row.details)
                            : row.details
                              ? String(row.details)
                              : "—";
                        return (
                          <tr key={row.logId} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium">{row.action ?? "—"}</td>
                            <td className="px-3 py-2">{row.userId ?? "—"}</td>
                            <td className="px-3 py-2">{row.ipAddress ?? "—"}</td>
                            <td className="px-3 py-2">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                            <td className="px-3 py-2 max-w-[520px]">
                              <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">{detailsText}</pre>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Page {page} of {totalPages} | Total {total}
                </p>
                <div className="flex gap-2">
                  <PrimaryButton small onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Previous
                  </PrimaryButton>
                  <PrimaryButton small onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

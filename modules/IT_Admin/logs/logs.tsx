"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import ITAdminHeader from "@/components/IT_Admin/Header";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import { exportLogRows } from "./utils/export-columns";

const ROLE_OPTIONS = [
  "All Users",
  "IT Admin",
  "Principal",
  "Master Teacher/s",
  "Teacher",
  "Parent",
  "Student",
] as const;

const ROLE_LABEL_TO_KEY: Record<(typeof ROLE_OPTIONS)[number], string | null> = {
  "All Users": null,
  "IT Admin": "admin",
  "Principal": "principal",
  "Master Teacher/s": "master_teacher",
  "Teacher": "teacher",
  "Parent": "parent",
  "Student": "student",
};

const ROLE_KEY_TO_LABEL: Record<string, string> = {
  admin: "IT Admin",
  principal: "Principal", 
  master_teacher: "Master Teacher/s",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

function normalizeRoleIdentifier(value: string): string {
  if (!value) return "unknown";
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

interface LogRecord {
  id: number;
  logId: number | null;
  userId: number | null;
  role?: string;
  roleLabel: string;
  lastLogin: string | null;
  createdAt: string | null;
  loginTime: string | null;
  status: string;
  name?: string;
  email?: string;
}

interface ApiResponse {
  role?: string;
  total: number;
  records: any[];
  metadata?: {
    missingTables?: string[];
    missingColumns?: string[];
    availableColumns?: string[];
    error?: string;
    details?: string;
  };
  error?: string;
}

export default function ITAdminLogs() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_OPTIONS)[number]>(ROLE_OPTIONS[0]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const roleKey = ROLE_LABEL_TO_KEY[roleFilter];
        const params = new URLSearchParams();
        
        if (roleKey) {
          params.set("role", roleKey);
        } else {
          params.set("role", "all");
        }

        console.log(`Fetching logs for role: ${roleFilter} (key: ${roleKey || 'all'})`);
        
        const response = await fetch(
          `/api/it_admin/logs?${params.toString()}`,
          { 
            cache: "no-store", 
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error ${response.status}:`, errorText);
          
          let errorMessage = `Request failed with status ${response.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            // If not JSON, use the text as is
            if (errorText) {
              errorMessage = errorText;
            }
          }
          
          throw new Error(errorMessage);
        }

        const payload: ApiResponse = await response.json();
        console.log("API Response:", payload);
        
        if (!isActive) return;

        // Handle API errors in response body
        if (payload.error) {
          throw new Error(payload.error);
        }

        // Handle missing tables gracefully
        if (payload.metadata?.missingTables?.includes("account_logs")) {
          setLogs([]);
          setTotalCount(0);
          setError("Logs table not available in database");
          return;
        }

        // Handle missing columns gracefully
        if (payload.metadata?.missingColumns) {
          console.warn("Missing columns in database:", payload.metadata.missingColumns);
        }

        const records: LogRecord[] = (payload.records ?? []).map((record: any, index: number) => {
          // Safely extract values with fallbacks
          const rawRole = record.role || record.user_role || "unknown";
          const canonicalRole = normalizeRoleIdentifier(String(rawRole));
          const roleLabel = ROLE_KEY_TO_LABEL[canonicalRole] || 
                           record.roleLabel || 
                           canonicalRole.split('_').map(word => 
                             word.charAt(0).toUpperCase() + word.slice(1)
                           ).join(' ');

          const rawStatus = typeof record.status === "string" ? record.status : "Offline";
          const statusLabel = rawStatus
            .toLowerCase()
            .replace(/^[a-z]/, (char: string) => char.toUpperCase());

          // Safe ID generation
          const id = record.id || record.logId || record.userId || index + 1;
          
          return {
            id: Number(id) || index + 1,
            logId: record.logId ? Number(record.logId) : null,
            userId: record.userId ? Number(record.userId) : null,
            role: canonicalRole,
            roleLabel,
            lastLogin: record.lastLogin || record.loginTime || null,
            createdAt: record.createdAt || null,
            loginTime: record.loginTime || record.lastLogin || null,
            status: statusLabel,
            name: record.name || undefined,
            email: record.email || record.user_email || undefined,
          };
        });

        setLogs(records);
        setTotalCount(typeof payload.total === "number" ? payload.total : records.length);
        
      } catch (err) {
        if (!isActive || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        
        const errorMessage = err instanceof Error ? err.message : "Unable to load account logs.";
        console.error("Fetch error:", err);
        setError(errorMessage);
        setLogs([]);
        setTotalCount(0);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [roleFilter]);

  const filteredLogs = useMemo(() => logs, [logs]);

  const handleExport = useCallback(() => {
    void exportLogRows({
      rows: filteredLogs,
      roleLabel: roleFilter,
      emptyMessage: roleFilter === "All Users"
        ? "No login log records available to export."
        : `No ${roleFilter.toLowerCase()} login log records available to export.`,
    });
  }, [filteredLogs, roleFilter]);

  // Helper to format timestamp
  const formatTimestamp = (ts: string | null | undefined) => {
    if (!ts) return "—";
    
    try {
      const parsed = new Date(ts);
      if (Number.isNaN(parsed.getTime())) {
        return "Invalid Date";
      }
      return parsed.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return "Invalid Date";
    }
  };

  const tableColumns = [
    { key: "no", title: "No#" },
    { key: "logId", title: "Log ID", render: (row: LogRecord) => row.logId ?? "—" },
    { key: "roleLabel", title: "Role" },
    { key: "userId", title: "User ID", render: (row: LogRecord) => row.userId ?? "—" },
    { key: "name", title: "Name", render: (row: LogRecord) => row.name ?? "—" },
    { key: "email", title: "Email", render: (row: LogRecord) => row.email ?? "—" },
    { key: "createdAt", title: "Logged At", render: (row: LogRecord) => formatTimestamp(row.createdAt) },
    { key: "lastLogin", title: "Last Login", render: (row: LogRecord) => formatTimestamp(row.lastLogin) },
    {
      key: "status",
      title: "Status",
      render: (row: LogRecord) => {
        const normalized = (row.status || "").toLowerCase();
        const isOnline = normalized === "online";
        const display = isOnline ? "Online" : "Offline";
        const className = isOnline ? "text-green-600" : "text-gray-500";

        return <span className={`${className} font-semibold`}>{display}</span>;
      },
    },
  ];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <ITAdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <ITAdminHeader title="Account Login Logs" />
        <main className="flex-1 overflow-y-auto pt-16">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-0">
                    <HeaderDropdown
                      options={[...ROLE_OPTIONS]}
                      value={roleFilter}
                      onChange={(value) => {
                        const next = ROLE_OPTIONS.find((option) => option === value) ?? ROLE_OPTIONS[0];
                        setRoleFilter(next);
                      }}
                    />
                    <SecondaryHeader title="Login Activity" />
                  </div>
                  <p className="text-gray-600 text-md font-medium">Total: {totalCount}</p>
                </div>
                <UtilityButton small onClick={handleExport} disabled={filteredLogs.length === 0}>
                  Export to Excel
                </UtilityButton>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading logs...</span>
                </div>
              )}

              {/* Error State */}
              {!isLoading && error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                  <p className="text-red-800 font-medium">Error loading logs</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Success State */}
              {!isLoading && !error && (
                <>
                  <TableList
                    columns={tableColumns}
                    data={filteredLogs.map((log, idx) => ({
                      ...log,
                      no: idx + 1,
                    }))}
                    pageSize={10}
                  />
                  
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-lg">No log entries found</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {roleFilter !== "All Users" 
                          ? `No logs found for ${roleFilter}` 
                          : "No log entries in the system"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
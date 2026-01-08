import { exportRowsToExcel, type ExportColumn } from "@/lib/utils/export-to-excel";
import { buildAccountsExportFilename } from "@/modules/IT_Admin/accounts/utils/export-columns";

function getLogsExportColumns(rows: any[]): ExportColumn<any>[] {
  const hasAdmin = rows.some(r => r.role === "admin" && r.itAdminId);
  const hasPrincipal = rows.some(r => r.role === "principal" && r.principalId);
  const hasMasterTeacher = rows.some(r => r.role === "master_teacher" && r.masterTeacherId);
  const hasTeacher = rows.some(r => r.role === "teacher" && r.teacherId);
  const hasOthers = rows.some(r => !r.itAdminId && !r.principalId && !r.masterTeacherId && !r.teacherId);

  const columns: ExportColumn<any>[] = [
    { header: "Log ID", accessor: (row) => row.logId ?? row.log_id ?? "" },
    { header: "Role", accessor: (row) => row.roleLabel ?? row.role ?? "" },
  ];

  if (hasAdmin) {
    columns.push({ header: "IT Admin ID", accessor: (row) => row.role === "admin" ? (row.itAdminId ?? "") : "" });
  }
  if (hasPrincipal) {
    columns.push({ header: "Principal ID", accessor: (row) => row.role === "principal" ? (row.principalId ?? "") : "" });
  }
  if (hasMasterTeacher) {
    columns.push({ header: "Master Teacher ID", accessor: (row) => row.role === "master_teacher" ? (row.masterTeacherId ?? "") : "" });
  }
  if (hasTeacher) {
    columns.push({ header: "Teacher ID", accessor: (row) => row.role === "teacher" ? (row.teacherId ?? "") : "" });
  }
  if (hasOthers) {
    columns.push({ header: "User ID", accessor: (row) => (!row.itAdminId && !row.principalId && !row.masterTeacherId && !row.teacherId) ? (row.userId ?? row.user_id ?? "") : "" });
  }

  columns.push(
    { header: "Name", accessor: (row) => row.name ?? "" },
    { header: "Email", accessor: (row) => row.email ?? row.user_email ?? "" },
    { header: "Status", accessor: (row) => row.status ?? "" },
    { header: "Logged At", accessor: (row) => row.createdAt ?? row.loginTime ?? row.lastLogin ?? "" },
    { header: "Last Login", accessor: (row) => row.lastLogin ?? "" }
  );

  return columns;
}

export const LOGS_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "Log ID", accessor: (row) => row.logId ?? row.log_id ?? "" },
  { header: "Role", accessor: (row) => row.roleLabel ?? row.role ?? "" },
  { header: "User ID", accessor: (row) => row.userId ?? row.user_id ?? "" },
  { header: "Name", accessor: (row) => row.name ?? "" },
  { header: "Email", accessor: (row) => row.email ?? row.user_email ?? "" },
  { header: "Status", accessor: (row) => row.status ?? "" },
  { header: "Logged At", accessor: (row) => row.createdAt ?? row.loginTime ?? row.lastLogin ?? "" },
  { header: "Last Login", accessor: (row) => row.lastLogin ?? "" },
];

interface ExportLogsRowsOptions<T> {
  rows: T[];
  roleLabel: string;
  emptyMessage?: string;
}

export async function exportLogRows<T>({ rows, roleLabel, emptyMessage }: ExportLogsRowsOptions<T>): Promise<void> {
  if (!rows.length) {
    const fallback = emptyMessage ?? `No ${roleLabel.toLowerCase()} log records available to export.`;
    window.alert(fallback);
    return;
  }

  const normalizedRole = roleLabel.trim() === "" ? "All Users" : roleLabel;
  const filename = buildAccountsExportFilename(`account-logs ${normalizedRole}`);
  const sheetName = `${normalizedRole} Logs`;

  const columns = getLogsExportColumns(rows);

  await exportRowsToExcel({
    rows,
    columns,
    filename,
    sheetName,
  });
}

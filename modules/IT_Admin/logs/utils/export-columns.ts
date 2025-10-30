import { exportRowsToExcel, type ExportColumn } from "@/lib/utils/export-to-excel";
import { buildAccountsExportFilename } from "@/modules/IT_Admin/accounts/utils/export-columns";

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

  await exportRowsToExcel({
    rows,
    columns: LOGS_EXPORT_COLUMNS,
    filename,
    sheetName,
  });
}

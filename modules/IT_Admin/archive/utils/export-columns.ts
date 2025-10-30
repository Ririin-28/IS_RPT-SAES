import { exportRowsToExcel, type ExportColumn } from "@/lib/utils/export-to-excel";
import { buildAccountsExportFilename } from "@/modules/IT_Admin/accounts/utils/export-columns";

export const ARCHIVE_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "Archive ID", accessor: (row) => row.archiveId ?? row.archive_id ?? "" },
  { header: "Role", accessor: (row) => row.roleLabel ?? row.role ?? "" },
  { header: "User ID", accessor: (row) => row.userId ?? row.user_id ?? "" },
  { header: "Full Name", accessor: (row) => row.name ?? "" },
  { header: "Email", accessor: (row) => row.email ?? row.user_email ?? "" },
  { header: "Grade", accessor: (row) => row.grade ?? "" },
  { header: "Section", accessor: (row) => row.section ?? "" },
  { header: "Contact Number", accessor: (row) => row.contactNumber ?? row.contact_number ?? "" },
  { header: "Archived Date", accessor: (row) => row.archivedDateDisplay ?? row.archivedDate ?? row.archived_at ?? "" },
  { header: "Reason", accessor: (row) => row.reason ?? "" },
];

interface ExportArchiveRowsOptions<T> {
  rows: T[];
  accountLabel: string;
  gradeLabel?: string;
  emptyMessage?: string;
}

export async function exportArchiveRows<T>({ rows, accountLabel, gradeLabel, emptyMessage }: ExportArchiveRowsOptions<T>): Promise<void> {
  if (!rows.length) {
    const fallback = emptyMessage ?? `No ${gradeLabel ? `${gradeLabel.toLowerCase()} ` : ""}${accountLabel.toLowerCase()} archive records available to export.`;
    window.alert(fallback);
    return;
  }

  const parts = ["archive", accountLabel];
  if (gradeLabel && gradeLabel.trim().length > 0) {
    parts.push(gradeLabel);
  }
  const base = parts.join(" ");
  const filename = buildAccountsExportFilename(base);
  const sheetNameParts = [accountLabel];
  if (gradeLabel && gradeLabel.trim().length > 0) {
    sheetNameParts.push(gradeLabel);
  }
  sheetNameParts.push("Archive");

  await exportRowsToExcel({
    rows,
    columns: ARCHIVE_EXPORT_COLUMNS,
    filename,
    sheetName: sheetNameParts.join(" - "),
  });
}

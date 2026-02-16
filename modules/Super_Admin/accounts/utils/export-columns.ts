import { exportRowsToExcel, type ExportColumn } from "@/lib/utils/export-to-excel";

const pad = (value: number) => value.toString().padStart(2, "0");

export const buildAccountsExportFilename = (base: string): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const slug = base.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "accounts"}-${datePart}-${timePart}.xlsx`;
};

export const IT_ADMIN_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "Admin ID", accessor: (row) => row.adminId ?? row.userId ?? "" },
  { header: "Full Name", accessor: (row) => row.name ?? "" },
  { header: "Email", accessor: (row) => row.email ?? "" },
  { header: "Last Login", accessor: (row) => row.lastLoginDisplay ?? row.lastLogin ?? "" },
];

export const PRINCIPAL_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "Principal ID", accessor: (row) => row.principalId ?? row.userId ?? "" },
  { header: "Full Name", accessor: (row) => row.name ?? "" },
  { header: "Email", accessor: (row) => row.email ?? "" },
  { header: "Contact Number", accessor: (row) => row.contactNumber ?? "" },
];

const sharedTeacherColumns: ExportColumn<any>[] = [
  { header: "Teacher ID", accessor: (row) => row.teacherId ?? row.userId ?? "" },
  { header: "Full Name", accessor: (row) => row.name ?? "" },
  { header: "Email", accessor: (row) => row.email ?? "" },
  { header: "Contact Number", accessor: (row) => row.contactNumber ?? "" },
  { header: "Grade", accessor: (row) => row.grade ?? "" },
  { header: "Section", accessor: (row) => row.section ?? "" },
];

export const MASTER_TEACHER_EXPORT_COLUMNS: ExportColumn<any>[] = [
  ...sharedTeacherColumns,
  { header: "Coordinator Subject", accessor: (row) => row.coordinatorSubject ?? "" },
];
export const TEACHER_EXPORT_COLUMNS = sharedTeacherColumns;

interface ExportAccountRowsOptions<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  baseFilename: string;
  sheetName: string;
  emptyMessage: string;
}

export async function exportAccountRows<T>({ rows, columns, baseFilename, sheetName, emptyMessage }: ExportAccountRowsOptions<T>): Promise<void> {
  if (!rows.length) {
    window.alert(emptyMessage);
    return;
  }

  const filename = buildAccountsExportFilename(baseFilename);
  await exportRowsToExcel({
    rows,
    columns,
    filename,
    sheetName,
  });
}

import { exportRowsToExcel, type ExportColumn } from "@/lib/utils/export-to-excel";

const pad = (value: number) => value.toString().padStart(2, "0");

const buildFilename = (base: string): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const slug = base.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "principal-teachers"}-${datePart}-${timePart}.xlsx`;
};

const toText = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return "-";
};

const teacherIdAccessor = (row: any): string => toText(row?.teacherId, row?.userId);

const contactNumberAccessor = (row: any): string =>
  toText(
    row?.contactNumber,
    row?.contact_number,
    row?.contactNo,
    row?.contact_no,
    row?.phone,
    row?.phoneNumber,
    row?.phone_number,
    row?.mobile,
    row?.user_contact_number,
    row?.user_phone_number,
  );

const gradeLevelAccessor = (row: any): string =>
  toText(row?.grade, row?.gradeLevel, row?.gradeNumber, row?.handledGrade, row?.handled_grade);

const masterHandledSubjectAccessor = (row: any): string =>
  toText(row?.subjects, row?.subject, row?.handledSubject);

const staffHandledSubjectAccessor = (row: any): string => {
  if (row?.__staffType === "Teacher") {
    return "All Subjects";
  }
  return masterHandledSubjectAccessor(row);
};

const detailColumns: ExportColumn<any>[] = [
  { header: "Teacher ID", accessor: teacherIdAccessor },
  { header: "Contact Number", accessor: contactNumberAccessor },
];

const teacherColumns: ExportColumn<any>[] = [
  { header: "No#", accessor: (row) => row.__exportIndex },
  { header: "Full Name", accessor: (row) => toText(row?.name) },
  { header: "Email", accessor: (row) => toText(row?.email) },
  { header: "Grade Level", accessor: gradeLevelAccessor },
  { header: "Handled Subject", accessor: () => "All Subjects" },
  ...detailColumns,
];

const masterTeacherColumns: ExportColumn<any>[] = [
  { header: "No#", accessor: (row) => row.__exportIndex },
  { header: "Full Name", accessor: (row) => toText(row?.name) },
  { header: "Email", accessor: (row) => toText(row?.email) },
  { header: "Grade Level", accessor: gradeLevelAccessor },
  { header: "Handled Subject", accessor: masterHandledSubjectAccessor },
  ...detailColumns,
];

const allStaffColumns: ExportColumn<any>[] = [
  { header: "No#", accessor: (row) => row.__exportIndex },
  { header: "Full Name", accessor: (row) => toText(row?.name) },
  { header: "Role", accessor: (row) => toText(row?.__staffType, row?.role) },
  { header: "Email", accessor: (row) => toText(row?.email) },
  { header: "Grade Level", accessor: gradeLevelAccessor },
  { header: "Handled Subject", accessor: staffHandledSubjectAccessor },
  ...detailColumns,
];

async function exportRows(rows: any[], columns: ExportColumn<any>[], baseFilename: string, sheetName: string): Promise<void> {
  if (!rows.length) {
    console.warn("No teacher records to export.");
    return;
  }

  const exportData = rows.map((row, index) => ({
    ...row,
    __exportIndex: index + 1,
  }));

  await exportRowsToExcel({
    rows: exportData,
    columns,
    filename: buildFilename(baseFilename),
    sheetName,
  });
}

export async function exportPrincipalTeacherRows(rows: any[]): Promise<void> {
  await exportRows(rows, teacherColumns, "principal-teachers", "Teachers");
}

export async function exportPrincipalMasterTeacherRows(rows: any[]): Promise<void> {
  await exportRows(rows, masterTeacherColumns, "principal-master-teachers", "Master Teachers");
}

export async function exportPrincipalAllTeachingStaffRows(rows: any[]): Promise<void> {
  await exportRows(rows, allStaffColumns, "principal-all-teaching-staff", "Teaching Staff");
}

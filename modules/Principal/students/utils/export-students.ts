import { exportRowsToExcel, type ExportColumn } from "@/lib/utils/export-to-excel";

const pad = (value: number) => value.toString().padStart(2, "0");

const buildFilename = (base: string): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const slug = base.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "principal-students"}-${datePart}-${timePart}.xlsx`;
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

const normalizeLrn = (lrn?: string | null): string => {
  if (!lrn) return "-";
  const digits = String(lrn).replace(/\D/g, "").slice(0, 12);
  if (digits.length !== 12) return "-";
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
};

const buildStudentFullName = (row: any): string => {
  const fallback = toText(row?.name, "");
  if (fallback !== "-") {
    return fallback;
  }

  const first = toText(row?.firstName, row?.first_name, "");
  const middle = toText(row?.middleName, row?.middle_name, "");
  const last = toText(row?.lastName, row?.last_name, "");
  const suffix = toText(row?.suffix, row?.suffix_name, row?.suf, "");

  const fullName = [first, middle, last, suffix].filter((part) => part && part !== "-").join(" ").trim();
  return fullName || "-";
};

const buildParentFullName = (row: any): string => {
  const first = toText(row?.parentFirstName, row?.parent_first_name, row?.guardianFirstName, row?.guardian_first_name, "");
  const middle = toText(row?.parentMiddleName, row?.parent_middle_name, row?.guardianMiddleName, row?.guardian_middle_name, "");
  const last = toText(row?.parentLastName, row?.parent_last_name, row?.guardianLastName, row?.guardian_last_name, "");
  const suffix = toText(row?.parentSuffix, row?.parent_suffix, row?.guardianSuffix, row?.guardian_suffix, row?.guardian_suf, "");

  const fullName = [first, middle, last, suffix].filter((part) => part && part !== "-").join(" ").trim();
  return fullName || "-";
};

const STUDENT_EXPORT_COLUMNS: ExportColumn<any>[] = [
  { header: "No#", accessor: (row) => row.__exportIndex },
  { header: "LRN", accessor: (row) => normalizeLrn(row?.lrn) },
  { header: "Full Name", accessor: (row) => buildStudentFullName(row) },
  { header: "Grade", accessor: (row) => toText(row?.grade, row?.grade_level, row?.gradeLevel) },
  { header: "Parent Name", accessor: (row) => buildParentFullName(row) },
  { header: "Student ID", accessor: (row) => toText(row?.studentId) },
  { header: "Section", accessor: (row) => toText(row?.section) },
  { header: "Student First Name", accessor: (row) => toText(row?.firstName, row?.first_name) },
  { header: "Student Middle Name", accessor: (row) => toText(row?.middleName, row?.middle_name) },
  { header: "Student Last Name", accessor: (row) => toText(row?.lastName, row?.last_name) },
  { header: "Student Suffix", accessor: (row) => toText(row?.suffix, row?.suffix_name, row?.suf) },
  {
    header: "Parent First Name",
    accessor: (row) => toText(row?.parentFirstName, row?.parent_first_name, row?.guardianFirstName, row?.guardian_first_name),
  },
  {
    header: "Parent Middle Name",
    accessor: (row) => toText(row?.parentMiddleName, row?.parent_middle_name, row?.guardianMiddleName, row?.guardian_middle_name),
  },
  {
    header: "Parent Last Name",
    accessor: (row) => toText(row?.parentLastName, row?.parent_last_name, row?.guardianLastName, row?.guardian_last_name),
  },
  {
    header: "Parent Suffix",
    accessor: (row) => toText(row?.parentSuffix, row?.parent_suffix, row?.guardianSuffix, row?.guardian_suffix, row?.guardian_suf),
  },
  {
    header: "Parent Relationship",
    accessor: (row) => toText(row?.parentRelationship, row?.parent_relationship, row?.relationship),
  },
  {
    header: "Parent Phone Number",
    accessor: (row) =>
      toText(
        row?.parentContactNumber,
        row?.parent_contact_number,
        row?.parentPhoneNumber,
        row?.parent_phone_number,
        row?.guardianContact,
        row?.guardianContactNumber,
        row?.guardian_contact_number,
      ),
  },
  {
    header: "Parent Email",
    accessor: (row) => toText(row?.parentEmail, row?.parent_email, row?.guardianEmail, row?.guardian_email),
  },
  {
    header: "Parent Address",
    accessor: (row) => toText(row?.parentAddress, row?.parent_address, row?.guardianAddress, row?.guardian_address, row?.address),
  },
  { header: "English Phonemic", accessor: (row) => toText(row?.englishPhonemic, row?.english_phonemic) },
  { header: "Filipino Phonemic", accessor: (row) => toText(row?.filipinoPhonemic, row?.filipino_phonemic) },
  { header: "Math Proficiency", accessor: (row) => toText(row?.mathProficiency, row?.math_proficiency) },
];

export async function exportPrincipalStudents(rows: any[]): Promise<void> {
  if (!rows.length) {
    console.warn("No student records to export.");
    return;
  }

  const exportRows = rows.map((row, index) => ({
    ...row,
    __exportIndex: index + 1,
  }));

  await exportRowsToExcel({
    rows: exportRows,
    columns: STUDENT_EXPORT_COLUMNS,
    filename: buildFilename("principal-students"),
    sheetName: "Students",
  });
}

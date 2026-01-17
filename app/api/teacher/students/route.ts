import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT_LABELS: Record<string, string> = {
  english: "English",
  filipino: "Filipino",
  math: "Math",
  mathematics: "Math",
} as const;

type SupportedSubject = "English" | "Filipino" | "Math";

type RawStudentRow = RowDataPacket & {
  student_id: string | null;
  lrn: string | null;
  student_identifier: string | null;
  student_grade_level: string | null;
  student_section: string | null;
  guardian: string | null;
  guardian_contact: string | null;
  guardian_email: string | null;
  relationship: string | null;
  address: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  subject_phonemic: number | null;
  subject_phonemic_name: string | null;
};

const sanitize = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const normalizeStudentRow = (row: RawStudentRow, subject: SupportedSubject) => {
  const firstName = sanitize(row.first_name);
  const middleName = sanitize(row.middle_name);
  const lastName = sanitize(row.last_name);
  const suffix = sanitize(row.suffix);
  const parts = [firstName, middleName, lastName].filter((part) => typeof part === "string" && part.length > 0);
  const fullName = parts.length ? parts.join(" ") : null;
  const fullNameWithSuffix = suffix ? [fullName ?? "", suffix].filter(Boolean).join(" ") : fullName;

  const phonemic = row.subject_phonemic;
  const phonemicName = sanitize(row.subject_phonemic_name);
  const valueText = phonemicName ?? (Number.isFinite(phonemic) ? String(phonemic) : null);

  return {
    studentId: sanitize(row.student_id),
    lrn: sanitize(row.lrn),
    userId: null,
    remedialId: null,
    studentIdentifier: sanitize(row.student_identifier),
    grade: sanitize(row.student_grade_level),
    section: sanitize(row.student_section),
    english: subject === "English" ? valueText : null,
    filipino: subject === "Filipino" ? valueText : null,
    math: subject === "Math" ? valueText : null,
    englishPhonemic: subject === "English" ? valueText : null,
    filipinoPhonemic: subject === "Filipino" ? valueText : null,
    mathProficiency: subject === "Math" ? valueText : null,
    guardian: sanitize(row.guardian),
    guardianContact: sanitize(row.guardian_contact),
    guardianEmail: sanitize(row.guardian_email),
    relationship: sanitize(row.relationship),
    address: sanitize(row.address),
    firstName,
    middleName,
    lastName,
    suffix,
    fullName: fullNameWithSuffix,
  };
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userIdParam = url.searchParams.get("userId");
  const searchParam = url.searchParams.get("search");
  const subjectParam = (url.searchParams.get("subject") ?? "english").toLowerCase();
  const subjectLabel = SUBJECT_LABELS[subjectParam];

  if (!subjectLabel) {
    return NextResponse.json({ success: false, error: "Unsupported subject." }, { status: 400 });
  }

  if (!userIdParam) {
    return NextResponse.json({ success: false, error: "Missing userId query parameter." }, { status: 400 });
  }

  const userId = Number(userIdParam);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, error: "Invalid userId value." }, { status: 400 });
  }

  try {
    const [[teacherRow]] = await query<RowDataPacket[]>(
      "SELECT teacher_id FROM teacher WHERE user_id = ? LIMIT 1",
      [userId],
    );

    let gradeIds: number[] = [];
    let allowedSubjectIds: Set<number> = new Set();

    if (teacherRow?.teacher_id) {
      const [gradeRows] = await query<RowDataPacket[]>(
        "SELECT grade_id FROM teacher_handled WHERE teacher_id = ?",
        [teacherRow.teacher_id],
      );
      gradeIds = gradeRows.map((row) => Number(row.grade_id)).filter((id) => Number.isFinite(id));
    } else {
      // Fallback: allow master teachers to access if present.
      const [[masterRow]] = await query<RowDataPacket[]>(
        "SELECT master_teacher_id FROM master_teacher WHERE user_id = ? LIMIT 1",
        [userId],
      );

      const masterTeacherId = masterRow?.master_teacher_id as string | undefined;
      if (!masterTeacherId) {
        return NextResponse.json({ success: false, error: "Teacher record not found." }, { status: 404 });
      }

      const [gradeRows] = await query<RowDataPacket[]>(
        "SELECT grade_id, subject_id FROM mt_coordinator_handled WHERE master_teacher_id = ?",
        [masterTeacherId],
      );

      gradeRows.forEach((row) => {
        const gid = Number(row.grade_id);
        const sid = Number(row.subject_id);
        if (Number.isFinite(gid)) {
          gradeIds.push(gid);
        }
        if (Number.isFinite(sid)) {
          allowedSubjectIds.add(sid);
        }
      });

      if (!gradeIds.length) {
        const [remedialRows] = await query<RowDataPacket[]>(
          "SELECT grade_id FROM mt_remedialteacher_handled WHERE master_teacher_id = ?",
          [masterTeacherId],
        );
        gradeIds = remedialRows.map((row) => Number(row.grade_id)).filter((id) => Number.isFinite(id));
      }
    }

    if (!gradeIds.length) {
      return NextResponse.json(
        { success: false, error: "No handled grades found for this teacher." },
        { status: 404 },
      );
    }

    const [[subjectRow]] = await query<RowDataPacket[]>(
      "SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = LOWER(TRIM(?)) LIMIT 1",
      [subjectLabel],
    );

    const subjectId = Number(subjectRow?.subject_id);
    if (!Number.isFinite(subjectId)) {
      return NextResponse.json(
        { success: false, error: `Subject '${subjectLabel}' not found in subject table.` },
        { status: 404 },
      );
    }

    if (allowedSubjectIds.size && !allowedSubjectIds.has(subjectId)) {
      return NextResponse.json(
        { success: false, error: "Subject is not assigned to this master teacher." },
        { status: 403 },
      );
    }

    const gradePlaceholders = gradeIds.map(() => "?").join(",");
    // Parameter order must follow placeholder order in the SQL: ssa.subject_id, subquery subject_id,
    // phonemic_level subject_id, all grade placeholders, then ssa2.subject_id.
    const params: Array<string | number> = [subjectId, subjectId, subjectId, ...gradeIds, subjectId];

    const sql = `
      SELECT
        s.student_id,
        s.lrn AS lrn,
        s.student_id AS student_identifier,
        g.grade_level AS student_grade_level,
        s.section AS student_section,
        gi.guardian AS guardian,
        gi.guardian_contact AS guardian_contact,
        gi.guardian_email AS guardian_email,
        gi.relationship AS relationship,
        gi.address AS address,
        s.first_name,
        s.middle_name,
        s.last_name,
        s.suffix,
        ssa.phonemic_id AS subject_phonemic,
        pl.level_name AS subject_phonemic_name
      FROM student s
      JOIN grade g ON g.grade_id = s.grade_id
      LEFT JOIN (
        SELECT
          ps.student_id,
          MIN(
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name, u.suffix)), '')
          ) AS guardian,
          MIN(u.phone_number) AS guardian_contact,
          MIN(u.email) AS guardian_email,
          MIN(ps.relationship) AS relationship,
          MIN(ps.address) AS address
        FROM parent_student ps
        JOIN parent p ON p.parent_id = ps.parent_id
        JOIN users u ON u.user_id = p.user_id
        GROUP BY ps.student_id
      ) gi ON gi.student_id = s.student_id
      LEFT JOIN student_subject_assessment ssa ON 
        ssa.student_id = s.student_id 
        AND ssa.subject_id = ?
        AND ssa.assessed_at = (
          SELECT MAX(assessed_at) 
          FROM student_subject_assessment 
          WHERE student_id = s.student_id AND subject_id = ?
        )
      LEFT JOIN phonemic_level pl ON pl.phonemic_id = ssa.phonemic_id AND pl.subject_id = ?
      WHERE s.grade_id IN (${gradePlaceholders})
        AND EXISTS (
          SELECT 1 FROM student_subject_assessment ssa2
          WHERE ssa2.student_id = s.student_id AND ssa2.subject_id = ?
        )
      GROUP BY s.student_id, g.grade_level, s.section, gi.guardian, gi.guardian_contact, s.first_name, s.middle_name, s.last_name, s.suffix, ssa.phonemic_id, pl.level_name
      ORDER BY g.grade_level, s.section, s.last_name, s.first_name, s.student_id
    `;

    const [rows] = await query<RawStudentRow[]>(sql, params);
    const students = rows.map((row) => normalizeStudentRow(row, subjectLabel as SupportedSubject));

    const filteredStudents = (() => {
      const term = sanitize(searchParam)?.toLowerCase();
      if (!term) return students;
      return students.filter((student) => {
        const fields = [
          student.fullName,
          student.studentIdentifier,
          student.grade,
          student.section,
          student.guardian,
        ];
        return fields.some((field) => typeof field === "string" && field.toLowerCase().includes(term));
      });
    })();

    return NextResponse.json({ success: true, subject: subjectLabel, students: filteredStudents });
  } catch (error) {
    console.error(`Failed to load teacher students for ${subjectLabel}`, error);
    return NextResponse.json(
      { success: false, error: `Failed to load students for ${subjectLabel}.` },
      { status: 500 },
    );
  }
}

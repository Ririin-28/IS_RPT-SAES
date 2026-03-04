import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const STUDENT_TABLE_CANDIDATES = ["student", "students", "student_info"] as const;
const STUDENT_ID_COLUMNS = ["student_id", "id", "studentid"] as const;
const SECTION_COLUMNS = ["section", "section_name", "class_section", "handled_section"] as const;
const SUBJECT_COLUMNS = ["subjects", "handled_subjects", "subject", "subject_list"] as const;
const CONTACT_COLUMNS = [
  "contact_number",
  "contact_no",
  "contact",
  "phone",
  "mobile",
  "phone_number",
] as const;
const EMAIL_COLUMNS = ["email", "user_email"] as const;
const NAME_COLUMNS = ["first_name", "middle_name", "last_name"] as const;
const LRN_COLUMNS = ["lrn"] as const;
const SUFFIX_COLUMNS = ["suffix"] as const;
const PARENT_STUDENT_TABLE = "parent_student";
const PARENT_TABLE = "parent";
const RELATIONSHIP_COLUMNS = ["relationship"] as const;
const ADDRESS_COLUMNS = ["address"] as const;

function extractGradeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatGradeLabel(value: unknown): string | null {
  const number = extractGradeNumber(value);
  if (number) {
    return `Grade ${number}`;
  }
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function pickFirstColumn(columns: Set<string>, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveName(row: Record<string, any>): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string | null;
} {
  const candidates = [
    ["student_first_name", "student_middle_name", "student_last_name"],
    ["user_first_name", "user_middle_name", "user_last_name"],
    ["first_name", "middle_name", "last_name"],
  ];

  for (const [firstKey, middleKey, lastKey] of candidates) {
    const first = row[firstKey];
    const middle = row[middleKey];
    const last = row[lastKey];

    if (first || middle || last) {
      const firstName = first ? String(first).trim() : null;
      const middleName = middle ? String(middle).trim() : null;
      const lastName = last ? String(last).trim() : null;
      const parts = [firstName, middleName, lastName].filter(Boolean);
      return {
        firstName,
        middleName,
        lastName,
        fullName: parts.length ? parts.join(" ") : null,
      };
    }
  }

  return { firstName: null, middleName: null, lastName: null, fullName: null };
}

function getMiddleInitial(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `${trimmed.charAt(0).toUpperCase()}.`;
}

function formatPrincipalStudentFullName(input: {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  fallback?: string | null;
}): string | null {
  const firstName = input.firstName?.trim() || null;
  const middleInitial = getMiddleInitial(input.middleName);
  const lastName = input.lastName?.trim() || null;
  const suffix = input.suffix?.trim() || null;

  if (lastName || firstName) {
    return [lastName, firstName, middleInitial, suffix].filter(Boolean).join(", ");
  }

  const fallback = input.fallback?.trim();
  return fallback && fallback.length > 0 ? fallback : null;
}

async function resolveStudentTable(): Promise<{ name: string; columns: Set<string> } | null> {
  for (const candidate of STUDENT_TABLE_CANDIDATES) {
    if (!(await tableExists(candidate))) {
      continue;
    }
    const columns = await getTableColumns(candidate);
    const hasIdentifier = STUDENT_ID_COLUMNS.some((column) => columns.has(column));
    if (!hasIdentifier) {
      continue;
    }
    return { name: candidate, columns };
  }
  return null;
}

export async function GET() {
  try {
    const studentTable = await resolveStudentTable();
    if (!studentTable) {
      return NextResponse.json(
        {
          students: [],
          total: 0,
          metadata: {
            studentTable: null,
            notes: "No student table detected. Ensure a student table exists with student_id column.",
          },
        },
        { status: 200 },
      );
    }

    const usersTableExists = await tableExists("users");
    const userColumns = usersTableExists ? await getTableColumns("users") : new Set<string>();
    const canJoinStudentUsers = usersTableExists && studentTable.columns.has("user_id");
    const parentStudentExists = await tableExists(PARENT_STUDENT_TABLE);
    const parentTableExists = await tableExists(PARENT_TABLE);
    const parentStudentColumns = parentStudentExists ? await getTableColumns(PARENT_STUDENT_TABLE) : new Set<string>();
    const parentColumns = parentTableExists ? await getTableColumns(PARENT_TABLE) : new Set<string>();
    const canJoinParent = parentStudentExists && parentTableExists && usersTableExists;

    const studentIdColumn = pickFirstColumn(studentTable.columns, STUDENT_ID_COLUMNS) ?? "student_id";
    const sectionColumn = pickFirstColumn(studentTable.columns, SECTION_COLUMNS) ?? "section";
    const subjectColumn = pickFirstColumn(studentTable.columns, SUBJECT_COLUMNS);
    const gradeIdColumn = studentTable.columns.has("grade_id") ? "grade_id" : null;
    const gradeLevelColumn = studentTable.columns.has("grade_level")
      ? "grade_level"
      : studentTable.columns.has("grade")
        ? "grade"
        : null;
    const gradeTableExists = gradeIdColumn ? await tableExists("grade") : false;
    const canJoinAssessmentLevels = (await tableExists("student_subject_assessment"))
      && (await tableExists("phonemic_level"))
      && (await tableExists("subject"));

    let englishSubjectId: number | null = null;
    let filipinoSubjectId: number | null = null;
    let mathSubjectId: number | null = null;

    if (canJoinAssessmentLevels) {
      const [[englishRow]] = await query<RowDataPacket[]>(
        "SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = 'english' LIMIT 1",
      );
      const [[filipinoRow]] = await query<RowDataPacket[]>(
        "SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = 'filipino' LIMIT 1",
      );
      const [[mathRow]] = await query<RowDataPacket[]>(
        "SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) IN ('math', 'mathematics') LIMIT 1",
      );

      englishSubjectId = typeof englishRow?.subject_id === "number" ? englishRow.subject_id : null;
      filipinoSubjectId = typeof filipinoRow?.subject_id === "number" ? filipinoRow.subject_id : null;
      mathSubjectId = typeof mathRow?.subject_id === "number" ? mathRow.subject_id : null;
    }

    const studentContactColumn = pickFirstColumn(studentTable.columns, CONTACT_COLUMNS);
    const userContactColumn = canJoinStudentUsers ? pickFirstColumn(userColumns, CONTACT_COLUMNS) : null;
    const studentEmailColumn = pickFirstColumn(studentTable.columns, EMAIL_COLUMNS);
    const userEmailColumn = canJoinStudentUsers ? pickFirstColumn(userColumns, EMAIL_COLUMNS) ?? "email" : null;
    const studentLrnColumn = pickFirstColumn(studentTable.columns, LRN_COLUMNS);
    const studentSuffixColumn = pickFirstColumn(studentTable.columns, SUFFIX_COLUMNS);
    const parentRelationshipColumn = pickFirstColumn(parentStudentColumns, RELATIONSHIP_COLUMNS);
    const parentAddressColumn = pickFirstColumn(parentStudentColumns, ADDRESS_COLUMNS);
    const parentStudentIdColumn = parentStudentColumns.has("parent_student_id") ? "parent_student_id" : null;
    const parentStudentParentIdColumn = parentStudentColumns.has("parent_id") ? "parent_id" : null;
    const parentStudentStudentIdColumn = parentStudentColumns.has("student_id") ? "student_id" : null;
    const parentTableIdColumn = parentColumns.has("parent_id") ? "parent_id" : null;
    const parentTableUserIdColumn = parentColumns.has("user_id") ? "user_id" : null;

    const selectParts: string[] = [
      `s.${studentIdColumn} AS student_identifier`,
      studentTable.columns.has("user_id") ? "s.user_id AS student_user_id" : "NULL AS student_user_id",
    ];

    if (gradeIdColumn && gradeTableExists) {
      selectParts.push("g.grade_level AS grade_value");
    } else if (gradeIdColumn) {
      selectParts.push(`s.${gradeIdColumn} AS grade_value`);
    } else if (gradeLevelColumn) {
      selectParts.push(`s.${gradeLevelColumn} AS grade_value`);
    } else {
      selectParts.push("NULL AS grade_value");
    }

    if (sectionColumn) {
      selectParts.push(`s.${sectionColumn} AS section_value`);
    } else {
      selectParts.push("NULL AS section_value");
    }

    if (subjectColumn) {
      selectParts.push(`s.${subjectColumn} AS subject_value`);
    } else {
      selectParts.push("NULL AS subject_value");
    }

    if (studentLrnColumn) {
      selectParts.push(`s.${studentLrnColumn} AS student_lrn`);
    } else {
      selectParts.push("NULL AS student_lrn");
    }

    if (studentSuffixColumn) {
      selectParts.push(`s.${studentSuffixColumn} AS student_suffix`);
    } else {
      selectParts.push("NULL AS student_suffix");
    }

    if (studentContactColumn) {
      selectParts.push(`s.${studentContactColumn} AS student_contact`);
    } else {
      selectParts.push("NULL AS student_contact");
    }

    if (studentEmailColumn) {
      selectParts.push(`s.${studentEmailColumn} AS student_email`);
    } else {
      selectParts.push("NULL AS student_email");
    }

    for (const column of NAME_COLUMNS) {
      if (studentTable.columns.has(column)) {
        selectParts.push(`s.${column} AS student_${column}`);
      } else {
        selectParts.push(`NULL AS student_${column}`);
      }
    }

    for (const column of NAME_COLUMNS) {
      if (canJoinStudentUsers && userColumns.has(column)) {
        selectParts.push(`u.${column} AS user_${column}`);
      } else {
        selectParts.push(`NULL AS user_${column}`);
      }
    }

    if (canJoinStudentUsers && userContactColumn) {
      selectParts.push(`u.${userContactColumn} AS user_contact`);
    } else {
      selectParts.push("NULL AS user_contact");
    }

    if (canJoinStudentUsers && userEmailColumn && userColumns.has(userEmailColumn)) {
      selectParts.push(`u.${userEmailColumn} AS user_email`);
    } else if (canJoinStudentUsers) {
      selectParts.push("u.email AS user_email");
    } else {
      selectParts.push("NULL AS user_email");
    }

    selectParts.push(canJoinStudentUsers ? "u.username AS user_username" : "NULL AS user_username");

    if (canJoinAssessmentLevels) {
      selectParts.push("sa.english_phonemic AS english_phonemic");
      selectParts.push("sa.filipino_phonemic AS filipino_phonemic");
      selectParts.push("sa.math_phonemic AS math_phonemic");
    } else {
      selectParts.push("NULL AS english_phonemic");
      selectParts.push("NULL AS filipino_phonemic");
      selectParts.push("NULL AS math_phonemic");
    }

    if (canJoinParent && parentStudentParentIdColumn && parentStudentStudentIdColumn && parentTableIdColumn && parentTableUserIdColumn) {
      selectParts.push("ps.parent_id AS parent_identifier");
      selectParts.push(parentRelationshipColumn ? `ps.${parentRelationshipColumn} AS parent_relationship` : "NULL AS parent_relationship");
      selectParts.push(parentAddressColumn ? `ps.${parentAddressColumn} AS parent_address` : "NULL AS parent_address");

      for (const column of NAME_COLUMNS) {
        if (userColumns.has(column)) {
          selectParts.push(`pu.${column} AS parent_${column}`);
        } else {
          selectParts.push(`NULL AS parent_${column}`);
        }
      }

      const parentContactColumn = pickFirstColumn(userColumns, CONTACT_COLUMNS);
      if (parentContactColumn) {
        selectParts.push(`pu.${parentContactColumn} AS parent_contact`);
      } else {
        selectParts.push("NULL AS parent_contact");
      }

      const parentEmailColumn = pickFirstColumn(userColumns, EMAIL_COLUMNS) ?? "email";
      if (userColumns.has(parentEmailColumn)) {
        selectParts.push(`pu.${parentEmailColumn} AS parent_email`);
      } else {
        selectParts.push("NULL AS parent_email");
      }

      selectParts.push(userColumns.has("username") ? "pu.username AS parent_username" : "NULL AS parent_username");
    } else {
      selectParts.push("NULL AS parent_identifier");
      selectParts.push("NULL AS parent_relationship");
      selectParts.push("NULL AS parent_address");
      selectParts.push("NULL AS parent_first_name");
      selectParts.push("NULL AS parent_middle_name");
      selectParts.push("NULL AS parent_last_name");
      selectParts.push("NULL AS parent_contact");
      selectParts.push("NULL AS parent_email");
      selectParts.push("NULL AS parent_username");
    }

    const joinClauses: string[] = [];
    if (gradeIdColumn && gradeTableExists) {
      joinClauses.push("LEFT JOIN grade AS g ON g.grade_id = s.grade_id");
    }
    if (canJoinStudentUsers) {
      joinClauses.push("LEFT JOIN users AS u ON u.user_id = s.user_id");
    }
    if (canJoinParent && parentStudentParentIdColumn && parentStudentStudentIdColumn && parentTableIdColumn && parentTableUserIdColumn) {
      if (parentStudentIdColumn) {
        joinClauses.push(
          `LEFT JOIN (\
            SELECT ps1.${parentStudentStudentIdColumn} AS student_id,\
                   ps1.${parentStudentParentIdColumn} AS parent_id,\
                   ${parentRelationshipColumn ? `ps1.${parentRelationshipColumn} AS relationship,` : "NULL AS relationship,"}\
                   ${parentAddressColumn ? `ps1.${parentAddressColumn} AS address` : "NULL AS address"}\
            FROM ${PARENT_STUDENT_TABLE} AS ps1\
            INNER JOIN (\
              SELECT ${parentStudentStudentIdColumn} AS student_id, MIN(${parentStudentIdColumn}) AS min_id\
              FROM ${PARENT_STUDENT_TABLE}\
              GROUP BY ${parentStudentStudentIdColumn}\
            ) AS psmin\
            ON psmin.student_id = ps1.${parentStudentStudentIdColumn} AND psmin.min_id = ps1.${parentStudentIdColumn}\
          ) AS ps ON ps.student_id = s.${studentIdColumn}`,
          `LEFT JOIN ${PARENT_TABLE} AS p ON p.${parentTableIdColumn} = ps.parent_id`,
          `LEFT JOIN users AS pu ON pu.user_id = p.${parentTableUserIdColumn}`,
        );
      } else {
        joinClauses.push(
          `LEFT JOIN ${PARENT_STUDENT_TABLE} AS ps ON ps.${parentStudentStudentIdColumn} = s.${studentIdColumn}`,
          `LEFT JOIN ${PARENT_TABLE} AS p ON p.${parentTableIdColumn} = ps.${parentStudentParentIdColumn}`,
          `LEFT JOIN users AS pu ON pu.user_id = p.${parentTableUserIdColumn}`,
        );
      }
    }

    const sqlParams: Array<number> = [];
    if (canJoinAssessmentLevels) {
      joinClauses.push(
        `LEFT JOIN (
          SELECT
            ssa.student_id,
            MAX(CASE WHEN ssa.subject_id = ? THEN pl.level_name END) AS english_phonemic,
            MAX(CASE WHEN ssa.subject_id = ? THEN pl.level_name END) AS filipino_phonemic,
            MAX(CASE WHEN ssa.subject_id = ? THEN pl.level_name END) AS math_phonemic
          FROM student_subject_assessment AS ssa
          LEFT JOIN phonemic_level AS pl ON pl.phonemic_id = ssa.phonemic_id
          GROUP BY ssa.student_id
        ) AS sa ON sa.student_id = s.${studentIdColumn}`,
      );
      sqlParams.push(englishSubjectId ?? -1, filipinoSubjectId ?? -1, mathSubjectId ?? -1);
    }

    const orderClauses: string[] = [];
    if (studentTable.columns.has("last_name")) {
      orderClauses.push("s.last_name ASC");
    } else if (canJoinStudentUsers && userColumns.has("last_name")) {
      orderClauses.push("u.last_name ASC");
    }
    if (studentTable.columns.has("first_name")) {
      orderClauses.push("s.first_name ASC");
    } else if (canJoinStudentUsers && userColumns.has("first_name")) {
      orderClauses.push("u.first_name ASC");
    }
    if (!orderClauses.length) {
      orderClauses.push(`s.${studentIdColumn} ASC`);
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
      FROM \`${studentTable.name}\` AS s
      ${joinClauses.join("\n")}
      ORDER BY ${orderClauses.join(", ")}
    `;

    const [rows] = await query<RowDataPacket[]>(sql, sqlParams);

    const students = rows.map((row) => {
      const identifierRaw = row.student_identifier;
      const studentId = identifierRaw !== null && identifierRaw !== undefined ? String(identifierRaw) : null;
      const gradeNumber = extractGradeNumber(row.grade_value);
      const gradeLabel = formatGradeLabel(row.grade_value);
      const section = row.section_value ? String(row.section_value).trim() : null;
      const subjects = row.subject_value ? String(row.subject_value).trim() : null;
      const lrn = row.student_lrn ? String(row.student_lrn).trim() : null;
      const suffix = row.student_suffix ? String(row.student_suffix).trim() : null;
      const nameParts = resolveName(row);
      const formattedName = formatPrincipalStudentFullName({
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        suffix,
        fallback: nameParts.fullName,
      });
      const email = row.student_email ?? row.user_email ?? null;
      const contactNumber = row.student_contact ?? row.user_contact ?? null;
      const englishPhonemic = row.english_phonemic ? String(row.english_phonemic).trim() : null;
      const filipinoPhonemic = row.filipino_phonemic ? String(row.filipino_phonemic).trim() : null;
      const mathProficiency = row.math_phonemic ? String(row.math_phonemic).trim() : null;
      const parentFirstName = row.parent_first_name ?? null;
      const parentMiddleName = row.parent_middle_name ?? null;
      const parentLastName = row.parent_last_name ?? null;
      const parentRelationship = row.parent_relationship ?? row.relationship ?? null;
      const parentAddress = row.parent_address ?? row.address ?? null;
      const parentContactNumber = row.parent_contact ?? null;
      const parentEmail = row.parent_email ?? null;
      const parentUsername = row.parent_username ?? null;

      return {
        studentId,
        userId: row.student_user_id ?? null,
        grade: gradeNumber ?? (gradeLabel ? gradeLabel : null),
        gradeNumber,
        gradeLabel,
        section,
        sections: section,
        subjects,
        lrn,
        english: englishPhonemic,
        filipino: filipinoPhonemic,
        math: mathProficiency,
        englishPhonemic,
        filipinoPhonemic,
        mathProficiency,
        suffix,
        name: formattedName,
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        email,
        contactNumber: contactNumber ? String(contactNumber) : null,
        username: row.user_username ?? null,
        parentFirstName,
        parentMiddleName,
        parentLastName,
        parentRelationship,
        parentAddress,
        parentContactNumber: parentContactNumber ? String(parentContactNumber) : null,
        parentEmail,
        parentUsername,
      };
    });

    const total = students.length;

    return NextResponse.json({
      students,
      total,
      metadata: {
        studentTable: studentTable.name,
        notes: null,
      },
    });
  } catch (error) {
    console.error("Failed to load principal students", error);
    return NextResponse.json({ error: "Failed to load students." }, { status: 500 });
  }
}

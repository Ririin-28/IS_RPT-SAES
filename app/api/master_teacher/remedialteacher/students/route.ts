import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { getMasterTeacherSessionFromCookies } from "@/lib/server/master-teacher-session";
const ASSIGNMENT_TABLE = "student_teacher_assignment";
const REMEDIAL_HANDLED_TABLE = "mt_remedialteacher_handled";

export const dynamic = "force-dynamic";

const SUBJECT_LABELS: Record<string, string> = {
	english: "English",
	filipino: "Filipino",
	math: "Math",
	mathematics: "Math",
};

const sanitize = (value: unknown): string | null => {
	if (value === null || value === undefined) return null;
	const text = String(value).trim();
	return text.length ? text : null;
};

type RawStudentRow = RowDataPacket & {
	student_id: string | null;
	lrn: string | null;
	student_identifier: string | null;
	student_grade_level: string | null;
	student_section: string | null;
	guardian: string | null;
	guardian_contact: string | null;
	guardian_email: string | null;
	parent_first_name: string | null;
	parent_middle_name: string | null;
	parent_last_name: string | null;
	parent_suffix: string | null;
	relationship: string | null;
	address: string | null;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
	suffix: string | null;
	english_phonemic: string | null;
	filipino_phonemic: string | null;
	math_phonemic: string | null;
};

const normalizeStudentRow = (row: RawStudentRow) => {
	const firstName = sanitize(row.first_name);
	const middleName = sanitize(row.middle_name);
	const lastName = sanitize(row.last_name);
	const suffix = sanitize(row.suffix);
	const parts = [firstName, middleName, lastName].filter((part) => typeof part === "string" && part.length > 0);
	const fullName = parts.length ? parts.join(" ") : null;
	const fullNameWithSuffix = suffix ? [fullName ?? "", suffix].filter(Boolean).join(" ") : fullName;

	return {
		studentId: sanitize(row.student_id),
		lrn: sanitize(row.lrn),
		userId: null,
		remedialId: null,
		studentIdentifier: sanitize(row.student_identifier),
		grade: sanitize(row.student_grade_level),
		section: sanitize(row.student_section),
		english: sanitize(row.english_phonemic),
		filipino: sanitize(row.filipino_phonemic),
		math: sanitize(row.math_phonemic),
		guardian: sanitize(row.guardian),
		guardianContact: sanitize(row.guardian_contact),
		guardianEmail: sanitize(row.guardian_email),
		parentFirstName: sanitize(row.parent_first_name),
		parentMiddleName: sanitize(row.parent_middle_name),
		parentLastName: sanitize(row.parent_last_name),
		parentSuffix: sanitize(row.parent_suffix),
		relationship: sanitize(row.relationship),
		address: sanitize(row.address),
		firstName,
		middleName,
		lastName,
		suffix,
		fullName: fullNameWithSuffix,
	};
};

const ensureAssignmentTable = async () => {
	await query(
		`CREATE TABLE IF NOT EXISTS ${ASSIGNMENT_TABLE} (
			assignment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
			student_id VARCHAR(20) NOT NULL,
			teacher_id VARCHAR(20) NULL,
			remedial_role_id VARCHAR(20) NULL,
			grade_id INT NOT NULL,
			subject_id INT NOT NULL,
			assigned_by_mt_id VARCHAR(20) NULL,
			assigned_date DATE NULL,
			is_active TINYINT(1) NOT NULL DEFAULT 1,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			KEY idx_student_assignment_teacher (teacher_id),
			KEY idx_student_assignment_remedial (remedial_role_id),
			KEY idx_student_assignment_student (student_id),
			KEY idx_student_assignment_grade_subject (grade_id, subject_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
	);
};

const resolveRemedialRoleId = async (masterTeacherId: string): Promise<string | null> => {
	const columns = await getTableColumns(REMEDIAL_HANDLED_TABLE).catch(() => new Set<string>());
	if (!columns.size || !columns.has("remedial_role_id") || !columns.has("master_teacher_id")) {
		return null;
	}

	const [rows] = await query<RowDataPacket[]>(
		`SELECT remedial_role_id FROM ${REMEDIAL_HANDLED_TABLE}
		 WHERE master_teacher_id = ? AND remedial_role_id IS NOT NULL
		 LIMIT 1`,
		[masterTeacherId],
	);

	const value = rows[0]?.remedial_role_id;
	if (value === null || value === undefined) return null;
	const trimmed = String(value).trim();
	return trimmed.length ? trimmed : null;
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

	try {
		await ensureAssignmentTable();
		const session = await getMasterTeacherSessionFromCookies();
		let masterTeacherId = session?.masterTeacherId ?? null;
		let remedialRoleId = session?.remedialRoleId ?? null;

		if (!masterTeacherId) {
			if (!userIdParam) {
				return NextResponse.json({ success: false, error: "Missing userId query parameter." }, { status: 400 });
			}

			const userId = Number(userIdParam);
			if (!Number.isFinite(userId) || userId <= 0) {
				return NextResponse.json({ success: false, error: "Invalid userId value." }, { status: 400 });
			}

			const [[masterRow]] = await query<RowDataPacket[]>(
				"SELECT master_teacher_id FROM master_teacher WHERE user_id = ? LIMIT 1",
				[userId],
			);

			masterTeacherId = (masterRow?.master_teacher_id as string | undefined) ?? null;
		}

		if (!masterTeacherId) {
			return NextResponse.json({ success: false, error: "Master Teacher record not found." }, { status: 404 });
		}

		if (!remedialRoleId) {
			remedialRoleId = await resolveRemedialRoleId(masterTeacherId);
		}


		const [[englishRow]] = await query<RowDataPacket[]>(
			"SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = 'english' LIMIT 1",
		);
		const [[filipinoRow]] = await query<RowDataPacket[]>(
			"SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = 'filipino' LIMIT 1",
		);
		const [[mathRow]] = await query<RowDataPacket[]>(
			"SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = 'math' LIMIT 1",
		);

		const englishId = englishRow?.subject_id as number | undefined;
		const filipinoId = filipinoRow?.subject_id as number | undefined;
		const mathId = mathRow?.subject_id as number | undefined;

		const subjectIdMap: Record<string, number | undefined> = {
			English: englishId,
			Filipino: filipinoId,
			Math: mathId,
		};

		const subjectId = subjectIdMap[subjectLabel];
		if (!subjectId) {
			return NextResponse.json(
				{ success: false, error: `Subject '${subjectLabel}' not found in subject table.` },
				{ status: 404 },
			);
		}

		const assignmentColumns = await getTableColumns(ASSIGNMENT_TABLE).catch(() => new Set<string>());
		const canFilterByRole = assignmentColumns.has("remedial_role_id") && Boolean(remedialRoleId);
		if (!canFilterByRole) {
			return NextResponse.json(
				{ success: false, error: "Remedial role context is missing for this master teacher." },
				{ status: 400 },
			);
		}
		// Parameter order must follow placeholder order in the SQL: ssa.subject_id, subjectId, remedialRoleId.
		const params: Array<string | number | null> = [
			englishId ?? null,
			filipinoId ?? null,
			mathId ?? null,
			subjectId,
			remedialRoleId as string,
		];

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
				gi.parent_first_name AS parent_first_name,
				gi.parent_middle_name AS parent_middle_name,
				gi.parent_last_name AS parent_last_name,
				gi.parent_suffix AS parent_suffix,
				gi.relationship AS relationship,
				gi.address AS address,
				s.first_name,
				s.middle_name,
				s.last_name,
				s.suffix,
				MAX(CASE WHEN ssa.subject_id = ? THEN pl.level_name END) AS english_phonemic,
				MAX(CASE WHEN ssa.subject_id = ? THEN pl.level_name END) AS filipino_phonemic,
				MAX(CASE WHEN ssa.subject_id = ? THEN pl.level_name END) AS math_phonemic
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
					MIN(u.first_name) AS parent_first_name,
					MIN(u.middle_name) AS parent_middle_name,
					MIN(u.last_name) AS parent_last_name,
					MIN(u.suffix) AS parent_suffix,
					MIN(ps.relationship) AS relationship,
					MIN(ps.address) AS address
				FROM parent_student ps
				JOIN parent p ON p.parent_id = ps.parent_id
				JOIN users u ON u.user_id = p.user_id
				GROUP BY ps.student_id
			) gi ON gi.student_id = s.student_id
			LEFT JOIN student_subject_assessment ssa ON ssa.student_id = s.student_id
			LEFT JOIN phonemic_level pl ON pl.phonemic_id = ssa.phonemic_id
			JOIN ${ASSIGNMENT_TABLE} sta
				ON sta.student_id = s.student_id
				AND sta.is_active = 1
				AND sta.subject_id = ?
				AND sta.grade_id = s.grade_id
				AND sta.remedial_role_id = ?
			GROUP BY s.student_id, g.grade_level, s.section, gi.guardian, gi.guardian_contact, s.first_name, s.middle_name, s.last_name
			ORDER BY g.grade_level, s.section, s.last_name, s.first_name, s.student_id
		`;

		const [rows] = await query<RawStudentRow[]>(sql, params);
		const students = rows.map((row) => normalizeStudentRow(row));

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
		console.error(`Failed to load remedial students for ${subjectLabel}`, error);
		return NextResponse.json(
			{ success: false, error: `Failed to load remedial students for ${subjectLabel}.` },
			{ status: 500 },
		);
	}
}
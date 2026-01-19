import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

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
		const [[masterRow]] = await query<RowDataPacket[]>(
			"SELECT master_teacher_id FROM master_teacher WHERE user_id = ? LIMIT 1",
			[userId],
		);

		const masterTeacherId = masterRow?.master_teacher_id as string | undefined;
		if (!masterTeacherId) {
			return NextResponse.json({ success: false, error: "Master Teacher record not found." }, { status: 404 });
		}

		const [gradeRows] = await query<RowDataPacket[]>(
			"SELECT grade_id FROM mt_remedialteacher_handled WHERE master_teacher_id = ?",
			[masterTeacherId],
		);

		const gradeIds = gradeRows.map((row) => row.grade_id as number).filter((id) => Number.isFinite(id));
		if (!gradeIds.length) {
			return NextResponse.json(
				{ success: false, error: "No handled grades found for this master teacher." },
				{ status: 404 },
			);
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

		const gradePlaceholders = gradeIds.map(() => "?").join(",");
		// Parameter order must follow placeholder order in the SQL: ssa.subject_id, subquery subject_id,
		// all grade placeholders, then ss.subject_id.
		const params: Array<string | number> = [
			englishId ?? null,
			filipinoId ?? null,
			mathId ?? null,
			...gradeIds,
			subjectId,
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
			WHERE s.grade_id IN (${gradePlaceholders}) 
				AND EXISTS (
					SELECT 1 FROM student_subject_assessment ssa2
					WHERE ssa2.student_id = s.student_id AND ssa2.subject_id = ?
				)
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
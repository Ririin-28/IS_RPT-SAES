import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query, tableExists } from "@/lib/db";

export const dynamic = "force-dynamic";

const USER_TABLE = "users" as const;
const REMEDIAL_TABLE = "remedial_teachers" as const;
const STUDENT_TABLE = "student" as const;

const USER_ID_COLUMNS = ["user_id", "id"] as const;
const USER_FIRST_NAME_COLUMNS = ["first_name", "firstname", "given_name", "first"] as const;
const USER_MIDDLE_NAME_COLUMNS = ["middle_name", "middlename", "middle", "mi"] as const;
const USER_LAST_NAME_COLUMNS = ["last_name", "lastname", "surname", "family_name", "last"] as const;

const REMEDIAL_USER_COLUMNS = [
	"user_id",
	"teacher_id",
	"master_teacher_id",
	"remedial_teacher_id",
	"employee_id",
] as const;
const REMEDIAL_GRADE_COLUMNS = [
	"grade",
	"grade_level",
	"handled_grade",
	"gradelevel",
	"gradeLevel",
] as const;

const STUDENT_USER_COLUMNS = ["user_id", "student_user_id", "userId"] as const;
const STUDENT_ID_COLUMNS = ["student_id", "studentId", "studentID", "id"] as const;
const STUDENT_REMEDIAL_COLUMNS = ["remedial_id", "remedial_teacher_id", "remedialid"] as const;
const STUDENT_IDENTIFIER_COLUMNS = [
	"student_identifier",
	"student_code",
	"student_number",
	"student_no",
] as const;
const STUDENT_GRADE_COLUMNS = ["grade", "grade_level", "gradelevel", "year_level"] as const;
const STUDENT_SECTION_COLUMNS = ["section", "class_section", "section_name", "section_handled"] as const;
const STUDENT_ENGLISH_COLUMNS = ["english", "english_status", "english_proficiency"] as const;
const STUDENT_FILIPINO_COLUMNS = ["filipino", "filipino_status", "filipino_proficiency"] as const;
const STUDENT_MATH_COLUMNS = ["math", "math_status", "math_proficiency"] as const;
const STUDENT_GUARDIAN_COLUMNS = ["guardian", "guardian_name", "parent_guardian"] as const;
const STUDENT_GUARDIAN_CONTACT_COLUMNS = [
	"guardian_contact",
	"guardian_contact_number",
	"guardian_number",
	"parent_contact",
] as const;
const STUDENT_ADDRESS_COLUMNS = ["address", "home_address", "street_address"] as const;
const STUDENT_FIRST_NAME_COLUMNS = ["first_name", "firstname", "given_name"] as const;
const STUDENT_MIDDLE_NAME_COLUMNS = ["middle_name", "middlename", "middle"] as const;
const STUDENT_LAST_NAME_COLUMNS = ["last_name", "lastname", "surname"] as const;
const STUDENT_FULL_NAME_COLUMNS = ["full_name", "name", "student_name"] as const;

const sanitize = (value: unknown): string | null => {
	if (value === null || value === undefined) {
		return null;
	}
	const text = String(value).trim();
	return text.length ? text : null;
};

const pickColumn = (columns: Set<string>, candidates: readonly string[]): string | null => {
	for (const candidate of candidates) {
		if (columns.has(candidate)) {
			return candidate;
		}
	}

	const lowerLookup = new Map<string, string>();
	for (const column of columns) {
		lowerLookup.set(column.toLowerCase(), column);
	}

	for (const candidate of candidates) {
		const resolved = lowerLookup.get(candidate.toLowerCase());
		if (resolved) {
			return resolved;
		}
	}

	for (const candidate of candidates) {
		const needle = candidate.toLowerCase();
		for (const column of columns) {
			if (column.toLowerCase().includes(needle)) {
				return column;
			}
		}
	}

	return null;
};

const safeGetColumns = async (tableName: string): Promise<Set<string>> => {
	try {
		return await getTableColumns(tableName);
	} catch (error) {
		console.warn(`Unable to read columns for table ${tableName}`, error);
		return new Set<string>();
	}
};

type RawStudentRow = RowDataPacket & {
	student_id: number | null;
	student_user_id: number | null;
	student_remedial_id: number | null;
	student_identifier?: string | null;
	student_grade?: string | null;
	student_section?: string | null;
	student_english?: string | null;
	student_filipino?: string | null;
	student_math?: string | null;
	student_guardian?: string | null;
	student_guardian_contact?: string | null;
	student_address?: string | null;
	user_first_name?: string | null;
	user_middle_name?: string | null;
	user_last_name?: string | null;
	student_first_name?: string | null;
	student_middle_name?: string | null;
	student_last_name?: string | null;
	student_full_name?: string | null;
};

type RemedialStudentPayload = {
	studentId: number | null;
	userId: number | null;
	remedialId: number | null;
	studentIdentifier: string | null;
	grade: string | null;
	section: string | null;
	english: string | null;
	filipino: string | null;
	math: string | null;
	guardian: string | null;
	guardianContact: string | null;
	address: string | null;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	fullName: string | null;
};

const normalizeStudentRow = (row: RawStudentRow): RemedialStudentPayload => {
	const firstName = sanitize(row.user_first_name) ?? sanitize(row.student_first_name);
	const middleName = sanitize(row.user_middle_name) ?? sanitize(row.student_middle_name);
	const lastName = sanitize(row.user_last_name) ?? sanitize(row.student_last_name);
	const fallbackFullName = [firstName, middleName, lastName]
		.filter((part) => typeof part === "string" && part.length > 0)
		.join(" ");

	const fullName = (() => {
		const candidate = sanitize(row.student_full_name);
		if (candidate && candidate.length > 0) {
			return candidate;
		}
		if (fallbackFullName.length > 0) {
			return fallbackFullName;
		}
		return null;
	})();

	const studentId = row.student_id !== null && row.student_id !== undefined ? Number(row.student_id) : null;
	const userId = row.student_user_id !== null && row.student_user_id !== undefined ? Number(row.student_user_id) : null;
	const remedialId =
		row.student_remedial_id !== null && row.student_remedial_id !== undefined
			? Number(row.student_remedial_id)
			: null;

	let identifier = sanitize(row.student_identifier);
	if (!identifier && studentId !== null) {
		identifier = `ST-${String(studentId).padStart(4, "0")}`;
	}

	return {
		studentId,
		userId,
		remedialId,
		studentIdentifier: identifier ?? null,
		grade: sanitize(row.student_grade),
		section: sanitize(row.student_section),
		english: sanitize(row.student_english),
		filipino: sanitize(row.student_filipino),
		math: sanitize(row.student_math),
		guardian: sanitize(row.student_guardian),
		guardianContact: sanitize(row.student_guardian_contact),
		address: sanitize(row.student_address),
		firstName: firstName ?? null,
		middleName: middleName ?? null,
		lastName: lastName ?? null,
		fullName,
	};
};

export async function GET(request: NextRequest) {
	const url = new URL(request.url);
	const userIdParam = url.searchParams.get("userId");
	const searchParam = url.searchParams.get("search");

	if (!userIdParam) {
		return NextResponse.json(
			{ success: false, error: "Missing userId query parameter." },
			{ status: 400 },
		);
	}

	const userId = Number(userIdParam);
	if (!Number.isFinite(userId) || userId <= 0) {
		return NextResponse.json(
			{ success: false, error: "Invalid userId value." },
			{ status: 400 },
		);
	}

	try {
		const [usersExists, remedialExists, studentExists] = await Promise.all([
			tableExists(USER_TABLE),
			tableExists(REMEDIAL_TABLE),
			tableExists(STUDENT_TABLE),
		]);

		if (!usersExists || !remedialExists || !studentExists) {
			return NextResponse.json(
				{ success: false, error: "Required tables are unavailable." },
				{ status: 500 },
			);
		}

		const [userColumns, remedialColumns, studentColumns] = await Promise.all([
			safeGetColumns(USER_TABLE),
			safeGetColumns(REMEDIAL_TABLE),
			safeGetColumns(STUDENT_TABLE),
		]);

		if (!userColumns.size || !remedialColumns.size || !studentColumns.size) {
			return NextResponse.json(
				{ success: false, error: "Unable to resolve table metadata." },
				{ status: 500 },
			);
		}

		const userIdColumn = pickColumn(userColumns, USER_ID_COLUMNS) ?? "user_id";
		const userFirstNameColumn = pickColumn(userColumns, USER_FIRST_NAME_COLUMNS);
		const userMiddleNameColumn = pickColumn(userColumns, USER_MIDDLE_NAME_COLUMNS);
		const userLastNameColumn = pickColumn(userColumns, USER_LAST_NAME_COLUMNS);

		const remedialUserColumn = pickColumn(remedialColumns, REMEDIAL_USER_COLUMNS);
		const remedialGradeColumn = pickColumn(remedialColumns, REMEDIAL_GRADE_COLUMNS);

		const studentUserColumn = pickColumn(studentColumns, STUDENT_USER_COLUMNS);
		const studentIdColumn = pickColumn(studentColumns, STUDENT_ID_COLUMNS);
		const studentRemedialColumn = pickColumn(studentColumns, STUDENT_REMEDIAL_COLUMNS);
		const studentIdentifierColumn = pickColumn(studentColumns, STUDENT_IDENTIFIER_COLUMNS);
		const studentGradeColumn = pickColumn(studentColumns, STUDENT_GRADE_COLUMNS);
		const studentSectionColumn = pickColumn(studentColumns, STUDENT_SECTION_COLUMNS);
		const studentEnglishColumn = pickColumn(studentColumns, STUDENT_ENGLISH_COLUMNS);
		const studentFilipinoColumn = pickColumn(studentColumns, STUDENT_FILIPINO_COLUMNS);
		const studentMathColumn = pickColumn(studentColumns, STUDENT_MATH_COLUMNS);
		const studentGuardianColumn = pickColumn(studentColumns, STUDENT_GUARDIAN_COLUMNS);
		const studentGuardianContactColumn = pickColumn(studentColumns, STUDENT_GUARDIAN_CONTACT_COLUMNS);
		const studentAddressColumn = pickColumn(studentColumns, STUDENT_ADDRESS_COLUMNS);
		const studentFirstNameColumn = pickColumn(studentColumns, STUDENT_FIRST_NAME_COLUMNS);
		const studentMiddleNameColumn = pickColumn(studentColumns, STUDENT_MIDDLE_NAME_COLUMNS);
		const studentLastNameColumn = pickColumn(studentColumns, STUDENT_LAST_NAME_COLUMNS);
		const studentFullNameColumn = pickColumn(studentColumns, STUDENT_FULL_NAME_COLUMNS);

		if (!remedialUserColumn || !remedialGradeColumn) {
			return NextResponse.json(
				{ success: false, error: "Required columns for remedial teacher metadata are missing." },
				{ status: 500 },
			);
		}

		if (!studentUserColumn || !studentGradeColumn || !studentFilipinoColumn) {
			return NextResponse.json(
				{ success: false, error: "Student table is missing required columns for filtering." },
				{ status: 500 },
			);
		}

		const [gradeRows] = await query<RowDataPacket[]>(
			`SELECT ${remedialGradeColumn} AS handled_grade FROM \`${REMEDIAL_TABLE}\` WHERE ${remedialUserColumn} = ? LIMIT 1`,
			[userId],
		);

		const handledGrade = sanitize(gradeRows?.[0]?.handled_grade);
		if (!handledGrade) {
			return NextResponse.json(
				{ success: false, error: "Grade handled by remedial teacher is not set." },
				{ status: 404 },
			);
		}

		const selectParts: string[] = [];
		selectParts.push(studentIdColumn ? `s.${studentIdColumn} AS student_id` : "NULL AS student_id");
		selectParts.push(`s.${studentUserColumn} AS student_user_id`);
		selectParts.push(
			studentRemedialColumn
				? `s.${studentRemedialColumn} AS student_remedial_id`
				: "NULL AS student_remedial_id",
		);
		selectParts.push(
			studentIdentifierColumn
				? `s.${studentIdentifierColumn} AS student_identifier`
				: "NULL AS student_identifier",
		);
		selectParts.push(
			studentGradeColumn ? `s.${studentGradeColumn} AS student_grade` : "NULL AS student_grade",
		);
		selectParts.push(
			studentSectionColumn
				? `s.${studentSectionColumn} AS student_section`
				: "NULL AS student_section",
		);
		selectParts.push(
			studentEnglishColumn ? `s.${studentEnglishColumn} AS student_english` : "NULL AS student_english",
		);
		selectParts.push(
			studentFilipinoColumn
				? `s.${studentFilipinoColumn} AS student_filipino`
				: "NULL AS student_filipino",
		);
		selectParts.push(studentMathColumn ? `s.${studentMathColumn} AS student_math` : "NULL AS student_math");
		selectParts.push(
			studentGuardianColumn
				? `s.${studentGuardianColumn} AS student_guardian`
				: "NULL AS student_guardian",
		);
		selectParts.push(
			studentGuardianContactColumn
				? `s.${studentGuardianContactColumn} AS student_guardian_contact`
				: "NULL AS student_guardian_contact",
		);
		selectParts.push(
			studentAddressColumn ? `s.${studentAddressColumn} AS student_address` : "NULL AS student_address",
		);
		selectParts.push(
			studentFirstNameColumn
				? `s.${studentFirstNameColumn} AS student_first_name`
				: "NULL AS student_first_name",
		);
		selectParts.push(
			studentMiddleNameColumn
				? `s.${studentMiddleNameColumn} AS student_middle_name`
				: "NULL AS student_middle_name",
		);
		selectParts.push(
			studentLastNameColumn
				? `s.${studentLastNameColumn} AS student_last_name`
				: "NULL AS student_last_name",
		);
		selectParts.push(
			studentFullNameColumn
				? `s.${studentFullNameColumn} AS student_full_name`
				: "NULL AS student_full_name",
		);

		selectParts.push(
			userFirstNameColumn ? `u.${userFirstNameColumn} AS user_first_name` : "NULL AS user_first_name",
		);
		selectParts.push(
			userMiddleNameColumn ? `u.${userMiddleNameColumn} AS user_middle_name` : "NULL AS user_middle_name",
		);
		selectParts.push(userLastNameColumn ? `u.${userLastNameColumn} AS user_last_name` : "NULL AS user_last_name");

		const whereParts: string[] = [];
		const params: Array<string | number> = [];

		whereParts.push(`LOWER(TRIM(COALESCE(s.${studentGradeColumn}, ''))) = ?`);
		params.push(handledGrade.trim().toLowerCase());

		whereParts.push(
			`LOWER(TRIM(COALESCE(s.${studentFilipinoColumn}, ''))) IN ('filipino', 'yes', 'y', 'true', '1')`,
		);

		const orderParts: string[] = [];
		if (userLastNameColumn) {
			orderParts.push(`u.${userLastNameColumn}`);
		}
		if (userFirstNameColumn) {
			orderParts.push(`u.${userFirstNameColumn}`);
		}
		if (studentLastNameColumn && !orderParts.length) {
			orderParts.push(`s.${studentLastNameColumn}`);
		}
		if (studentFirstNameColumn && orderParts.length < 2) {
			orderParts.push(`s.${studentFirstNameColumn}`);
		}
		if (studentIdColumn) {
			orderParts.push(`s.${studentIdColumn}`);
		}

		const sql = `
			SELECT ${selectParts.join(", ")}
			FROM \`${STUDENT_TABLE}\` AS s
			JOIN \`${USER_TABLE}\` AS u ON u.${userIdColumn} = s.${studentUserColumn}
			WHERE ${whereParts.join(" AND ")}
			ORDER BY ${orderParts.length ? orderParts.join(", ") : "s." + studentUserColumn}
		`;

		const [rows] = await query<RawStudentRow[]>(sql, params);
		const students = rows.map(normalizeStudentRow);

		const filteredStudents = (() => {
			const term = sanitize(searchParam);
			if (!term) {
				return students;
			}
			const needle = term.toLowerCase();
			return students.filter((student) => {
				const candidates: Array<string | null> = [
					student.fullName,
					student.studentIdentifier,
					student.grade,
					student.section,
					student.english,
					student.filipino,
					student.math,
				];
				return candidates.some(
					(candidate) => typeof candidate === "string" && candidate.toLowerCase().includes(needle),
				);
			});
		})();

		return NextResponse.json({ success: true, grade: handledGrade, students: filteredStudents });
	} catch (error) {
		console.error("Failed to load filipino remedial students", error);
		return NextResponse.json(
			{ success: false, error: "Failed to load filipino remedial students." },
			{ status: 500 },
		);
	}
}

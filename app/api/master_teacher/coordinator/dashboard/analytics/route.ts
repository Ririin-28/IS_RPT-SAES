import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getTableColumns, query } from "@/lib/db";
import { comparePhonemicLevelsForSubject, toPhonemicSubjectName } from "@/lib/phonemic-levels";

export const dynamic = "force-dynamic";

type HandledScope = {
  gradeId: number;
  gradeLabel: string;
  subjectId: number;
  subjectName: string;
};

type AssessmentRow = {
  studentId: string;
  phonemicId: number;
  assessedAt: Date;
};

const safeGetColumns = async (table: string): Promise<Set<string>> => {
  try {
    return await getTableColumns(table);
  } catch {
    return new Set<string>();
  }
};

const toMonthKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const toMonthLabel = (value: Date): string => value.toLocaleDateString("en-US", { month: "short", year: "numeric" });

const parseRangeStart = (range: string): Date => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "3m") {
    start.setMonth(start.getMonth() - 2);
  } else if (range === "12m") {
    start.setMonth(start.getMonth() - 11);
  } else {
    start.setMonth(start.getMonth() - 5);
  }
  return start;
};

const buildMonthSeries = (start: Date, end: Date): Array<{ key: string; label: string }> => {
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const out: Array<{ key: string; label: string }> = [];
  while (cursor <= end) {
    out.push({ key: toMonthKey(cursor), label: toMonthLabel(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
};

const normalizeSubject = (value: string): string => value.trim().toLowerCase();

const getMasterTeacherId = async (userId: number): Promise<string | null> => {
  const columns = await safeGetColumns("master_teacher");
  if (!columns.has("master_teacher_id") || !columns.has("user_id")) {
    return null;
  }

  const [rows] = await query<RowDataPacket[]>(
    "SELECT master_teacher_id FROM master_teacher WHERE user_id = ? LIMIT 1",
    [userId],
  );

  const id = rows?.[0]?.master_teacher_id;
  if (id === null || id === undefined) {
    return null;
  }
  const text = String(id).trim();
  return text.length > 0 ? text : null;
};

const getHandledScopes = async (masterTeacherId: string): Promise<HandledScope[]> => {
  const columns = await safeGetColumns("mt_coordinator_handled");
  if (!columns.has("master_teacher_id") || !columns.has("grade_id") || !columns.has("subject_id")) {
    return [];
  }

  const [rows] = await query<RowDataPacket[]>(
    `
      SELECT
        mch.grade_id AS gradeId,
        COALESCE(CONCAT('Grade ', g.grade_level), CONCAT('Grade ', mch.grade_id)) AS gradeLabel,
        mch.subject_id AS subjectId,
        COALESCE(s.subject_name, CONCAT('Subject ', mch.subject_id)) AS subjectName
      FROM mt_coordinator_handled mch
      LEFT JOIN grade g ON g.grade_id = mch.grade_id
      LEFT JOIN subject s ON s.subject_id = mch.subject_id
      WHERE mch.master_teacher_id = ?
      ORDER BY mch.grade_id ASC, mch.subject_id ASC
    `,
    [masterTeacherId],
  );

  return (rows ?? [])
    .map((row) => ({
      gradeId: Number(row.gradeId),
      gradeLabel: String(row.gradeLabel ?? ""),
      subjectId: Number(row.subjectId),
      subjectName: String(row.subjectName ?? ""),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.gradeId) &&
        Number.isFinite(item.subjectId) &&
        item.gradeLabel.trim().length > 0 &&
        item.subjectName.trim().length > 0,
    );
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userIdParam = Number.parseInt(url.searchParams.get("userId") ?? "", 10);
    const range = (url.searchParams.get("range") ?? "6m").toLowerCase();
    const requestedSubject = (url.searchParams.get("subject") ?? "").trim();
    const selectedSection = (url.searchParams.get("section") ?? "All Sections").trim();

    if (!Number.isFinite(userIdParam) || userIdParam <= 0) {
      return NextResponse.json({ success: false, error: "userId is required." }, { status: 400 });
    }

    const masterTeacherId = await getMasterTeacherId(userIdParam);
    if (!masterTeacherId) {
      return NextResponse.json({ success: false, error: "Coordinator identity not found." }, { status: 404 });
    }

    const handledScopes = await getHandledScopes(masterTeacherId);
    if (!handledScopes.length) {
      return NextResponse.json({
        success: true,
        data: {
          handledScopes: [],
          sections: [],
          overview: {
            students: 0,
            teachers: 0,
            pendingMaterials: 0,
          },
          levelLabels: [],
          monthSeries: [],
          monthlyLevelCounts: {},
          levelShift: { before: [], after: [] },
          phonemicDistribution: [],
        },
      });
    }

    const normalizedSubject = requestedSubject ? normalizeSubject(requestedSubject) : "";
    const filteredScopes = normalizedSubject
      ? handledScopes.filter((scope) => normalizeSubject(scope.subjectName) === normalizedSubject)
      : handledScopes;

    const chartScopes = filteredScopes.length ? filteredScopes : handledScopes;
    const subjectIds = Array.from(new Set(chartScopes.map((scope) => scope.subjectId)));

    const assignmentColumns = await safeGetColumns("student_teacher_assignment");
    if (!assignmentColumns.has("student_id") || !assignmentColumns.has("grade_id") || !assignmentColumns.has("subject_id")) {
      return NextResponse.json({ success: false, error: "student_teacher_assignment schema is incomplete." }, { status: 500 });
    }

    const pairClauses: string[] = [];
    const pairParams: Array<number> = [];
    handledScopes.forEach((scope) => {
      pairClauses.push("(sta.grade_id = ? AND sta.subject_id = ?)");
      pairParams.push(scope.gradeId, scope.subjectId);
    });

    const assignmentWhere = [
      "sta.assigned_by_mt_id = ?",
      assignmentColumns.has("is_active") ? "sta.is_active = 1" : "1=1",
      `(${pairClauses.join(" OR ")})`,
    ].join(" AND ");

    const [assignmentRows] = await query<RowDataPacket[]>(
      `
        SELECT DISTINCT
          sta.student_id AS studentId,
          sta.teacher_id AS teacherId,
          sta.subject_id AS subjectId,
          s.section AS section
        FROM student_teacher_assignment sta
        JOIN student s ON s.student_id = sta.student_id
        WHERE ${assignmentWhere}
      `,
      [masterTeacherId, ...pairParams],
    );

    const overviewRows = (assignmentRows ?? [])
      .map((row) => ({
        studentId: String(row.studentId ?? "").trim(),
        teacherId: row.teacherId === null || row.teacherId === undefined ? "" : String(row.teacherId).trim(),
        subjectId: Number(row.subjectId),
        section: row.section === null || row.section === undefined ? "" : String(row.section).trim(),
      }))
      .filter((row) => row.studentId.length > 0 && Number.isFinite(row.subjectId));

    const scopedRows = overviewRows
      .filter((row) => subjectIds.includes(row.subjectId))
      .filter((row) => selectedSection === "All Sections" || row.section === selectedSection);

    const overviewFilteredRows = overviewRows.filter(
      (row) => selectedSection === "All Sections" || row.section === selectedSection,
    );

    const scopedStudentIds = Array.from(new Set(scopedRows.map((row) => row.studentId)));
    const overviewStudentIds = Array.from(new Set(overviewFilteredRows.map((row) => row.studentId)));
    const overviewTeacherIds = Array.from(new Set(overviewFilteredRows.map((row) => row.teacherId).filter((id) => id.length > 0)));
    const sectionOptions = Array.from(new Set(overviewRows.map((row) => row.section).filter((section) => section.length > 0))).sort((a, b) =>
      a.localeCompare(b),
    );

    const pendingPairClauses: string[] = [];
    const pendingParams: Array<number> = [];
    handledScopes.forEach((scope) => {
      pendingPairClauses.push("(rrs.grade_id = ? AND rrs.subject_id = ?)");
      pendingParams.push(scope.gradeId, scope.subjectId);
    });

    const [pendingRows] = await query<RowDataPacket[]>(
      `
        SELECT COUNT(DISTINCT rm.material_id) AS total
        FROM remedial_materials rm
        JOIN request_remedial_schedule rrs ON rrs.request_id = rm.request_id
        WHERE rm.status = 'Pending'
          AND (${pendingPairClauses.join(" OR ")})
      `,
      pendingParams,
    );

    const pendingMaterials = Number(pendingRows?.[0]?.total ?? 0);

    const startDate = parseRangeStart(range);
    const endDate = new Date();
    const monthSeries = buildMonthSeries(startDate, endDate);

    let levelLabels: string[] = [];
    let levelIds: number[] = [];

    if (subjectIds.length === 1) {
      const [levelRows] = await query<RowDataPacket[]>(
        "SELECT phonemic_id AS phonemicId, level_name AS levelName FROM phonemic_level WHERE subject_id = ? ORDER BY phonemic_id ASC",
        [subjectIds[0]],
      );

      const orderedLevelRows = [...(levelRows ?? [])].sort((left, right) =>
        comparePhonemicLevelsForSubject(
          toPhonemicSubjectName(chartScopes[0]?.subjectName),
          left.levelName,
          left.phonemicId,
          right.levelName,
          right.phonemicId,
        ),
      );

      levelIds = orderedLevelRows
        .map((row) => Number(row.phonemicId))
        .filter((value) => Number.isFinite(value));
      levelLabels = orderedLevelRows.map((row) => String(row.levelName ?? "").trim()).filter((value) => value.length > 0);
    }

    const monthlyLevelCounts: Record<string, number[]> = {};
    monthSeries.forEach((month) => {
      monthlyLevelCounts[month.key] = levelLabels.map(() => 0);
    });

    const levelShift = {
      before: levelLabels.map(() => 0),
      after: levelLabels.map(() => 0),
    };
    const phonemicDistribution = levelLabels.map(() => 0);

    if (scopedStudentIds.length > 0 && subjectIds.length === 1 && levelIds.length > 0) {
      const studentPlaceholders = scopedStudentIds.map(() => "?").join(", ");
      const [assessmentRows] = await query<RowDataPacket[]>(
        `
          SELECT
            ssa.student_id AS studentId,
            ssa.phonemic_id AS phonemicId,
            ssa.assessed_at AS assessedAt
          FROM student_subject_assessment ssa
          WHERE ssa.student_id IN (${studentPlaceholders})
            AND ssa.subject_id = ?
            AND ssa.assessed_at >= ?
            AND ssa.assessed_at <= ?
            AND ssa.phonemic_id IS NOT NULL
          ORDER BY ssa.assessed_at ASC
        `,
        [...scopedStudentIds, subjectIds[0], startDate, endDate],
      );

      const assessments: AssessmentRow[] = (assessmentRows ?? [])
        .map((row) => ({
          studentId: String(row.studentId ?? "").trim(),
          phonemicId: Number(row.phonemicId),
          assessedAt: new Date(row.assessedAt),
        }))
        .filter(
          (row) =>
            row.studentId.length > 0 &&
            Number.isFinite(row.phonemicId) &&
            !Number.isNaN(row.assessedAt.getTime()),
        );

      const levelIndexById = new Map<number, number>();
      levelIds.forEach((id, index) => levelIndexById.set(id, index));

      const latestByStudentPerMonth = new Map<string, Map<string, AssessmentRow>>();
      const earliestByStudent = new Map<string, AssessmentRow>();
      const latestByStudent = new Map<string, AssessmentRow>();

      assessments.forEach((row) => {
        const monthKey = toMonthKey(row.assessedAt);

        if (!latestByStudentPerMonth.has(monthKey)) {
          latestByStudentPerMonth.set(monthKey, new Map<string, AssessmentRow>());
        }
        const monthMap = latestByStudentPerMonth.get(monthKey);
        if (monthMap) {
          const existing = monthMap.get(row.studentId);
          if (!existing || row.assessedAt > existing.assessedAt) {
            monthMap.set(row.studentId, row);
          }
        }

        const earliest = earliestByStudent.get(row.studentId);
        if (!earliest || row.assessedAt < earliest.assessedAt) {
          earliestByStudent.set(row.studentId, row);
        }

        const latest = latestByStudent.get(row.studentId);
        if (!latest || row.assessedAt > latest.assessedAt) {
          latestByStudent.set(row.studentId, row);
        }
      });

      monthSeries.forEach((month) => {
        const monthMap = latestByStudentPerMonth.get(month.key);
        if (!monthMap) return;
        monthMap.forEach((row) => {
          const levelIndex = levelIndexById.get(row.phonemicId);
          if (levelIndex === undefined) return;
          monthlyLevelCounts[month.key][levelIndex] += 1;
        });
      });

      earliestByStudent.forEach((row) => {
        const levelIndex = levelIndexById.get(row.phonemicId);
        if (levelIndex === undefined) return;
        levelShift.before[levelIndex] += 1;
      });

      latestByStudent.forEach((row) => {
        const levelIndex = levelIndexById.get(row.phonemicId);
        if (levelIndex === undefined) return;
        levelShift.after[levelIndex] += 1;
        phonemicDistribution[levelIndex] += 1;
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        handledScopes,
        sections: sectionOptions,
        overview: {
          students: overviewStudentIds.length,
          teachers: overviewTeacherIds.length,
          pendingMaterials: Number.isFinite(pendingMaterials) ? pendingMaterials : 0,
        },
        levelLabels,
        monthSeries,
        monthlyLevelCounts,
        levelShift,
        phonemicDistribution,
      },
    });
  } catch (error) {
    console.error("Failed to load coordinator dashboard analytics", error);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

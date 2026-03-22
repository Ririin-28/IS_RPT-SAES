import { NextRequest, NextResponse } from "next/server";
import { type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import {
  buildAccessUrl,
  generateQrCodeDataUrl,
  generateQrToken,
  generateUniqueQuizCode,
  normalizeQuestionType,
} from "../../../lib/assessments/utils";
import {
  isAssessmentRangeWithinLimit,
  isFixedAssessmentStartTime,
  MAX_ASSESSMENT_SPAN_DAYS,
} from "@/lib/assessments/schedule-utils";

export const dynamic = "force-dynamic";

type IncomingChoice = {
  choiceText: string;
  isCorrect?: boolean;
};

type IncomingSection = {
  id?: string;
  title: string;
  description?: string;
};

type IncomingQuestion = {
  questionText: string;
  questionType: string;
  points: number;
  choices?: IncomingChoice[];
  correctAnswerText?: string | null;
  sectionId?: string | null;
  sectionTitle?: string | null;
  sectionDescription?: string | null;
};

type AssessmentPayload = {
  title: string;
  description?: string;
  subjectId?: number | null;
  subjectName?: string | null;
  gradeId?: number | null;
  phonemicId?: number | null;
  phonemicLevel?: string | null;
  createdBy: string;
  creatorRole: "teacher" | "remedial_teacher";
  startTime: string;
  endTime: string;
  isPublished: boolean;
  sections?: IncomingSection[];
  questions: IncomingQuestion[];
};

const resolveSectionMetadata = (question: IncomingQuestion, sections: IncomingSection[] = []) => {
  const sectionById = new Map<string, IncomingSection>();
  sections.forEach((section) => {
    if (section.id) {
      sectionById.set(section.id, section);
    }
  });

  const matchedSection = question.sectionId ? sectionById.get(question.sectionId) : undefined;
  return {
    sectionId: question.sectionId ?? null,
    sectionTitle: (matchedSection?.title ?? question.sectionTitle ?? "").trim() || null,
    sectionDescription: (matchedSection?.description ?? question.sectionDescription ?? "").trim() || null,
  };
};

const ensureQuestionSectionColumns = async (connection: PoolConnection) => {
  const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM `assessment_questions`");
  const columnNames = new Set(columns.map((column) => String(column.Field)));
  const alterations: string[] = [];

  if (!columnNames.has("section_key")) {
    alterations.push("ADD COLUMN `section_key` varchar(100) NULL AFTER `question_order`");
  }
  if (!columnNames.has("section_title")) {
    alterations.push("ADD COLUMN `section_title` varchar(255) NULL AFTER `section_key`");
  }
  if (!columnNames.has("section_description")) {
    alterations.push("ADD COLUMN `section_description` text NULL AFTER `section_title`");
  }

  if (alterations.length > 0) {
    await connection.query(`ALTER TABLE \`assessment_questions\` ${alterations.join(", ")}`);
  }
};

const resolveSubjectId = async (connection: PoolConnection, subjectName?: string | null) => {
  if (!subjectName) return null;
  const normalized = subjectName.trim().toLowerCase();
  const [rows] = await connection.query(
    "SELECT subject_id FROM subject WHERE LOWER(TRIM(subject_name)) = ? LIMIT 1",
    [normalized],
  );
  const row = (rows as RowDataPacket[])[0];
  return row?.subject_id ? Number(row.subject_id) : null;
};

const resolvePhonemicId = async (
  connection: PoolConnection,
  subjectId: number | null,
  phonemicLevel?: string | null,
) => {
  if (!subjectId || !phonemicLevel) return null;
  const [rows] = await connection.query(
    "SELECT phonemic_id FROM phonemic_level WHERE subject_id = ? AND LOWER(TRIM(level_name)) = ? LIMIT 1",
    [subjectId, phonemicLevel.trim().toLowerCase()],
  );
  const row = (rows as RowDataPacket[])[0];
  return row?.phonemic_id ? Number(row.phonemic_id) : null;
};

const resolveGradeId = async (
  connection: PoolConnection,
  createdBy: string,
  creatorRole: string,
) => {
  console.log(`Resolving grade for user: ${createdBy}, role: ${creatorRole}`);
  if (!createdBy || !creatorRole) return null;

  try {
    if (creatorRole === "teacher") {
      // 1. Try treating createdBy as user_id and join with teacher table
      const [rowsByUserId] = await connection.query(
        `SELECT th.grade_id 
         FROM teacher_handled th
         JOIN teacher t ON t.teacher_id = th.teacher_id
         WHERE t.user_id = ? 
         LIMIT 1`,
        [createdBy]
      );
      if ((rowsByUserId as RowDataPacket[]).length > 0) {
        console.log("Found grade via user_id -> teacher_handled");
        return Number((rowsByUserId as RowDataPacket[])[0].grade_id);
      }

      // 2. Try treating createdBy as teacher_id directly
      const [rowsByTeacherId] = await connection.query(
        `SELECT grade_id FROM teacher_handled WHERE teacher_id = ? LIMIT 1`,
        [createdBy]
      );
      if ((rowsByTeacherId as RowDataPacket[]).length > 0) {
        console.log("Found grade via teacher_id -> teacher_handled");
        return Number((rowsByTeacherId as RowDataPacket[])[0].grade_id);
      }

      // 3. Fallback: check student_teacher_assignment (active assignments)
      const [rowsAssignment] = await connection.query(
        `SELECT grade_id FROM student_teacher_assignment WHERE teacher_id = ? AND is_active = 1 LIMIT 1`,
        [createdBy]
      );
      if ((rowsAssignment as RowDataPacket[]).length > 0) {
        console.log("Found grade via student_teacher_assignment (teacher)");
        return Number((rowsAssignment as RowDataPacket[])[0].grade_id);
      }

    } else if (creatorRole === "remedial_teacher") {
      const [masterRows] = await connection.query(
        `SELECT master_teacher_id FROM master_teacher WHERE user_id = ? LIMIT 1`,
        [createdBy]
      );
      const masterTeacherId = (masterRows as RowDataPacket[])[0]?.master_teacher_id;
      if (masterTeacherId) {
        const [rowsRemedial] = await connection.query(
          `SELECT grade_id FROM mt_remedialteacher_handled WHERE master_teacher_id = ? AND grade_id IS NOT NULL LIMIT 1`,
          [masterTeacherId]
        );
        if ((rowsRemedial as RowDataPacket[]).length > 0) {
          console.log("Found grade via mt_remedialteacher_handled");
          return Number((rowsRemedial as RowDataPacket[])[0].grade_id);
        }

        const [rowsRole] = await connection.query(
          `SELECT remedial_role_id FROM mt_remedialteacher_handled WHERE master_teacher_id = ? AND remedial_role_id IS NOT NULL LIMIT 1`,
          [masterTeacherId]
        );
        const remedialRoleId = (rowsRole as RowDataPacket[])[0]?.remedial_role_id;
        if (remedialRoleId) {
          const [rowsAssignment] = await connection.query(
            `SELECT grade_id FROM student_teacher_assignment WHERE remedial_role_id = ? AND is_active = 1 LIMIT 1`,
            [remedialRoleId]
          );
          if ((rowsAssignment as RowDataPacket[]).length > 0) {
            console.log("Found grade via student_teacher_assignment (remedial)");
            return Number((rowsAssignment as RowDataPacket[])[0].grade_id);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error in resolveGradeId:", err);
  }

  console.log("Could not resolve gradeId");
  return null;
};

const mapAssessmentRows = (rows: RowDataPacket[]) => {
  const assessments = new Map<number, any>();
  const sectionSeenByAssessment = new Map<number, Set<string>>();

  rows.forEach((row) => {
    const assessmentId = Number(row.assessment_id);
    if (!assessments.has(assessmentId)) {
      assessments.set(assessmentId, {
        id: assessmentId,
        title: row.title,
        description: row.description ?? "",
        subjectId: row.subject_id ?? null,
        gradeId: row.grade_id ?? null,
        phonemicId: row.phonemic_id ?? null,
        phonemicLevel: row.phonemic_level_name ?? null,
        createdBy: row.created_by,
        creatorRole: row.creator_role,
        startDate: row.start_time,
        endDate: row.end_time,
        isPublished: Boolean(row.is_published),
        quizCode: row.quiz_code ?? null,
        qrToken: row.qr_token ?? null,
        submittedCount: Number(row.submitted_count ?? 0),
        assignedCount: Number(row.assigned_count ?? 0),
        sections: [],
        questions: [],
      });
    }

    const assessment = assessments.get(assessmentId);
    const sectionId = String(row.section_key ?? "").trim();
    const sectionTitle = String(row.section_title ?? "").trim();
    const sectionDescription = String(row.section_description ?? "").trim();

    if (sectionId && sectionTitle) {
      const seen = sectionSeenByAssessment.get(assessmentId) ?? new Set<string>();
      const sectionKey = `${sectionId}::${sectionTitle.toLowerCase()}`;
      if (!seen.has(sectionKey)) {
        assessment.sections.push({
          id: sectionId,
          title: sectionTitle,
          description: sectionDescription,
        });
        seen.add(sectionKey);
        sectionSeenByAssessment.set(assessmentId, seen);
      }
    }

    if (row.question_id) {
      let question = assessment.questions.find((q: any) => q.id === String(row.question_id));
      if (!question) {
        question = {
          id: String(row.question_id),
          type: row.question_type,
          question: row.question_text,
          options: [],
          correctAnswer: row.correct_answer_text ?? "",
          points: Number(row.points ?? 1),
          sectionId: sectionId || undefined,
          sectionTitle: sectionTitle || undefined,
          sectionDescription: sectionDescription || undefined,
        };
        assessment.questions.push(question);
      }

      if (row.choice_id) {
        question.options.push(row.choice_text);
        if (row.is_correct) {
          question.correctAnswer = row.choice_text;
        }
      }
    }
  });

  return Array.from(assessments.values());
};

const getColumnNames = async (connection: PoolConnection, tableName: string) => {
  const [columns] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(columns.map((column) => String(column.Field).toLowerCase()));
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const creatorId = searchParams.get("creatorId");
  const creatorRole = searchParams.get("creatorRole");
  const subjectId = searchParams.get("subjectId");
  const phonemicId = searchParams.get("phonemicId");

  try {
    return await runWithConnection(async (connection) => {
      const params: Array<string | number> = [];
      const where: string[] = [];

      if (creatorId) {
        where.push("a.created_by = ?");
        params.push(creatorId);
      }
      if (creatorRole) {
        where.push("a.creator_role = ?");
        params.push(creatorRole);
      }
      if (subjectId) {
        where.push("a.subject_id = ?");
        params.push(Number(subjectId));
      }
      if (phonemicId) {
        where.push("a.phonemic_id = ?");
        params.push(Number(phonemicId));
      }

      let assigneeId = null;
      let assignmentColumn: "teacher_id" | "remedial_role_id" | null = null;
      if (creatorId && creatorRole === 'teacher') {
        const [tRows] = await connection.query("SELECT teacher_id FROM teacher WHERE user_id = ?", [creatorId]);
        if ((tRows as RowDataPacket[]).length > 0) {
          assigneeId = (tRows as RowDataPacket[])[0].teacher_id;
          assignmentColumn = "teacher_id";
        }
      } else if (creatorId && creatorRole === 'remedial_teacher') {
        const [rRows] = await connection.query<RowDataPacket[]>(
          `SELECT rh.remedial_role_id
           FROM mt_remedialteacher_handled rh
           INNER JOIN master_teacher mt ON mt.master_teacher_id = rh.master_teacher_id
           WHERE mt.user_id = ?
           LIMIT 1`,
          [creatorId]
        );
        if (rRows.length > 0) {
          assigneeId = rRows[0].remedial_role_id;
          assignmentColumn = "remedial_role_id";
        }
      }

      console.log(`[AssessmentsAPI] Creator: ${creatorId}, Role: ${creatorRole}, Resolved AssigneeId: ${assigneeId}, AssignmentColumn: ${assignmentColumn}`);

      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const escapedAssigneeId = assigneeId ? connection.escape(assigneeId) : "''";
      const assignmentColumns = await getColumnNames(connection, "student_teacher_assignment").catch(() => new Set<string>());
      const subjectAssessmentColumns = await getColumnNames(connection, "student_subject_assessment").catch(() => new Set<string>());
      const canScopeBySubjectLevel =
        subjectAssessmentColumns.has("student_id") &&
        subjectAssessmentColumns.has("subject_id");
      const canScopeByLatestAssessment = canScopeBySubjectLevel && subjectAssessmentColumns.has("assessed_at");
      const canScopeByPhonemic = canScopeBySubjectLevel && subjectAssessmentColumns.has("phonemic_id");
      const subjectAssignmentFilter = assignmentColumns.has("subject_id")
        ? " AND sta.subject_id = a.subject_id"
        : "";
      const gradeAssignmentFilter = assignmentColumns.has("grade_id")
        ? " AND (a.grade_id IS NULL OR sta.grade_id = a.grade_id)"
        : "";
      const phonemicScopeFilter = canScopeBySubjectLevel
        ? ` AND (a.subject_id IS NULL OR EXISTS (
              SELECT 1
              FROM student_subject_assessment ssa_scope
              WHERE ssa_scope.student_id = sta.student_id
                AND ssa_scope.subject_id = a.subject_id
                ${canScopeByLatestAssessment ? `AND ssa_scope.assessed_at = (
                  SELECT MAX(ssa_latest.assessed_at)
                  FROM student_subject_assessment ssa_latest
                  WHERE ssa_latest.student_id = sta.student_id
                    AND ssa_latest.subject_id = a.subject_id
                )` : ""}
                ${canScopeByPhonemic ? "AND (a.phonemic_id IS NULL OR ssa_scope.phonemic_id = a.phonemic_id)" : ""}
            ))`
        : "";

      const submittedCountQuery = assigneeId && assignmentColumn
        ? `(
            SELECT COUNT(DISTINCT aa.attempt_id)
            FROM assessment_attempts aa
            JOIN student_teacher_assignment sta ON sta.student_id = aa.student_id
            JOIN student s ON s.student_id = sta.student_id
            WHERE aa.assessment_id = a.assessment_id
              AND aa.status IN ('submitted','graded')
              AND sta.${assignmentColumn} = ${escapedAssigneeId}
              AND sta.is_active = 1
              ${subjectAssignmentFilter}
              ${gradeAssignmentFilter}
              ${phonemicScopeFilter}
              AND (aa.student_id = sta.student_id OR (aa.lrn IS NOT NULL AND aa.lrn = s.lrn))
           )`
        : `(
            SELECT COUNT(*)
            FROM assessment_attempts aa
            WHERE aa.assessment_id = a.assessment_id
              AND aa.status IN ('submitted','graded')
           )`;

      const assignedCountQuery = assigneeId && assignmentColumn
        ? `(
            SELECT COUNT(DISTINCT sta.student_id)
            FROM student_teacher_assignment sta
            WHERE sta.${assignmentColumn} = ${escapedAssigneeId}
              AND sta.is_active = 1
              ${subjectAssignmentFilter}
              ${gradeAssignmentFilter}
              ${phonemicScopeFilter}
          )`
        : `0`;

      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
          a.*, 
          pl.level_name AS phonemic_level_name,
          q.question_id,
          q.question_text,
          q.question_type,
          q.points,
          q.question_order,
          q.section_key,
          q.section_title,
          q.section_description,
          q.correct_answer_text,
          c.choice_id,
          c.choice_text,
          c.is_correct,
          ${submittedCountQuery} AS submitted_count,
          ${assignedCountQuery} AS assigned_count
        FROM assessments a
        LEFT JOIN phonemic_level pl ON pl.phonemic_id = a.phonemic_id
        LEFT JOIN assessment_questions q ON q.assessment_id = a.assessment_id
        LEFT JOIN assessment_question_choices c ON c.question_id = q.question_id
        ${whereClause}
        ORDER BY a.assessment_id DESC, q.question_order ASC, c.choice_id ASC`,
        params,
      );

      const assessments = mapAssessmentRows(rows as RowDataPacket[]);

      return NextResponse.json({ success: true, assessments });
    });
  } catch (error) {
    console.error("Failed to load assessments", error);
    return NextResponse.json({ success: false, error: "Failed to load assessments." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AssessmentPayload;

    if (!payload.title?.trim() || !payload.startTime || !payload.endTime) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    if (!payload.createdBy || !payload.creatorRole) {
      return NextResponse.json({ success: false, error: "Missing creator information." }, { status: 400 });
    }

    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      return NextResponse.json({ success: false, error: "At least one question is required." }, { status: 400 });
    }

    if (!isFixedAssessmentStartTime(payload.startTime)) {
      return NextResponse.json(
        { success: false, error: "Assessment start time must be fixed to 8:00 AM on the selected date." },
        { status: 400 },
      );
    }

    if (!isAssessmentRangeWithinLimit(payload.startTime, payload.endTime)) {
      return NextResponse.json(
        { success: false, error: `Assessment end time must be within ${MAX_ASSESSMENT_SPAN_DAYS} days of the start date.` },
        { status: 400 },
      );
    }

    return await runWithConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        await ensureQuestionSectionColumns(connection);
        const subjectId = payload.subjectId ?? (await resolveSubjectId(connection, payload.subjectName));
        const gradeId = payload.gradeId ?? (await resolveGradeId(connection, payload.createdBy, payload.creatorRole));

        if (!gradeId) {
          console.error("Failed to resolve gradeId for:", payload.createdBy);
          return NextResponse.json({ success: false, error: "Unable to determine Grade ID. Please ensure the user is assigned to a grade." }, { status: 400 });
        }

        const phonemicId = payload.phonemicId ?? (await resolvePhonemicId(connection, subjectId ?? null, payload.phonemicLevel));

        const quizCode: string | null = await generateUniqueQuizCode(connection);
        const qrToken: string | null = generateQrToken();
        let qrCodeDataUrl: string | null = null;

        if (payload.isPublished) {
          const accessUrl = buildAccessUrl(quizCode, qrToken);
          qrCodeDataUrl = await generateQrCodeDataUrl(accessUrl);
        }

        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO assessments
            (title, description, subject_id, grade_id, phonemic_id, created_by, creator_role, start_time, end_time, is_published, created_at, updated_at, quiz_code, qr_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)`
          ,
          [
            payload.title.trim(),
            payload.description ?? "",
            subjectId ?? null,
            gradeId ?? null,
            phonemicId ?? null,
            payload.createdBy,
            payload.creatorRole,
            payload.startTime,
            payload.endTime,
            payload.isPublished ? 1 : 0,
            quizCode,
            qrToken,
          ],
        );

        const assessmentId = result.insertId;

        for (let i = 0; i < payload.questions.length; i += 1) {
          const question = payload.questions[i];
          const questionType = normalizeQuestionType(question.questionType);
          const sectionMeta = resolveSectionMetadata(question, payload.sections ?? []);

          const correctAnswerText = questionType === "short_answer"
            ? question.correctAnswerText?.trim() || question.choices?.[0]?.choiceText?.trim() || null
            : null;

          const [questionResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO assessment_questions
              (assessment_id, question_text, question_type, points, question_order, section_key, section_title, section_description, correct_answer_text, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              assessmentId,
              question.questionText,
              questionType,
              question.points ?? 1,
              i + 1,
              sectionMeta.sectionId,
              sectionMeta.sectionTitle,
              sectionMeta.sectionDescription,
              correctAnswerText,
            ],
          );

          const questionId = questionResult.insertId;

          if (questionType !== "short_answer" && Array.isArray(question.choices)) {
            for (const choice of question.choices) {
              await connection.query(
                `INSERT INTO assessment_question_choices
                  (question_id, choice_text, is_correct)
                 VALUES (?, ?, ?)`
                ,
                [questionId, choice.choiceText, choice.isCorrect ? 1 : 0],
              );
            }
          }
        }

        await connection.commit();

        return NextResponse.json({
          success: true,
          assessmentId,
          quizCode,
          qrToken,
          qrCodeDataUrl,
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
  } catch (error) {
    console.error("Failed to create assessment", error);
    return NextResponse.json({ success: false, error: "Failed to create assessment." }, { status: 500 });
  }
}

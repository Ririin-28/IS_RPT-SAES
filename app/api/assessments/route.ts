import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import {
  buildAccessUrl,
  generateQrCodeDataUrl,
  generateQrToken,
  generateUniqueQuizCode,
  normalizeQuestionType,
} from "@/lib/assessments/utils";

export const dynamic = "force-dynamic";

type IncomingChoice = {
  choiceText: string;
  isCorrect?: boolean;
};

type IncomingQuestion = {
  questionText: string;
  questionType: string;
  points: number;
  choices?: IncomingChoice[];
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
  questions: IncomingQuestion[];
};

const resolveSubjectId = async (connection: any, subjectName?: string | null) => {
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
  connection: any,
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

const mapAssessmentRows = (rows: RowDataPacket[]) => {
  const assessments = new Map<number, any>();

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
        questions: [],
      });
    }

    const assessment = assessments.get(assessmentId);
    if (row.question_id) {
      let question = assessment.questions.find((q: any) => q.id === String(row.question_id));
      if (!question) {
        question = {
          id: String(row.question_id),
          type: row.question_type,
          question: row.question_text,
          options: [],
          correctAnswer: "",
          points: Number(row.points ?? 1),
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

      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
          a.*, 
          pl.level_name AS phonemic_level_name,
          q.question_id,
          q.question_text,
          q.question_type,
          q.points,
          q.question_order,
          c.choice_id,
          c.choice_text,
          c.is_correct,
          (
            SELECT COUNT(*)
            FROM assessment_attempts aa
            WHERE aa.assessment_id = a.assessment_id
              AND aa.status IN ('submitted','graded')
          ) AS submitted_count
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

    return await runWithConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        const subjectId = payload.subjectId ?? (await resolveSubjectId(connection, payload.subjectName));
        const phonemicId = payload.phonemicId ?? (await resolvePhonemicId(connection, subjectId ?? null, payload.phonemicLevel));

        let quizCode: string | null = null;
        let qrToken: string | null = null;
        let qrCodeDataUrl: string | null = null;

        if (payload.isPublished) {
          quizCode = await generateUniqueQuizCode(connection);
          qrToken = generateQrToken();
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
            payload.gradeId ?? null,
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
          const [questionResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO assessment_questions
              (assessment_id, question_text, question_type, points, question_order, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [assessmentId, question.questionText, questionType, question.points ?? 1, i + 1],
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

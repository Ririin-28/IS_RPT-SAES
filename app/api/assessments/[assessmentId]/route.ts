import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import {
  buildAccessUrl,
  generateQrCodeDataUrl,
  generateQrToken,
  generateUniqueQuizCode,
  normalizeQuestionType,
} from "../../../../lib/assessments/utils";

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

type UpdatePayload = {
  title: string;
  description?: string;
  subjectId?: number | null;
  subjectName?: string | null;
  gradeId?: number | null;
  phonemicId?: number | null;
  phonemicLevel?: string | null;
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
  const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const baseKey = normalizeKey(phonemicLevel.trim());
  if (!baseKey) return null;

  const candidateKeys = new Set<string>([baseKey]);
  candidateKeys.add(`${baseKey}s`);
  if (baseKey.endsWith("s")) {
    candidateKeys.add(baseKey.slice(0, -1));
  }

  const [rows] = await connection.query(
    "SELECT phonemic_id, level_name FROM phonemic_level WHERE subject_id = ?",
    [subjectId],
  );

  for (const row of rows as RowDataPacket[]) {
    const levelName = typeof row.level_name === "string" ? row.level_name : "";
    const levelKey = normalizeKey(levelName.trim());
    if (candidateKeys.has(levelKey)) {
      return row?.phonemic_id ? Number(row.phonemic_id) : null;
    }
  }

  return null;
};

const mapAssessmentRows = (rows: RowDataPacket[]) => {
  if (rows.length === 0) return null;
  const base = rows[0];
  const assessment = {
    id: Number(base.assessment_id),
    title: base.title,
    description: base.description ?? "",
    subjectId: base.subject_id ?? null,
    gradeId: base.grade_id ?? null,
    phonemicId: base.phonemic_id ?? null,
    phonemicLevel: base.phonemic_level_name ?? null,
    createdBy: base.created_by,
    creatorRole: base.creator_role,
    startDate: base.start_time,
    endDate: base.end_time,
    isPublished: Boolean(base.is_published),
    quizCode: base.quiz_code ?? null,
    qrToken: base.qr_token ?? null,
    submittedCount: Number(base.submitted_count ?? 0),
    questions: [] as any[],
  };

  rows.forEach((row) => {
    if (!row.question_id) return;
    let question = assessment.questions.find((q) => q.id === String(row.question_id));
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
  });

  return assessment;
};

const hasSubmittedAttempts = async (connection: any, assessmentId: number) => {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS total FROM assessment_attempts WHERE assessment_id = ? AND status IN ('submitted','graded')",
    [assessmentId],
  );
  const row = (rows as RowDataPacket[])[0];
  return Number(row?.total ?? 0) > 0;
};

export async function GET(_: NextRequest, props: { params: Promise<{ assessmentId: string }> }) {
  const params = await props.params;
  const assessmentId = Number(params.assessmentId);
  if (!Number.isFinite(assessmentId)) {
    return NextResponse.json({ success: false, error: "Invalid assessment id." }, { status: 400 });
  }

  try {
    return await runWithConnection(async (connection) => {
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
        WHERE a.assessment_id = ?
        ORDER BY q.question_order ASC, c.choice_id ASC`,
        [assessmentId],
      );

      const assessment = mapAssessmentRows(rows as RowDataPacket[]);
      if (!assessment) {
        return NextResponse.json({ success: false, error: "Assessment not found." }, { status: 404 });
      }

      return NextResponse.json({ success: true, assessment });
    });
  } catch (error) {
    console.error("Failed to fetch assessment", error);
    return NextResponse.json({ success: false, error: "Failed to fetch assessment." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ assessmentId: string }> }) {
  const params = await props.params;
  const assessmentId = Number(params.assessmentId);
  if (!Number.isFinite(assessmentId)) {
    return NextResponse.json({ success: false, error: "Invalid assessment id." }, { status: 400 });
  }

  try {
    const payload = (await request.json()) as UpdatePayload;

    if (!payload.title?.trim() || !payload.startTime || !payload.endTime) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      return NextResponse.json({ success: false, error: "At least one question is required." }, { status: 400 });
    }

    return await runWithConnection(async (connection) => {
      const hasSubmissions = await hasSubmittedAttempts(connection, assessmentId);
      if (hasSubmissions) {
        return NextResponse.json(
          { success: false, error: "Assessment already has submitted attempts." },
          { status: 409 },
        );
      }

      await connection.beginTransaction();
      try {
        const [[current]] = await connection.query<RowDataPacket[]>(
          "SELECT quiz_code, qr_token FROM assessments WHERE assessment_id = ? LIMIT 1",
          [assessmentId],
        );
        let quizCode = current?.quiz_code ?? null;
        let qrToken = current?.qr_token ?? null;
        let qrCodeDataUrl: string | null = null;

        if (payload.isPublished && !quizCode) {
          quizCode = await generateUniqueQuizCode(connection);
          qrToken = generateQrToken();
          const accessUrl = buildAccessUrl(quizCode, qrToken);
          qrCodeDataUrl = await generateQrCodeDataUrl(accessUrl);
        }

        const resolvedSubjectId = payload.subjectId ?? (await resolveSubjectId(connection, payload.subjectName));
        const resolvedPhonemicId = payload.phonemicId ?? (await resolvePhonemicId(connection, resolvedSubjectId ?? null, payload.phonemicLevel));

        await connection.query(
          `UPDATE assessments
           SET title = ?, description = ?, subject_id = ?, grade_id = ?, phonemic_id = ?, start_time = ?, end_time = ?, is_published = ?, updated_at = NOW(), quiz_code = ?, qr_token = ?
           WHERE assessment_id = ?`,
          [
            payload.title.trim(),
            payload.description ?? "",
            resolvedSubjectId ?? null,
            payload.gradeId ?? null,
            resolvedPhonemicId ?? null,
            payload.startTime,
            payload.endTime,
            payload.isPublished ? 1 : 0,
            quizCode,
            qrToken,
            assessmentId,
          ],
        );

        await connection.query(
          "DELETE FROM assessment_question_choices WHERE question_id IN (SELECT question_id FROM assessment_questions WHERE assessment_id = ?)",
          [assessmentId],
        );
        await connection.query("DELETE FROM assessment_questions WHERE assessment_id = ?", [assessmentId]);

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
    console.error("Failed to update assessment", error);
    return NextResponse.json({ success: false, error: "Failed to update assessment." }, { status: 500 });
  }
}

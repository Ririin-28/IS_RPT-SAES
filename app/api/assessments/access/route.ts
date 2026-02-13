import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

type AccessPayload = {
  quizCode: string;
  qrToken?: string | null;
  studentId: string;
};

const pad = (value: number) => value.toString().padStart(2, "0");

const toLocalDateTimeString = (value: unknown): string | null => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = trimmed.replace(" ", "T");
    const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
    if (directMatch) {
      return `${directMatch[1]}T${directMatch[2]}:${directMatch[3] ?? "00"}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
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
    startDate: toLocalDateTimeString(base.start_time) ?? "",
    endDate: toLocalDateTimeString(base.end_time) ?? "",
    questions: [] as any[],
  };

  rows.forEach((row) => {
    if (!row.question_id) return;
    let question = assessment.questions.find((q) => q.id === Number(row.question_id));
    if (!question) {
      question = {
        id: Number(row.question_id),
        type: row.question_type,
        questionText: row.question_text,
        points: Number(row.points ?? 1),
        choices: [] as any[],
      };
      assessment.questions.push(question);
    }

    if (row.choice_id) {
      question.choices.push({
        id: Number(row.choice_id),
        text: row.choice_text,
      });
    }
  });

  return assessment;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as AccessPayload;
    const quizCode = payload.quizCode?.trim().toUpperCase();
    const lrn = payload.studentId?.trim();

    if (!quizCode || !lrn) {
      return NextResponse.json({ success: false, error: "Quiz code and student id are required." }, { status: 400 });
    }

    return await runWithConnection(async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT
          a.assessment_id,
          a.title,
          a.description,
          a.subject_id,
          a.phonemic_id,
          a.start_time,
          a.end_time,
          a.quiz_code,
          a.qr_token,
          a.is_published,
          q.question_id,
          q.question_text,
          q.question_type,
          q.points,
          q.question_order,
          c.choice_id,
          c.choice_text
        FROM assessments a
        LEFT JOIN assessment_questions q ON q.assessment_id = a.assessment_id
        LEFT JOIN assessment_question_choices c ON c.question_id = q.question_id
        WHERE a.quiz_code = ?
        ORDER BY q.question_order ASC, c.choice_id ASC`,
        [quizCode],
      );

      if (rows.length === 0) {
        return NextResponse.json({ success: false, error: "Quiz not found." }, { status: 404 });
      }

      const assessmentRow = rows[0];
      if (!assessmentRow.is_published) {
        return NextResponse.json({ success: false, error: "Quiz is not published." }, { status: 403 });
      }

      if (payload.qrToken && payload.qrToken !== assessmentRow.qr_token) {
        return NextResponse.json({ success: false, error: "Invalid QR token." }, { status: 403 });
      }

      const now = new Date();
      if (assessmentRow.start_time && assessmentRow.end_time) {
        const startTimeText = toLocalDateTimeString(assessmentRow.start_time);
        const endTimeText = toLocalDateTimeString(assessmentRow.end_time);
        const startTime = startTimeText ? new Date(startTimeText) : null;
        const endTime = endTimeText ? new Date(endTimeText) : null;
        if (!startTime || !endTime || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
          return NextResponse.json({ success: false, error: "Quiz schedule is invalid." }, { status: 500 });
        }
        if (now < startTime || now > endTime) {
          return NextResponse.json({ success: false, error: "Quiz is not available at this time." }, { status: 403 });
        }
      }

      const assessmentId = Number(assessmentRow.assessment_id);

      const [studentRows] = await connection.query<RowDataPacket[]>(
        "SELECT student_id, lrn, first_name, middle_name, last_name FROM student WHERE lrn = ? LIMIT 2",
        [lrn],
      );

      if (studentRows.length === 0) {
        return NextResponse.json({ success: false, error: "Student LRN not found." }, { status: 404 });
      }

      if (studentRows.length > 1) {
        return NextResponse.json({ success: false, error: "Duplicate LRN detected. Please contact your teacher." }, { status: 409 });
      }

      const student = studentRows[0];
      const studentId = String(student.student_id);
      const studentName = [student.first_name, student.middle_name, student.last_name]
        .filter((part) => typeof part === "string" && part.trim().length > 0)
        .join(" ");

      const assessmentSubjectId = Number(assessmentRow.subject_id ?? 0);
      const assessmentPhonemicId = Number(assessmentRow.phonemic_id ?? 0);

      if (assessmentSubjectId > 0 && assessmentPhonemicId > 0) {
        const [studentAssessmentRows] = await connection.query<RowDataPacket[]>(
          `SELECT ssa.phonemic_id
           FROM student_subject_assessment ssa
           WHERE ssa.student_id = ? AND ssa.subject_id = ?
           LIMIT 1`,
          [studentId, assessmentSubjectId],
        );

        const studentPhonemicId = Number(studentAssessmentRows[0]?.phonemic_id ?? 0);

        if (!studentPhonemicId) {
          return NextResponse.json(
            { success: false, error: "Student has no phonemic level record for this subject." },
            { status: 403 },
          );
        }

        if (studentPhonemicId !== assessmentPhonemicId) {
          return NextResponse.json(
            { success: false, error: "This assessment is not assigned to your phonemic level." },
            { status: 403 },
          );
        }
      }

      const [attemptRows] = await connection.query<RowDataPacket[]>(
        "SELECT attempt_id, status FROM assessment_attempts WHERE assessment_id = ? AND (student_id = ? OR lrn = ?) ORDER BY attempt_id DESC LIMIT 1",
        [assessmentId, studentId, lrn],
      );

      if (attemptRows.length > 0) {
        const existing = attemptRows[0];
        if (existing.status === "submitted" || existing.status === "graded") {
          return NextResponse.json({ success: false, error: "You already submitted this quiz." }, { status: 409 });
        }

        const assessment = mapAssessmentRows(rows as RowDataPacket[]);
        return NextResponse.json({
          success: true,
          assessment,
          attemptId: existing.attempt_id,
          status: existing.status,
          student: {
            name: studentName,
            lrn: student.lrn,
          },
        });
      }

      const [result] = await connection.query<ResultSetHeader>(
        "INSERT INTO assessment_attempts (assessment_id, student_id, lrn, started_at, status) VALUES (?, ?, ?, NOW(), 'in_progress')",
        [assessmentId, studentId, lrn],
      );

      const assessment = mapAssessmentRows(rows as RowDataPacket[]);

      return NextResponse.json({
        success: true,
        assessment,
        attemptId: result.insertId,
        status: "in_progress",
        student: {
          name: studentName,
          lrn: student.lrn,
        },
      });
    });
  } catch (error) {
    console.error("Failed to access quiz", error);
    return NextResponse.json({ success: false, error: "Failed to access quiz." }, { status: 500 });
  }
}

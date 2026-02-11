import { type NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { ensurePerformanceSchema } from "@/lib/performance/schema";

type SlidePerformance = {
  flashcardIndex: number;
  expectedText?: string | null;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  readingSpeedWpm: number;
  slideAverage: number;
  transcription?: string | null;
};

type SaveRemedialSessionPayload = {
  studentId: number | string;
  approvedScheduleId: number | string;
  subjectId: number | string;
  gradeId: number | string;
  phonemicId: number | string | null;
  materialId: number | string | null;
  masteryThreshold?: number | null;
  completed?: boolean | null;
  slides: SlidePerformance[];
  teacherFeedback?: string | null;
};

const DEFAULT_MASTERY_THRESHOLD = 80;

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringId(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function average(values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((acc, item) => acc + item, 0);
  return Math.round(sum / Math.max(1, values.length));
}

function buildAiRemarks(args: {
  studentName?: string | null;
  pronunciationAvg: number;
  accuracyAvg: number;
  readingSpeedAvg: number;
}): string {
  const name = args.studentName?.trim() || "The student";
  const weaknesses: string[] = [];
  const strengths: string[] = [];

  if (args.pronunciationAvg < 75) weaknesses.push("pronouncing words clearly");
  if (args.accuracyAvg < 75) weaknesses.push("getting words right");
  if (args.readingSpeedAvg < 60) weaknesses.push("reading pace");

  if (args.pronunciationAvg >= 85) strengths.push("clear pronunciation");
  if (args.accuracyAvg >= 85) strengths.push("good accuracy");
  if (args.readingSpeedAvg >= 85) strengths.push("fast reading pace");

  const recommendations: string[] = [];
  if (args.pronunciationAvg < 75) recommendations.push("practice saying the words out loud with short echo reading");
  if (args.correctnessAvg < 75) recommendations.push("repeat the target word set three times a week");
  if (args.readingSpeedAvg < 60) recommendations.push("add short timed reading drills twice a week");
  if (!recommendations.length) {
    recommendations.push("keep a steady practice routine 2–3 times a week");
  }

  const joinList = (items: string[]) => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  };

  const weaknessText = weaknesses.length
    ? `${name} is having difficulty with ${joinList(weaknesses)}.`
    : `${name} shows no major weaknesses in this session.`;
  const strengthText = strengths.length
    ? `Strengths include ${joinList(strengths)}.`
    : "Strengths are still building as more data is collected.";
  const recommendationText = `Recommended next steps: ${joinList(recommendations)}.`;

  return `${weaknessText} ${strengthText} ${recommendationText}`;
}

export async function POST(request: NextRequest) {
  try {
    await ensurePerformanceSchema();
    const payload = (await request.json().catch(() => null)) as SaveRemedialSessionPayload | null;
    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }

    const studentId = toStringId(payload.studentId);
    const approvedScheduleId = toNumber(payload.approvedScheduleId);
    const subjectId = toNumber(payload.subjectId);
    const gradeId = toNumber(payload.gradeId);
    const phonemicId = toNumber(payload.phonemicId ?? null);
    const materialId = toNumber(payload.materialId ?? null);
    const masteryThreshold = toNumber(payload.masteryThreshold ?? null) ?? DEFAULT_MASTERY_THRESHOLD;
    const completed = Boolean(payload.completed);
    const slides = Array.isArray(payload.slides) ? payload.slides : [];
    const teacherFeedback = normalizeText(payload.teacherFeedback);

    if (!studentId || !approvedScheduleId || !subjectId || !gradeId) {
      return NextResponse.json({ success: false, error: "Missing required identifiers." }, { status: 400 });
    }
    if (!slides.length) {
      return NextResponse.json({ success: false, error: "At least one slide performance is required." }, { status: 400 });
    }
    if (completed && !teacherFeedback) {
      return NextResponse.json({ success: false, error: "Teacher feedback is required." }, { status: 400 });
    }

    const validatedSlides = slides
      .map((slide, index) => ({
        index,
        flashcardIndex: toNumber(slide.flashcardIndex),
        expectedText: typeof slide.expectedText === "string" ? slide.expectedText : null,
        pronunciationScore: toNumber(slide.pronunciationScore),
        accuracyScore: toNumber(slide.accuracyScore),
        fluencyScore: toNumber(slide.fluencyScore),
        completenessScore: toNumber(slide.completenessScore),
        readingSpeedWpm: toNumber(slide.readingSpeedWpm),
        slideAverage: toNumber(slide.slideAverage),
        transcription: typeof slide.transcription === "string" ? slide.transcription : null,
      }))
      .filter((slide) =>
        slide.flashcardIndex !== null &&
        slide.pronunciationScore !== null &&
        slide.accuracyScore !== null &&
        slide.fluencyScore !== null &&
        slide.completenessScore !== null &&
        slide.readingSpeedWpm !== null &&
        slide.slideAverage !== null,
      );

    if (validatedSlides.length !== slides.length) {
      return NextResponse.json({ success: false, error: "Slide performance data is incomplete." }, { status: 400 });
    }

    const overallAverage = average(validatedSlides.map((slide) => slide.slideAverage as number));
    const pronunciationAvg = average(validatedSlides.map((slide) => slide.pronunciationScore as number));
    const accuracyAvg = average(validatedSlides.map((slide) => slide.accuracyScore as number));
    const readingSpeedAvg = average(validatedSlides.map((slide) => slide.readingSpeedWpm as number));

    const result = await runWithConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        const [scheduleRows] = await connection.query<RowDataPacket[]>(
          "SELECT request_id, title, schedule_date FROM approved_remedial_schedule WHERE request_id = ? LIMIT 1",
          [approvedScheduleId],
        );
        if (!scheduleRows.length) {
          await connection.rollback();
          return { status: 404, payload: { success: false, error: "Approved schedule not found." } };
        }

        const [existingRows] = await connection.query<RowDataPacket[]>(
          "SELECT session_id FROM student_remedial_session WHERE student_id = ? AND approved_schedule_id = ? LIMIT 1",
          [studentId, approvedScheduleId],
        );

        let sessionId = existingRows.length ? Number(existingRows[0].session_id) : null;
        if (!sessionId) {
          const [sessionInsert] = await connection.query<RowDataPacket[]>(
            `INSERT INTO student_remedial_session
             (student_id, approved_schedule_id, subject_id, grade_id, phonemic_id, material_id)
             VALUES (?, ?, ?, ?, ?, ?)` ,
            [studentId, approvedScheduleId, subjectId, gradeId, phonemicId, materialId],
          );
          sessionId = Number((sessionInsert as unknown as { insertId?: number }).insertId);
        }

        if (!Number.isFinite(sessionId) || (sessionId as number) <= 0) {
          throw new Error("Failed to create remedial session.");
        }

        await connection.query(
          "DELETE FROM student_remedial_flashcard_performance WHERE session_id = ?",
          [sessionId],
        );

        const performanceValues: Array<
          [number, number, string | null, number, number, number, number, number, number, string | null]
        > = validatedSlides.map((slide) => [
          sessionId,
          slide.flashcardIndex as number,
          slide.expectedText ?? null,
          slide.pronunciationScore as number,
          slide.accuracyScore as number,
          slide.fluencyScore as number,
          slide.completenessScore as number,
          slide.readingSpeedWpm as number,
          slide.slideAverage as number,
          slide.transcription,
        ]);

        const placeholders = performanceValues.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        await connection.query(
          `INSERT INTO student_remedial_flashcard_performance
           (session_id, flashcard_index, expected_text, pronunciation_score, accuracy_score, fluency_score, completeness_score, reading_speed_wpm, slide_average, transcription)
           VALUES ${placeholders}`,
          performanceValues.flat(),
        );

        const aiRemarks = buildAiRemarks({
          pronunciationAvg,
          accuracyAvg,
          readingSpeedAvg,
        });

        await connection.query(
          `UPDATE student_remedial_session
           SET overall_average = ?,
               ai_remarks = ?,
               completed_at = ?,
               subject_id = ?,
               grade_id = ?,
               phonemic_id = ?,
               material_id = ?
           WHERE session_id = ?`,
          [
            overallAverage,
            aiRemarks,
            completed ? new Date() : null,
            subjectId,
            gradeId,
            phonemicId,
            materialId,
            sessionId,
          ],
        );

        const [subjectRows] = await connection.query<RowDataPacket[]>(
          "SELECT subject_name FROM subject WHERE subject_id = ? LIMIT 1",
          [subjectId],
        );
        const subjectName = typeof subjectRows[0]?.subject_name === "string"
          ? subjectRows[0].subject_name
          : "Remedial";
        const scheduleTitle = typeof scheduleRows[0]?.title === "string"
          ? scheduleRows[0].title
          : "Remedial Session";
        const scheduleDate = scheduleRows[0]?.schedule_date ?? new Date();

        const [activityRows] = await connection.query<RowDataPacket[]>(
          `SELECT activity_id FROM activities
           WHERE type = ? AND subject = ? AND title = ? AND DATE(date) = DATE(?)
           LIMIT 1`,
          ["remedial", subjectName, scheduleTitle, scheduleDate],
        );
        let activityId = activityRows.length ? Number(activityRows[0].activity_id) : null;

        if (!activityId) {
          const [activityInsert] = await connection.query<RowDataPacket[]>(
            `INSERT INTO activities (type, subject, title, description, date)
             VALUES (?, ?, ?, ?, ?)` ,
            [
              "remedial",
              subjectName,
              scheduleTitle,
              `Remedial flashcards session for ${subjectName}.`,
              scheduleDate,
            ],
          );
          activityId = Number((activityInsert as unknown as { insertId?: number }).insertId);
        }

        if (Number.isFinite(activityId) && (activityId as number) > 0) {
          const metadata = {
            approvedScheduleId,
            subjectId,
            gradeId,
            phonemicId,
            materialId,
            sessionId,
          };
          const [recordRows] = await connection.query<RowDataPacket[]>(
            `SELECT record_id FROM performance_records WHERE student_id = ? AND activity_id = ?
             ORDER BY record_id DESC LIMIT 1`,
            [studentId, activityId],
          );
          let recordId = recordRows.length ? Number(recordRows[0].record_id) : null;

          if (!recordId) {
            const [recordInsert] = await connection.query<RowDataPacket[]>(
              `INSERT INTO performance_records (student_id, activity_id, score, total_items, grade, metadata, completed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)` ,
              [
                studentId,
                activityId,
                overallAverage,
                validatedSlides.length,
                null,
                JSON.stringify(metadata),
                completed ? new Date() : null,
              ],
            );
            recordId = Number((recordInsert as unknown as { insertId?: number }).insertId);
          } else {
            await connection.query(
              `UPDATE performance_records
               SET score = ?, total_items = ?, grade = ?, metadata = ?, completed_at = ?
               WHERE record_id = ?`,
              [
                overallAverage,
                validatedSlides.length,
                null,
                JSON.stringify(metadata),
                completed ? new Date() : null,
                recordId,
              ],
            );
          }

          if (recordId && teacherFeedback) {
            const [remarkRows] = await connection.query<RowDataPacket[]>(
              `SELECT remark_id FROM remarks WHERE performance_record_id = ? LIMIT 1`,
              [recordId],
            );

            if (remarkRows.length) {
              await connection.query(
                `UPDATE remarks SET content = ?, teacher_notes = ? WHERE performance_record_id = ?`,
                [aiRemarks, teacherFeedback, recordId],
              );
            } else {
              await connection.query(
                `INSERT INTO remarks (performance_record_id, content, teacher_notes)
                 VALUES (?, ?, ?)` ,
                [recordId, aiRemarks, teacherFeedback],
              );
            }
          }
        }

        if (completed && overallAverage >= masteryThreshold && phonemicId) {
          const [historyRows] = await connection.query<RowDataPacket[]>(
            `SELECT history_id FROM student_phonemic_history
             WHERE student_id = ? AND subject_id = ? AND phonemic_id = ?
             LIMIT 1`,
            [studentId, subjectId, phonemicId],
          );
          if (!historyRows.length) {
            await connection.query(
              `INSERT INTO student_phonemic_history (student_id, subject_id, phonemic_id, achieved_at)
               VALUES (?, ?, ?, NOW())`,
              [studentId, subjectId, phonemicId],
            );
          }
        }

        await connection.commit();

        return {
          status: 200,
          payload: {
            success: true,
            sessionId,
            overallAverage,
            aiRemarks,
            completed,
          },
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error("Failed to save remedial session", error);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = toStringId(searchParams.get("studentId"));
    const approvedScheduleId = toNumber(searchParams.get("approvedScheduleId"));

    if (!studentId || !approvedScheduleId) {
      return NextResponse.json({ success: false, error: "Missing required identifiers." }, { status: 400 });
    }

    const result = await runWithConnection(async (connection) => {
      const [sessionRows] = await connection.query<RowDataPacket[]>(
        `SELECT session_id, overall_average, ai_remarks, completed_at
         FROM student_remedial_session
         WHERE student_id = ? AND approved_schedule_id = ?
         LIMIT 1`,
        [studentId, approvedScheduleId],
      );

      if (!sessionRows.length) {
        return { status: 200, payload: { success: true, found: false } };
      }

      const session = sessionRows[0];
      const sessionId = Number(session.session_id);

      const [slideRows] = await connection.query<RowDataPacket[]>(
        `SELECT flashcard_index, expected_text, pronunciation_score, accuracy_score, fluency_score,
                completeness_score, reading_speed_wpm, slide_average, transcription
         FROM student_remedial_flashcard_performance
         WHERE session_id = ?
         ORDER BY flashcard_index ASC`,
        [sessionId],
      );

      return {
        status: 200,
        payload: {
          success: true,
          found: true,
          session: {
            sessionId,
            overallAverage: Number(session.overall_average) || 0,
            aiRemarks: session.ai_remarks ?? null,
            completedAt: session.completed_at ?? null,
          },
          slides: slideRows.map((row) => ({
            flashcardIndex: Number(row.flashcard_index),
            expectedText: row.expected_text ?? null,
            pronunciationScore: Number(row.pronunciation_score) || 0,
            accuracyScore: Number(row.accuracy_score) || 0,
            fluencyScore: Number(row.fluency_score) || 0,
            completenessScore: Number(row.completeness_score) || 0,
            readingSpeedWpm: Number(row.reading_speed_wpm) || 0,
            slideAverage: Number(row.slide_average) || 0,
            transcription: row.transcription ?? null,
          })),
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error("Failed to load remedial session progress", error);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}

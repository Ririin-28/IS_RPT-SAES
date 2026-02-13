import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { generateQrToken, generateUniqueQuizCode, normalizeQuestionType } from "@/lib/assessments/utils";

export interface AssessmentFilter {
  creatorId?: string;
  creatorRole?: string;
  subjectId?: string;
  subjectName?: string;
  phonemicId?: string;
}

export interface IncomingChoice {
  choiceText: string;
  isCorrect?: boolean;
}

export interface IncomingQuestion {
  questionText: string;
  questionType: string;
  points: number;
  choices?: IncomingChoice[];
  correctAnswerText?: string;
  sectionId?: string;
  sectionTitle?: string;
  sectionDescription?: string;
}

export interface IncomingSection {
  id?: string;
  title: string;
  description?: string;
}

export interface AssessmentPayload {
  title: string;
  description?: string;
  subjectId?: number | null;
  subjectName?: string | null;
  gradeId?: number | null;
  phonemicId?: number | null;
  phonemicLevel?: string | null;
  createdBy?: string;
  creatorRole?: "teacher" | "remedial_teacher";
  startTime: string;
  endTime: string;
  isPublished: boolean;
  questions: IncomingQuestion[];
  sections?: IncomingSection[];
}

type AssessmentRow = RowDataPacket & {
  assessment_id: number;
  title: string;
  description: string | null;
  subject_id: number | null;
  subject_name: string | null;
  grade_id: number | null;
  phonemic_id: number | null;
  phonemic_level_name: string | null;
  created_by: string;
  creator_role: string;
  start_time: Date | string;
  end_time: Date | string;
  is_published: number | boolean;
  created_at: Date | string;
  updated_at: Date | string;
  quiz_code: string | null;
  qr_token: string | null;
  submitted_count: number;
  assigned_count: number;
};

type QuestionRow = RowDataPacket & {
  question_id: number;
  assessment_id: number;
  question_text: string;
  question_type: string;
  points: number;
  question_order: number;
  correct_answer_text: string | null;
  section_key?: string | null;
  section_title?: string | null;
  section_description?: string | null;
};

type ChoiceRow = RowDataPacket & {
  choice_id: number;
  question_id: number;
  choice_text: string;
  is_correct: number | boolean;
};

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const parseMySqlDateTime = (value: string): string | null => {
  if (!value || typeof value !== "string") return null;
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19).replace("T", " ");
};

const resolveSectionMetadata = (question: IncomingQuestion, sections: IncomingSection[] = []) => {
  const byId = new Map<string, IncomingSection>();
  sections.forEach((section) => {
    if (section.id) {
      byId.set(section.id, section);
    }
  });

  const section = question.sectionId ? byId.get(question.sectionId) : undefined;
  return {
    sectionId: question.sectionId ?? null,
    sectionTitle: (section?.title ?? question.sectionTitle ?? "").trim() || null,
    sectionDescription: (section?.description ?? question.sectionDescription ?? "").trim() || null,
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

const resolveSubjectId = async (
  connection: PoolConnection,
  subjectId?: number | null,
  subjectName?: string | null
) => {
  if (subjectId) return subjectId;
  if (!subjectName) return null;

  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT subject_id FROM subject WHERE LOWER(subject_name) = LOWER(?) LIMIT 1",
    [subjectName.trim()]
  );

  if (rows.length > 0) {
    return Number(rows[0].subject_id);
  }

  const [inserted] = await connection.query<ResultSetHeader>(
    "INSERT INTO subject (subject_name) VALUES (?)",
    [subjectName.trim()]
  );
  return inserted.insertId;
};

const resolvePhonemicId = async (
  connection: PoolConnection,
  subjectId: number | null,
  phonemicId?: number | null,
  phonemicLevel?: string | null
) => {
  if (phonemicId) return phonemicId;
  if (!subjectId || !phonemicLevel) return null;

  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT phonemic_id FROM phonemic_level WHERE subject_id = ? AND LOWER(level_name) = LOWER(?) LIMIT 1",
    [subjectId, phonemicLevel.trim()]
  );

  if (rows.length > 0) {
    return Number(rows[0].phonemic_id);
  }

  const [inserted] = await connection.query<ResultSetHeader>(
    "INSERT INTO phonemic_level (subject_id, level_name) VALUES (?, ?)",
    [subjectId, phonemicLevel.trim()]
  );
  return inserted.insertId;
};

const resolveGradeId = async (
  connection: PoolConnection,
  options: {
    gradeId?: number | null;
    createdBy?: string | null;
    creatorRole?: "teacher" | "remedial_teacher" | string | null;
    fallbackGradeId?: number | null;
  }
) => {
  if (options.gradeId != null) {
    return Number(options.gradeId);
  }

  const role = options.creatorRole ?? "teacher";
  const creatorRaw = (options.createdBy ?? "").trim();
  const creatorAsUserId = Number(creatorRaw);

  if (role === "teacher") {
    if (creatorRaw) {
      const [byTeacherId] = await connection.query<RowDataPacket[]>(
        `SELECT th.grade_id
         FROM teacher_handled th
         WHERE th.teacher_id = ?
         ORDER BY th.grade_id ASC
         LIMIT 1`,
        [creatorRaw]
      );
      if (byTeacherId.length > 0) {
        return Number(byTeacherId[0].grade_id);
      }
    }

    if (Number.isFinite(creatorAsUserId)) {
      const [byUserId] = await connection.query<RowDataPacket[]>(
        `SELECT th.grade_id
         FROM teacher t
         INNER JOIN teacher_handled th ON th.teacher_id = t.teacher_id
         WHERE t.user_id = ?
         ORDER BY th.grade_id ASC
         LIMIT 1`,
        [creatorAsUserId]
      );
      if (byUserId.length > 0) {
        return Number(byUserId[0].grade_id);
      }
    }
  }

  if (role === "remedial_teacher") {
    if (creatorRaw) {
      const [byMasterTeacherId] = await connection.query<RowDataPacket[]>(
        `SELECT mrh.grade_id
         FROM mt_remedialteacher_handled mrh
         WHERE mrh.master_teacher_id = ?
         ORDER BY mrh.grade_id ASC
         LIMIT 1`,
        [creatorRaw]
      );
      if (byMasterTeacherId.length > 0) {
        return Number(byMasterTeacherId[0].grade_id);
      }
    }

    if (Number.isFinite(creatorAsUserId)) {
      const [byUserId] = await connection.query<RowDataPacket[]>(
        `SELECT mrh.grade_id
         FROM master_teacher mt
         INNER JOIN mt_remedialteacher_handled mrh ON mrh.master_teacher_id = mt.master_teacher_id
         WHERE mt.user_id = ?
         ORDER BY mrh.grade_id ASC
         LIMIT 1`,
        [creatorAsUserId]
      );
      if (byUserId.length > 0) {
        return Number(byUserId[0].grade_id);
      }
    }
  }

  if (options.fallbackGradeId != null) {
    return Number(options.fallbackGradeId);
  }

  const [defaultGrade] = await connection.query<RowDataPacket[]>(
    "SELECT grade_id FROM grade ORDER BY grade_id ASC LIMIT 1"
  );
  if (defaultGrade.length > 0) {
    return Number(defaultGrade[0].grade_id);
  }

  throw new Error("No grade mapping found for this user. Please assign a grade first.");
};

const insertQuestionWithChoices = async (
  connection: PoolConnection,
  assessmentId: number,
  question: IncomingQuestion,
  order: number,
  sections: IncomingSection[] = []
) => {
  const sectionMeta = resolveSectionMetadata(question, sections);
  const normalizedType = normalizeQuestionType(question.questionType);

  const [questionResult] = await connection.query<ResultSetHeader>(
    `INSERT INTO assessment_questions (
      assessment_id,
      question_text,
      question_type,
      points,
      question_order,
      correct_answer_text,
      section_key,
      section_title,
      section_description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assessmentId,
      question.questionText,
      normalizedType,
      Number(question.points || 1),
      order,
      question.correctAnswerText ?? null,
      sectionMeta.sectionId,
      sectionMeta.sectionTitle,
      sectionMeta.sectionDescription,
    ]
  );

  if (!question.choices?.length) {
    return;
  }

  for (const choice of question.choices) {
    await connection.query(
      "INSERT INTO assessment_question_choices (question_id, choice_text, is_correct) VALUES (?, ?, ?)",
      [questionResult.insertId, choice.choiceText, choice.isCorrect ? 1 : 0]
    );
  }
};

export async function listAssessments(filters: AssessmentFilter) {
  return runWithConnection(async (connection) => {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.creatorId) {
      where.push("a.created_by = ?");
      params.push(filters.creatorId);
    }
    if (filters.creatorRole) {
      where.push("a.creator_role = ?");
      params.push(filters.creatorRole);
    }
    if (filters.subjectId) {
      where.push("a.subject_id = ?");
      params.push(Number(filters.subjectId));
    }
    if (filters.subjectName) {
      where.push("LOWER(s.subject_name) = LOWER(?)");
      params.push(filters.subjectName);
    }
    if (filters.phonemicId) {
      where.push("a.phonemic_id = ?");
      params.push(Number(filters.phonemicId));
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [assessments] = await connection.query<AssessmentRow[]>(
      `SELECT
        a.assessment_id,
        a.title,
        a.description,
        a.subject_id,
        s.subject_name,
        a.grade_id,
        a.phonemic_id,
        p.level_name AS phonemic_level_name,
        a.created_by,
        a.creator_role,
        a.start_time,
        a.end_time,
        a.is_published,
        a.created_at,
        a.updated_at,
        a.quiz_code,
        a.qr_token,
        COALESCE(submitted.submitted_count, 0) AS submitted_count,
        COALESCE(assigned.assigned_count, 0) AS assigned_count
      FROM assessments a
      LEFT JOIN subject s ON s.subject_id = a.subject_id
      LEFT JOIN phonemic_level p ON p.phonemic_id = a.phonemic_id
      LEFT JOIN (
        SELECT assessment_id, COUNT(*) AS submitted_count
        FROM assessment_attempts
        WHERE status = 'submitted'
        GROUP BY assessment_id
      ) submitted ON submitted.assessment_id = a.assessment_id
      LEFT JOIN (
        SELECT assessment_id, COUNT(*) AS assigned_count
        FROM assessment_attempts
        GROUP BY assessment_id
      ) assigned ON assigned.assessment_id = a.assessment_id
      ${whereClause}
      ORDER BY a.created_at DESC`,
      params
    );

    if (assessments.length === 0) {
      return [];
    }

    const assessmentIds = assessments.map((item) => item.assessment_id);
    const placeholders = assessmentIds.map(() => "?").join(", ");

    const [questionColumns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM `assessment_questions`");
    const availableColumns = new Set(questionColumns.map((column) => String(column.Field)));

    const hasSectionColumns =
      availableColumns.has("section_key") &&
      availableColumns.has("section_title") &&
      availableColumns.has("section_description");

    const [questions] = await connection.query<QuestionRow[]>(
      `SELECT
        question_id,
        assessment_id,
        question_text,
        question_type,
        points,
        question_order,
        correct_answer_text
        ${hasSectionColumns ? ", section_key, section_title, section_description" : ""}
      FROM assessment_questions
      WHERE assessment_id IN (${placeholders})
      ORDER BY assessment_id ASC, question_order ASC`,
      assessmentIds
    );

    const questionIds = questions.map((item) => item.question_id);
    const choicesByQuestion = new Map<number, ChoiceRow[]>();

    if (questionIds.length > 0) {
      const choicePlaceholders = questionIds.map(() => "?").join(", ");
      const [choices] = await connection.query<ChoiceRow[]>(
        `SELECT choice_id, question_id, choice_text, is_correct
         FROM assessment_question_choices
         WHERE question_id IN (${choicePlaceholders})
         ORDER BY choice_id ASC`,
        questionIds
      );

      choices.forEach((choice) => {
        const list = choicesByQuestion.get(choice.question_id) ?? [];
        list.push(choice);
        choicesByQuestion.set(choice.question_id, list);
      });
    }

    const questionsByAssessment = new Map<number, any[]>();
    const sectionsByAssessment = new Map<number, Array<{ id: string; title: string; description: string }>>();
    const sectionSeenByAssessment = new Map<number, Set<string>>();

    questions.forEach((question) => {
      const list = questionsByAssessment.get(question.assessment_id) ?? [];
      const mappedChoices = (choicesByQuestion.get(question.question_id) ?? []).map((choice) => ({
        id: choice.choice_id,
        text: choice.choice_text,
        isCorrect: Boolean(choice.is_correct),
      }));

      list.push({
        id: question.question_id,
        question: question.question_text,
        type: question.question_type,
        points: Number(question.points ?? 1),
        questionOrder: Number(question.question_order ?? 0),
        correctAnswer: question.correct_answer_text ?? "",
        options: mappedChoices.map((choice) => choice.text),
        choices: mappedChoices,
        sectionId: hasSectionColumns ? question.section_key ?? undefined : undefined,
        sectionTitle: hasSectionColumns ? question.section_title ?? undefined : undefined,
        sectionDescription: hasSectionColumns ? question.section_description ?? undefined : undefined,
      });

      questionsByAssessment.set(question.assessment_id, list);

      if (hasSectionColumns) {
        const sectionId = String(question.section_key ?? "").trim();
        const sectionTitle = String(question.section_title ?? "").trim();
        if (sectionId && sectionTitle) {
          const sectionKey = `${sectionId}::${sectionTitle.toLowerCase()}`;
          const seen = sectionSeenByAssessment.get(question.assessment_id) ?? new Set<string>();
          if (!seen.has(sectionKey)) {
            const sections = sectionsByAssessment.get(question.assessment_id) ?? [];
            sections.push({
              id: sectionId,
              title: sectionTitle,
              description: String(question.section_description ?? ""),
            });
            sectionsByAssessment.set(question.assessment_id, sections);
            seen.add(sectionKey);
            sectionSeenByAssessment.set(question.assessment_id, seen);
          }
        }
      }
    });

    return assessments.map((assessment) => ({
      id: assessment.assessment_id,
      assessment_id: assessment.assessment_id,
      title: assessment.title,
      description: assessment.description ?? "",
      subject_id: assessment.subject_id,
      subject_name: assessment.subject_name,
      grade_id: assessment.grade_id,
      phonemic_id: assessment.phonemic_id,
      phonemic_level_name: assessment.phonemic_level_name,
      created_by: assessment.created_by,
      creator_role: assessment.creator_role,
      start_time: toIso(assessment.start_time),
      end_time: toIso(assessment.end_time),
      is_published: Boolean(assessment.is_published),
      created_at: toIso(assessment.created_at),
      updated_at: toIso(assessment.updated_at),
      quiz_code: assessment.quiz_code,
      qr_token: assessment.qr_token,
      submitted_count: Number(assessment.submitted_count ?? 0),
      assigned_count: Number(assessment.assigned_count ?? 0),
      sections: sectionsByAssessment.get(assessment.assessment_id) ?? [],
      questions: questionsByAssessment.get(assessment.assessment_id) ?? [],
    }));
  });
}

export async function createAssessmentRecord(payload: AssessmentPayload) {
  return runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      await ensureQuestionSectionColumns(connection);

      const subjectId = await resolveSubjectId(connection, payload.subjectId ?? null, payload.subjectName ?? null);
      const phonemicId = await resolvePhonemicId(
        connection,
        subjectId,
        payload.phonemicId ?? null,
        payload.phonemicLevel ?? null
      );
      const gradeId = await resolveGradeId(connection, {
        gradeId: payload.gradeId ?? null,
        createdBy: payload.createdBy ?? null,
        creatorRole: payload.creatorRole ?? "teacher",
      });

      const startTime = parseMySqlDateTime(payload.startTime);
      const endTime = parseMySqlDateTime(payload.endTime);

      if (!startTime || !endTime) {
        throw new Error("Invalid assessment start/end date.");
      }

      const quizCode = await generateUniqueQuizCode(connection);
      const qrToken = generateQrToken();

      const [insertResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO assessments (
          title,
          description,
          subject_id,
          grade_id,
          phonemic_id,
          created_by,
          creator_role,
          start_time,
          end_time,
          is_published,
          quiz_code,
          qr_token,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          payload.title,
          payload.description ?? null,
          subjectId,
          gradeId,
          phonemicId,
          payload.createdBy ?? "",
          payload.creatorRole ?? "teacher",
          startTime,
          endTime,
          payload.isPublished ? 1 : 0,
          quizCode,
          qrToken,
        ]
      );

      const assessmentId = insertResult.insertId;

      for (let index = 0; index < payload.questions.length; index += 1) {
        await insertQuestionWithChoices(
          connection,
          assessmentId,
          payload.questions[index],
          index + 1,
          payload.sections
        );
      }

      await connection.commit();
      return {
        assessmentId,
        quizCode,
        qrToken,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

export async function updateAssessmentRecord(assessmentId: number, payload: AssessmentPayload) {
  return runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      await ensureQuestionSectionColumns(connection);

      const [existingRows] = await connection.query<RowDataPacket[]>(
        "SELECT assessment_id, quiz_code, qr_token, grade_id, created_by, creator_role FROM assessments WHERE assessment_id = ? LIMIT 1",
        [assessmentId]
      );

      if (existingRows.length === 0) {
        throw new Error("Assessment not found.");
      }

      const subjectId = await resolveSubjectId(connection, payload.subjectId ?? null, payload.subjectName ?? null);
      const phonemicId = await resolvePhonemicId(
        connection,
        subjectId,
        payload.phonemicId ?? null,
        payload.phonemicLevel ?? null
      );
      const gradeId = await resolveGradeId(connection, {
        gradeId: payload.gradeId ?? null,
        createdBy: payload.createdBy ?? String(existingRows[0].created_by ?? ""),
        creatorRole: payload.creatorRole ?? String(existingRows[0].creator_role ?? "teacher"),
        fallbackGradeId: Number(existingRows[0].grade_id ?? 0) || null,
      });

      const startTime = parseMySqlDateTime(payload.startTime);
      const endTime = parseMySqlDateTime(payload.endTime);

      if (!startTime || !endTime) {
        throw new Error("Invalid assessment start/end date.");
      }

      const existingQuizCode = (existingRows[0].quiz_code as string | null) ?? null;
      const existingQrToken = (existingRows[0].qr_token as string | null) ?? null;
      const quizCode = existingQuizCode ?? (await generateUniqueQuizCode(connection));
      const qrToken = existingQrToken ?? generateQrToken();

      await connection.query(
        `UPDATE assessments
         SET title = ?,
             description = ?,
             subject_id = ?,
             grade_id = ?,
             phonemic_id = ?,
             start_time = ?,
             end_time = ?,
             is_published = ?,
             creator_role = ?,
             quiz_code = ?,
             qr_token = ?,
             updated_at = NOW()
         WHERE assessment_id = ?`,
        [
          payload.title,
          payload.description ?? null,
          subjectId,
          gradeId,
          phonemicId,
          startTime,
          endTime,
          payload.isPublished ? 1 : 0,
          payload.creatorRole ?? "teacher",
          quizCode,
          qrToken,
          assessmentId,
        ]
      );

      const [questionRows] = await connection.query<RowDataPacket[]>(
        "SELECT question_id FROM assessment_questions WHERE assessment_id = ?",
        [assessmentId]
      );
      const questionIds = questionRows.map((row) => Number(row.question_id));

      if (questionIds.length > 0) {
        const placeholders = questionIds.map(() => "?").join(", ");
        await connection.query(
          `DELETE FROM assessment_question_choices WHERE question_id IN (${placeholders})`,
          questionIds
        );
      }

      await connection.query("DELETE FROM assessment_questions WHERE assessment_id = ?", [assessmentId]);

      for (let index = 0; index < payload.questions.length; index += 1) {
        await insertQuestionWithChoices(
          connection,
          assessmentId,
          payload.questions[index],
          index + 1,
          payload.sections
        );
      }

      await connection.commit();
      return {
        assessmentId,
        quizCode,
        qrToken,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

export async function deleteAssessmentRecord(assessmentId: number) {
  return runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      const [questionRows] = await connection.query<RowDataPacket[]>(
        "SELECT question_id FROM assessment_questions WHERE assessment_id = ?",
        [assessmentId]
      );
      const questionIds = questionRows.map((row) => Number(row.question_id));

      if (questionIds.length > 0) {
        const placeholders = questionIds.map(() => "?").join(", ");
        await connection.query(
          `DELETE FROM assessment_question_choices WHERE question_id IN (${placeholders})`,
          questionIds
        );
      }

      await connection.query("DELETE FROM assessment_questions WHERE assessment_id = ?", [assessmentId]);
      await connection.query("DELETE FROM assessments WHERE assessment_id = ?", [assessmentId]);

      await connection.commit();
      return { assessmentId };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}
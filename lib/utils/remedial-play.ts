import { buildFlashcardContentKey } from "@/lib/utils/flashcards-storage";

type SubjectName = "English" | "Filipino" | "Math";

type ScheduleActivity = {
  id: string;
  subject: string | null;
  subjectId: number | null;
  gradeId: number | null;
  date: Date;
};

type MaterialContent = {
  materialId: number | null;
  flashcards: unknown[];
};

type ResolvePlayOptions = {
  subject: SubjectName;
  basePath: string;
  studentId: string;
  studentPhonemicLevel: string;
  studentGrade?: string | null;
  userId?: string | number | null;
};

type ResolvePlayResult = { playPath: string } | { error: string };

type SessionLookup = {
  success?: boolean;
  found?: boolean;
  session?: {
    completedAt?: string | null;
  };
};

type SessionStatusResponse = {
  success?: boolean;
  statusByStudent?: Record<string, { completed?: boolean }>;
};

type SubjectLevelsResponse = {
  success?: boolean;
  levels?: Array<{ phonemic_id?: number; level_name?: string }>;
  error?: string;
};

type ScheduleResponse = {
  success?: boolean;
  activities?: Array<Record<string, unknown>>;
  error?: string;
};

type MaterialContentResponse = {
  success?: boolean;
  found?: boolean;
  content?: {
    materialId?: number | null;
    flashcards?: unknown[] | null;
    flashcardsOverride?: unknown[] | null;
  };
};

const SUBJECT_ID_MAP: Record<SubjectName, number> = {
  English: 1,
  Filipino: 2,
  Math: 3,
};

const normalizeLevel = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeCalendarSubject = (value: string | null | undefined): SubjectName | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith("eng")) return "English";
  if (lower.startsWith("fil")) return "Filipino";
  if (lower.startsWith("math") || lower.includes("mathematics")) return "Math";
  return null;
};

const parseGradeId = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (!text.trim()) return null;
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseActivityDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const getFlashcardsBaseKey = (subject: SubjectName): string => {
  if (subject === "English") return "MASTER_TEACHER_ENGLISH_FLASHCARDS";
  if (subject === "Filipino") return "MASTER_TEACHER_FILIPINO_FLASHCARDS";
  return "MASTER_TEACHER_MATH_FLASHCARDS";
};

const getFlashcardsPath = (subject: SubjectName): string => {
  if (subject === "English") return "EnglishFlashcards";
  if (subject === "Filipino") return "FilipinoFlashcards";
  return "MathFlashcards";
};

const loadScheduleActivities = async (gradeLabel?: string | null): Promise<ScheduleActivity[]> => {
  const query = gradeLabel ? `?grade=${encodeURIComponent(gradeLabel)}` : "";
  const response = await fetch(`/api/teacher/calendar${query}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as ScheduleResponse | null;
  if (!response.ok || !payload?.success) {
    return [];
  }

  const activities = Array.isArray(payload.activities) ? payload.activities : [];
  return activities
    .map((item, index): ScheduleActivity | null => {
      const rawDate = item.activityDate ?? item.scheduleDate ?? item.schedule_date ?? item.date ?? null;
      const date = parseActivityDate(rawDate);
      if (!date) return null;

      const subject = typeof item.subject === "string"
        ? item.subject
        : typeof item.subject_name === "string"
          ? item.subject_name
          : null;
      const subjectId = toNumber(item.subjectId ?? item.subject_id ?? null);
      const gradeId = toNumber(item.gradeId ?? item.grade_id ?? null);

      return {
        id: String(item.id ?? item.request_id ?? index + 1),
        subject,
        subjectId,
        gradeId,
        date,
      };
    })
    .filter((item): item is ScheduleActivity => Boolean(item));
};

const resolvePhonemicId = async (subject: SubjectName, levelName: string): Promise<number | null> => {
  const response = await fetch(`/api/subject-levels?subject=${encodeURIComponent(subject)}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as SubjectLevelsResponse | null;
  if (!response.ok || !payload?.success) return null;

  const normalizedTarget = normalizeLevel(levelName);
  const levels = Array.isArray(payload.levels) ? payload.levels : [];
  const match = levels.find((level) => normalizeLevel(String(level.level_name ?? "")) === normalizedTarget);
  const phonemicId = match?.phonemic_id;
  return typeof phonemicId === "number" && Number.isFinite(phonemicId) ? phonemicId : null;
};

const fetchMaterialContent = async (requestId: string, phonemicId: number): Promise<MaterialContent | null> => {
  const response = await fetch(
    `/api/remedial-material-content?requestId=${encodeURIComponent(requestId)}&phonemicId=${encodeURIComponent(String(phonemicId))}`,
    { cache: "no-store" },
  );
  const payload = (await response.json().catch(() => null)) as MaterialContentResponse | null;
  if (!response.ok || !payload?.success || !payload?.found || !payload?.content) return null;

  const content = payload.content;
  const cards = (Array.isArray(content.flashcardsOverride) && content.flashcardsOverride.length)
    ? content.flashcardsOverride
    : Array.isArray(content.flashcards)
      ? content.flashcards
      : [];

  if (!Array.isArray(cards) || !cards.length) return null;

  return {
    materialId: typeof content.materialId === "number" ? content.materialId : null,
    flashcards: cards,
  };
};

const hasInProgressSession = async (studentId: string, scheduleId: string): Promise<boolean> => {
  const response = await fetch(
    `/api/remedial/session?studentId=${encodeURIComponent(studentId)}&approvedScheduleId=${encodeURIComponent(scheduleId)}`,
    { cache: "no-store" },
  );
  const payload = (await response.json().catch(() => null)) as SessionLookup | null;
  if (!response.ok || !payload?.success || !payload?.found) return false;
  return !payload?.session?.completedAt;
};

const isSessionCompleted = async (args: {
  studentId: string;
  scheduleId: string;
  subjectId: number;
  phonemicId: number | null;
}): Promise<boolean | null> => {
  const response = await fetch("/api/remedial/session/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      approvedScheduleId: args.scheduleId,
      subjectId: args.subjectId,
      phonemicId: args.phonemicId,
      studentIds: [args.studentId],
    }),
  });

  const payload = (await response.json().catch(() => null)) as SessionStatusResponse | null;
  if (!response.ok || !payload?.success) return null;
  return Boolean(payload?.statusByStudent?.[args.studentId]?.completed);
};

const storeFlashcards = (args: {
  subject: SubjectName;
  activityId: string;
  phonemicId: number;
  userId?: string | number | null;
  cards: unknown[];
}) => {
  if (typeof window === "undefined") return;

  const baseKey = getFlashcardsBaseKey(args.subject);
  let contentToStore = args.cards;
  if (args.subject === "Math") {
    contentToStore = args.cards.map((card: any) => ({
      question: card?.sentence ?? "",
      correctAnswer: card?.answer ?? "",
    }));
  }

  const storageKey = buildFlashcardContentKey(baseKey, {
    activityId: args.activityId,
    phonemicId: args.phonemicId,
    userId: args.userId ?? null,
  });
  window.localStorage.setItem(storageKey, JSON.stringify(contentToStore));
};

export const resolveRemedialPlayTarget = async (options: ResolvePlayOptions): Promise<ResolvePlayResult> => {
  const phonemicName = options.studentPhonemicLevel.trim();
  if (!phonemicName) {
    return { error: "Student phonemic level is missing." };
  }

  const phonemicId = await resolvePhonemicId(options.subject, phonemicName);
  if (!phonemicId) {
    return { error: `No phonemic level mapping found for ${phonemicName}.` };
  }

  const activities = await loadScheduleActivities(options.studentGrade ?? null);
  const subjectActivities = activities.filter((activity) => {
    const normalized = normalizeCalendarSubject(activity.subject);
    return normalized === options.subject;
  });
  if (!subjectActivities.length) {
    return { error: "No remedial schedule found for this subject." };
  }

  const gradeId = parseGradeId(options.studentGrade ?? null);
  const gradeFiltered = gradeId
    ? subjectActivities.filter((activity) => activity.gradeId === gradeId)
    : subjectActivities;
  const candidates = gradeFiltered.length ? gradeFiltered : subjectActivities;

  const sortedDesc = [...candidates].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const activity of sortedDesc) {
    const inProgress = await hasInProgressSession(options.studentId, activity.id);
    if (!inProgress) continue;

    const material = await fetchMaterialContent(activity.id, phonemicId);
    if (!material) continue;

    storeFlashcards({
      subject: options.subject,
      activityId: activity.id,
      phonemicId,
      userId: options.userId ?? null,
      cards: material.flashcards,
    });

    const playPath = new URLSearchParams();
    playPath.set("subject", options.subject);
    playPath.set("activity", activity.id);
    playPath.set("studentId", options.studentId);
    playPath.set("phonemicId", String(phonemicId));
    playPath.set("phonemicName", phonemicName);

    const subjectId = activity.subjectId ?? SUBJECT_ID_MAP[options.subject];
    if (subjectId) playPath.set("subjectId", String(subjectId));
    const resolvedGradeId = activity.gradeId ?? gradeId;
    if (resolvedGradeId) playPath.set("gradeId", String(resolvedGradeId));
    if (material.materialId) playPath.set("materialId", String(material.materialId));

    return { playPath: `${options.basePath}/${getFlashcardsPath(options.subject)}?${playPath.toString()}` };
  }

  const sortedAsc = [...candidates].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const activity of sortedAsc) {
    const subjectId = activity.subjectId ?? SUBJECT_ID_MAP[options.subject];
    if (!subjectId) {
      return { error: "Unable to resolve subject for remedial schedule." };
    }

    const completed = await isSessionCompleted({
      studentId: options.studentId,
      scheduleId: activity.id,
      subjectId,
      phonemicId,
    });

    if (completed === null) {
      return { error: "Unable to verify remedial completion status." };
    }

    if (completed) {
      continue;
    }

    const material = await fetchMaterialContent(activity.id, phonemicId);
    if (!material) {
      continue;
    }

    storeFlashcards({
      subject: options.subject,
      activityId: activity.id,
      phonemicId,
      userId: options.userId ?? null,
      cards: material.flashcards,
    });

    const playPath = new URLSearchParams();
    playPath.set("subject", options.subject);
    playPath.set("activity", activity.id);
    playPath.set("studentId", options.studentId);
    playPath.set("phonemicId", String(phonemicId));
    playPath.set("phonemicName", phonemicName);
    playPath.set("subjectId", String(subjectId));
    const resolvedGradeId = activity.gradeId ?? gradeId;
    if (resolvedGradeId) playPath.set("gradeId", String(resolvedGradeId));
    if (material.materialId) playPath.set("materialId", String(material.materialId));

    return { playPath: `${options.basePath}/${getFlashcardsPath(options.subject)}?${playPath.toString()}` };
  }

  return { error: "No available remedial schedule with materials found for this student." };
};

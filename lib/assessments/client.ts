// Removed import to avoid circular dependency
export interface ClientQuizQuestion {
    type: string;
    question: string;
    points: number;
    options?: string[];
    correctAnswer: string | string[];
    sectionId?: string;
    sectionTitle?: string;
}

export interface FetchParams {
    creatorId: string;
    creatorRole: string;
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

export interface AssessmentScheduleActivity {
    id: string;
    title: string;
    subject: string | null;
    subjectId?: number | null;
    gradeId?: number | null;
    date: Date;
    day: string | null;
    startTime: string | null;
    endTime: string | null;
}

export async function fetchAssessments(params: FetchParams): Promise<any[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("creatorId", params.creatorId);
    searchParams.set("creatorRole", params.creatorRole);
    if (params.subjectId) searchParams.set("subjectId", params.subjectId);
    if (params.subjectName) searchParams.set("subjectName", params.subjectName);
    if (params.phonemicId) searchParams.set("phonemicId", params.phonemicId);

    const response = await fetch(`/api/assessments?${searchParams.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to fetch assessments.");
    }

    return Array.isArray(data.assessments) ? data.assessments : [];
}

export async function fetchAssessmentSchedule(): Promise<AssessmentScheduleActivity[]> {
    const response = await fetch("/api/assessments/days", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to fetch assessment schedule.");
    }

    const activities = Array.isArray(data.activities) ? data.activities : [];
    return activities
        .map((item: any, index: number): AssessmentScheduleActivity | null => {
            const rawDate = item.activityDate ?? item.date ?? null;
            const date = rawDate ? new Date(rawDate) : null;
            if (!date || Number.isNaN(date.getTime())) {
                return null;
            }

            return {
                id: String(item.id ?? index + 1),
                title: item.title ?? "Scheduled Assessment",
                subject: item.subject ?? null,
                subjectId: Number.isFinite(Number(item.subjectId)) ? Number(item.subjectId) : null,
                gradeId: Number.isFinite(Number(item.gradeId)) ? Number(item.gradeId) : null,
                date,
                day: item.day ?? null,
                startTime: item.startTime ?? null,
                endTime: item.endTime ?? null,
            };
        })
        .filter((item: AssessmentScheduleActivity | null): item is AssessmentScheduleActivity => item !== null)
        .sort(
            (left: AssessmentScheduleActivity, right: AssessmentScheduleActivity) =>
                left.date.getTime() - right.date.getTime(),
        );
}

export async function createAssessment(payload: AssessmentPayload): Promise<any> {
    const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to create assessment.");
    }

    return data;
}

export async function updateAssessment(id: number | string, payload: AssessmentPayload): Promise<any> {
    const response = await fetch(`/api/assessments/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to update assessment.");
    }

    return data;
}

export async function deleteAssessment(id: number | string): Promise<any> {
    const response = await fetch(`/api/assessments/${id}`, {
        method: "DELETE",
        credentials: "include",
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to delete assessment.");
    }

    return data;
}

export function mapQuizQuestionsToPayload(
    questions: ClientQuizQuestion[],
    sections: IncomingSection[] = []
): IncomingQuestion[] {
    const sectionById = new Map<string, IncomingSection>();
    sections.forEach((section) => {
        if (section.id) {
            sectionById.set(section.id, section);
        }
    });

    return questions.map((q) => {
        let choices: IncomingChoice[] | undefined;

        // Normalize type for backend
        let questionType = q.type as string;
        if (q.type === 'multiple-choice' || q.type === 'true-false') {
            questionType = 'multiple_choice'; // or whatever the backend expects, usually it's normalized there but good to be consistent
        } else if (q.type === 'short-answer') {
            questionType = 'short_answer';
        }

        if (q.type === 'multiple-choice' || q.type === 'true-false' || q.type === 'matching') {
            const correctAnswers = Array.isArray(q.correctAnswer) ? new Set(q.correctAnswer) : new Set([q.correctAnswer]);

            if (q.options) {
                choices = q.options.map((opt) => ({
                    choiceText: opt,
                    isCorrect: correctAnswers.has(opt),
                }));
            }
        }

        return {
            questionText: q.question,
            questionType: questionType,
            points: q.points,
            choices,
            correctAnswerText: Array.isArray(q.correctAnswer) ? (q.correctAnswer[0] ?? "") : q.correctAnswer,
            sectionId: q.sectionId,
            sectionTitle: q.sectionTitle,
            sectionDescription: q.sectionId ? sectionById.get(q.sectionId)?.description ?? "" : "",
        };
    });
}

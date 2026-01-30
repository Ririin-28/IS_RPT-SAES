// Removed import to avoid circular dependency
export interface ClientQuizQuestion {
    type: string;
    question: string;
    points: number;
    options?: string[];
    correctAnswer: string | string[];
}

export interface FetchParams {
    creatorId: string;
    creatorRole: string;
    subjectId?: string;
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
}

export async function fetchAssessments(params: FetchParams): Promise<any[]> {
    const query = new URLSearchParams(params as any);
    const response = await fetch(`/api/assessments?${query.toString()}`);
    if (!response.ok) {
        throw new Error("Failed to fetch assessments");
    }
    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || "Failed to fetch assessments");
    }
    return data.assessments;
}

export async function createAssessment(payload: AssessmentPayload): Promise<any> {
    const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create assessment");
    }
    return data;
}

export async function updateAssessment(id: number | string, payload: AssessmentPayload): Promise<any> {
    const response = await fetch(`/api/assessments/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update assessment");
    }
    return data;
}

export function mapQuizQuestionsToPayload(questions: ClientQuizQuestion[]): IncomingQuestion[] {
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
        };
    });
}

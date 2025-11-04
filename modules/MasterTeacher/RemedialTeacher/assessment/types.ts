export interface QuizResponse {
  id: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  score?: number;
  answers: Record<string, string | string[]>;
}

export const cloneResponses = (responses?: QuizResponse[]): QuizResponse[] => {
  if (!responses || responses.length === 0) {
    return [];
  }

  return responses.map((response) => {
    const clonedAnswers: Record<string, string | string[]> = {};

    Object.entries(response.answers ?? {}).forEach(([questionId, answer]) => {
      clonedAnswers[questionId] = Array.isArray(answer) ? [...answer] : answer;
    });

    return {
      ...response,
      answers: clonedAnswers,
    };
  });
};


import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import * as tf from "@tensorflow/tfjs";

export interface StudentTrainingData {
  studentId: string;
  features: number[]; // [RemedialCount, PhonemicLevel (encoded), PerformanceAvg]
  label: number;      // NextScorePrediction
}

/**
 * Fetches recent performance history and remedial session counts for training.
 * Simplified for demonstration:
 * Features:
 * 1. Number of Remedial Sessions
 * 2. Phonemic Level (1=Pre-Read, 2=Full-alpha, 3=Word, 4=Sentence, 5=Paragraph)
 * 3. Average Assessment Score (Last 5 records)
 *
 * Label:
 * - Most recent performance score (Regression target).
 */
export async function fetchStudentTrainingData(): Promise<StudentTrainingData[]> {
  // Get list of students with at least 2 performance records (1 for history, 1 for target)
  const [students] = await query<RowDataPacket[]>(`
    SELECT DISTINCT pr.student_id 
    FROM performance_records pr
    GROUP BY pr.student_id
    HAVING COUNT(pr.record_id) >= 2
  `);

  const trainingData: StudentTrainingData[] = [];

  for (const student of students) {
    const studentId = student.student_id;

    // 1. Count Remedial Sessions
    const [remedialCount] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM student_remedial_session WHERE student_id = ?`,
      [studentId]
    );
    const sessions = remedialCount[0]?.count || 0;

    // 2. Get Phonemic Level (from subject assessment history)
    // Assuming phonemic_id maps roughly to difficulty/level (1-5).
    // If null, default to 1 (lowest).
    const [studentInfo] = await query<RowDataPacket[]>(
      `SELECT ssa.phonemic_id
       FROM student_subject_assessment ssa
       JOIN subject s ON s.subject_id = ssa.subject_id
       WHERE ssa.student_id = ? AND LOWER(TRIM(s.subject_name)) = 'english'
       ORDER BY ssa.assessed_at DESC
       LIMIT 1`,
      [studentId]
    );
    const phonemicLevel = studentInfo[0]?.phonemic_id || 1;

    // 3. Get Performance History
    // Order by date DESC. Take top 6.
    // Index 0 is the "Target" (most recent).
    // Index 1-5 are "History" features.
    const [history] = await query<RowDataPacket[]>(
      `SELECT pr.score 
       FROM performance_records pr 
       JOIN activities a ON pr.activity_id = a.activity_id
       WHERE pr.student_id = ?
       ORDER BY a.date DESC
       LIMIT 6`,
      [studentId]
    );

    if (history.length < 2) continue; // Need at least 2 data points

    const targetScore = parseFloat(history[0].score); // Most recent
    const previousScores = history.slice(1).map(r => parseFloat(r.score));
    
    // Feature: Average of previous scores
    const avgPreviousScore = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;

    trainingData.push({
      studentId,
      features: [
        sessions,        // Feature 1: Remedial Experience
        phonemicLevel,   // Feature 2: Current Competency Level
        avgPreviousScore // Feature 3: Recent Performance Trend
      ],
      label: targetScore // Target: Predict next score
    });
  }

  // If DB is empty, generate some synthetic data for demonstration
  if (trainingData.length < 5) {
     return generateSyntheticData();
  }

  return trainingData;
}

export async function getStudentFeatures(studentId: string): Promise<number[] | null> {
    // 1. Count Remedial Sessions
    const [remedialCount] = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM student_remedial_session WHERE student_id = ?`,
      [studentId]
    );
    const sessions = remedialCount[0]?.count || 0;

    // 2. Get Phonemic Level
    const [studentInfo] = await query<RowDataPacket[]>(
      `SELECT ssa.phonemic_id
       FROM student_subject_assessment ssa
       JOIN subject s ON s.subject_id = ssa.subject_id
       WHERE ssa.student_id = ? AND LOWER(TRIM(s.subject_name)) = 'english'
       ORDER BY ssa.assessed_at DESC
       LIMIT 1`,
      [studentId]
    );
    const phonemicLevel = studentInfo[0]?.phonemic_id || 1;

    // 3. Get Recent Performance Average
    // Take top 5 recent activities
    const [history] = await query<RowDataPacket[]>(
      `SELECT pr.score 
       FROM performance_records pr 
       JOIN activities a ON pr.activity_id = a.activity_id
       WHERE pr.student_id = ?
       ORDER BY a.date DESC
       LIMIT 5`,
      [studentId]
    );

    if (history.length === 0) return null; // Not enough data for prediction

    const scores = history.map(r => parseFloat(r.score));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return [sessions, phonemicLevel, avgScore];
}

function generateSyntheticData(): StudentTrainingData[] {
  const data: StudentTrainingData[] = [];
  for (let i = 0; i < 50; i++) {
    // Generate realistic-looking student data
    const sessions = Math.floor(Math.random() * 10); // 0-10 sessions
    const phonemicLevel = Math.floor(Math.random() * 5) + 1; // 1-5 level
    const baseAbility = (phonemicLevel * 10) + (sessions * 2); // Correlation: Higher level + more sessions = better
    
    const avgPreviousScore = Math.min(100, Math.max(0, baseAbility + (Math.random() * 20 - 10)));
    
    // Target is slightly better due to "learning", with noise
    const targetScore = Math.min(100, Math.max(0, avgPreviousScore + (Math.random() * 10 - 2)));

    data.push({
      studentId: `synthetic-${i}`,
      features: [sessions, phonemicLevel, avgPreviousScore],
      label: targetScore
    });
  }
  return data;
}

export interface TensorData {
  inputs: tf.Tensor2D;
  labels: tf.Tensor2D;
  inputMax: tf.Tensor;
  inputMin: tf.Tensor;
  originalData: StudentTrainingData[];
}

export function convertToTensors(data: StudentTrainingData[]): TensorData {
  // Shuffle data first (outside tidy)
  tf.util.shuffle(data);
  const rawInputs = data.map(d => d.features);
  const rawLabels = data.map(d => d.label);

  const tensorResult = tf.tidy(() => {
    const inputTensor = tf.tensor2d(rawInputs, [rawInputs.length, 3]);
    const labelTensor = tf.tensor2d(rawLabels, [rawLabels.length, 1]);

    // Normalize inputs (Min-Max scaling is simple and effective here)
    const inputMax = inputTensor.max(0);
    const inputMin = inputTensor.min(0);
    const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));

    // Normalize labels (0-100 score -> 0-1 range)
    const normalizedLabels = labelTensor.div(tf.scalar(100));

    return {
      inputs: normalizedInputs as tf.Tensor2D,
      labels: normalizedLabels as tf.Tensor2D,
      inputMax,
      inputMin
    };
  });

  return {
    ...tensorResult,
    originalData: data
  };
}


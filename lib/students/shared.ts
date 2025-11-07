import { MATERIAL_SUBJECTS, type MaterialSubject, normalizeMaterialSubject } from "@/lib/materials/shared";

export const STUDENT_SUBJECTS = MATERIAL_SUBJECTS;
export type StudentSubject = MaterialSubject;

export type StudentRecordDto = {
  id: number;
  studentIdentifier: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string;
  gradeLevel: string | null;
  section: string | null;
  age: string | null;
  subject: StudentSubject;
  guardianName: string | null;
  guardianContact: string | null;
  address: string | null;
  relationship: string | null;
  englishPhonemic: string | null;
  filipinoPhonemic: string | null;
  mathProficiency: string | null;
  createdBy: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateStudentRecordInput = {
  studentIdentifier?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  gradeLevel?: string | null;
  section?: string | null;
  age?: string | null;
  guardianName?: string | null;
  guardianContact?: string | null;
  address?: string | null;
  englishPhonemic?: string | null;
  filipinoPhonemic?: string | null;
  mathProficiency?: string | null;
  relationship?: string | null;
};

export type UpdateStudentRecordInput = CreateStudentRecordInput;

export type StudentQueryFilters = {
  subject: string;
  search?: string | null;
  gradeLevel?: string | null;
  section?: string | null;
  page?: number;
  pageSize?: number;
};

export function resolveStudentSubject(value: unknown, fallback: StudentSubject): StudentSubject {
  const normalized = normalizeMaterialSubject(value);
  return normalized ?? fallback;
}

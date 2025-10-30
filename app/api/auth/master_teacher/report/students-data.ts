import type { SubjectKey } from "./subject-config";

export type StudentProgress = {
  id: string;
  name: string;
  section: string;
  gradeLevel: string;
  startingLevel: string;
  currentLevel: string;
  aiRecommendation: string;
};

const englishStudents: StudentProgress[] = [
  {
    id: "english-1",
    name: "Agustia, Aiden Richard Paloma",
    section: "III-Crimson",
    gradeLevel: "Grade 3",
    startingLevel: "Non-Reader",
    currentLevel: "Phrase Reader",
    aiRecommendation: "Continue daily phonics drills focusing on vowel blends; assign weekly fluency passages.",
  },
  {
    id: "english-2",
    name: "Romano, Gabriel Luis",
    section: "III-Crimson",
    gradeLevel: "Grade 3",
    startingLevel: "Non-Reader",
    currentLevel: "Phrase Reader",
    aiRecommendation: "Introduce comprehension checks after each reading session and practice with simple narratives.",
  },
  {
    id: "english-3",
    name: "Sanchez, Eithan Jhara Encinares",
    section: "III-Violet",
    gradeLevel: "Grade 3",
    startingLevel: "Non-Reader",
    currentLevel: "Sentence Reader",
    aiRecommendation: "Provide sentence construction exercises and encourage paired reading for confidence building.",
  },
  {
    id: "english-4",
    name: "Ano, Sebastian Renz Tabianan",
    section: "III-White",
    gradeLevel: "Grade 3",
    startingLevel: "Word Reader",
    currentLevel: "Sentence Reader",
    aiRecommendation: "Use context clue activities and weekly storytelling to strengthen comprehension skills.",
  },
  {
    id: "english-5",
    name: "Mauricio, Christian Habonero",
    section: "III-Yellow",
    gradeLevel: "Grade 3",
    startingLevel: "Syllable Reader",
    currentLevel: "Story Reader",
    aiRecommendation: "Assign longer narrative passages and reflective journaling to maintain reading momentum.",
  },
  {
    id: "english-6",
    name: "Morales, Nyhl Zion",
    section: "III-Blue",
    gradeLevel: "Grade 3",
    startingLevel: "Syllable Reader",
    currentLevel: "Phrase Reader",
    aiRecommendation: "Incorporate rhythm-based reading games to reinforce fluency and word recognition.",
  },
];

const filipinoStudents: StudentProgress[] = [
  {
    id: "filipino-1",
    name: "Abalos, Jennica Mae",
    section: "III-Malaya",
    gradeLevel: "Baitang 3",
    startingLevel: "Di Mambabasa",
    currentLevel: "Word Reader",
    aiRecommendation: "Maglaan ng araw-araw na pagbasa ng pantig at simpleng pangungusap upang patatagin ang pag-unawa.",
  },
  {
    id: "filipino-2",
    name: "Castro, Eliza Joy",
    section: "III-Matalino",
    gradeLevel: "Baitang 3",
    startingLevel: "Syllable Reader",
    currentLevel: "Phrase Reader",
    aiRecommendation: "Gumamit ng mga larong pang-angkop at pang-ugnay upang mapayaman ang bokabularyo.",
  },
  {
    id: "filipino-3",
    name: "Dela Cruz, Jericho",
    section: "III-Masigasig",
    gradeLevel: "Baitang 3",
    startingLevel: "Word Reader",
    currentLevel: "Sentence Reader",
    aiRecommendation: "Ipatupad ang talakayang pangklase matapos ang bawat pagbasa upang masanay sa pagbibigay-kahulugan.",
  },
  {
    id: "filipino-4",
    name: "Escobar, Hannah",
    section: "III-Matalas",
    gradeLevel: "Baitang 3",
    startingLevel: "Syllable Reader",
    currentLevel: "Sentence Reader",
    aiRecommendation: "Maglaan ng pagsasanay sa pagbasa nang malakas na sinusundan ng pagbuo ng pangungusap.",
  },
  {
    id: "filipino-5",
    name: "Guzman, Francine",
    section: "III-Matalino",
    gradeLevel: "Baitang 3",
    startingLevel: "Word Reader",
    currentLevel: "Paraphrase Reader",
    aiRecommendation: "Magpabasa ng maikling kwento at ipa-salaysay muli gamit ang sariling salita.",
  },
  {
    id: "filipino-6",
    name: "Villanueva, Mico",
    section: "III-Masigasig",
    gradeLevel: "Baitang 3",
    startingLevel: "Non-Reader",
    currentLevel: "Phrase Reader",
    aiRecommendation: "Isama sa pang-araw-araw na pagbasa ang paggamit ng larawan upang matulungan ang pag-unawa.",
  },
];

const mathStudents: StudentProgress[] = [
  {
    id: "math-1",
    name: "Andres, Felicity",
    section: "III-Integrity",
    gradeLevel: "Grade 3",
    startingLevel: "Not Proficient",
    currentLevel: "Nearly Proficient",
    aiRecommendation: "Review number sense using manipulatives and provide weekly practice sheets on addition facts.",
  },
  {
    id: "math-2",
    name: "Ballesteros, Nolan",
    section: "III-Integrity",
    gradeLevel: "Grade 3",
    startingLevel: "Low Proficient",
    currentLevel: "Proficient",
    aiRecommendation: "Introduce multi-step word problems and reflective math journals to sustain growth.",
  },
  {
    id: "math-3",
    name: "Cruz, Justine",
    section: "III-Resilience",
    gradeLevel: "Grade 3",
    startingLevel: "Not Proficient",
    currentLevel: "Proficient",
    aiRecommendation: "Strengthen conceptual understanding through visual models and peer tutoring sessions.",
  },
  {
    id: "math-4",
    name: "De Guzman, Lianne",
    section: "III-Resilience",
    gradeLevel: "Grade 3",
    startingLevel: "Low Proficient",
    currentLevel: "Proficient",
    aiRecommendation: "Provide extension tasks on fractions and monitor mastery via exit tickets.",
  },
  {
    id: "math-5",
    name: "Escueta, Carlo",
    section: "III-Valor",
    gradeLevel: "Grade 3",
    startingLevel: "Not Proficient",
    currentLevel: "Nearly Proficient",
    aiRecommendation: "Incorporate math games that focus on place value and regrouping strategies.",
  },
  {
    id: "math-6",
    name: "Fuentes, Janella",
    section: "III-Valor",
    gradeLevel: "Grade 3",
    startingLevel: "Nearly Proficient",
    currentLevel: "Highly Proficient",
    aiRecommendation: "Introduce challenge problems involving multi-digit multiplication and logical reasoning.",
  },
];

export const STUDENT_DATA: Record<SubjectKey, StudentProgress[]> = {
  english: englishStudents,
  filipino: filipinoStudents,
  math: mathStudents,
};

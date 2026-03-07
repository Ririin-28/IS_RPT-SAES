import { jsPDF } from "jspdf";

type PrintableQuestion = {
  id: string;
  type: string;
  question: string;
  options?: string[];
  sectionId?: string;
  sectionTitle?: string;
};

type PrintableSection = {
  id: string;
  title: string;
  description?: string;
};

type PrintableQuiz = {
  title: string;
  description?: string;
  startDate?: string;
  schedule?: string;
  sections?: PrintableSection[];
  questions: PrintableQuestion[];
};

interface DownloadPrintableQuizOptions {
  quiz: PrintableQuiz;
  subjectLabel: string;
  levelLabel: string;
}

const PAGE_MARGIN = 48;
const LINE_HEIGHT = 16;
const SECTION_SPACING = 12;
const BLOCK_SPACING = 18;

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "quiz";

const formatAssessmentDate = (value?: string) => {
  if (!value) {
    return new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const normalizeKey = (value?: string | null) => (value ?? "").trim().toLowerCase();

const toRomanNumeral = (value: number) => {
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let remainder = Math.max(1, value);
  let result = "";

  numerals.forEach(([arabic, roman]) => {
    while (remainder >= arabic) {
      result += roman;
      remainder -= arabic;
    }
  });

  return result;
};

export function downloadPrintableQuizPdf({ quiz, subjectLabel, levelLabel }: DownloadPrintableQuizOptions) {
  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const bottomLimit = pageHeight - PAGE_MARGIN;
  const assessmentDate = formatAssessmentDate(quiz.startDate ?? quiz.schedule);
  const lineLabelWidth = 108;

  let cursorY = PAGE_MARGIN;

  const getTextHeight = (text: string, width: number, fontSize = 12) => {
    const lines = pdf.splitTextToSize(text, width);
    const lineHeight = Math.max(LINE_HEIGHT, fontSize + 3);
    return {
      lines,
      lineHeight,
      height: lines.length * lineHeight,
    };
  };

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= bottomLimit) {
      return;
    }

    pdf.addPage();
    cursorY = PAGE_MARGIN;
    drawContinuationHeader();
  };

  const drawHeader = () => {
    const description = quiz.description?.trim() || "No description provided.";

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`${subjectLabel} - ${levelLabel}`, PAGE_MARGIN, cursorY);
    pdf.text(assessmentDate, pageWidth - PAGE_MARGIN, cursorY, { align: "right" });

    cursorY += 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text(quiz.title || "Untitled Quiz", pageWidth / 2, cursorY, { align: "center" });

    cursorY += 24;
    writeText(`Description: ${description}`, {
      fontSize: 11,
      gapAfter: 8,
    });

    writeRule();
    cursorY += 4;
  };

  const drawContinuationHeader = () => {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(1.2);
    pdf.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY);
    cursorY += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`${subjectLabel} - ${levelLabel}`, PAGE_MARGIN, cursorY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(assessmentDate, pageWidth - PAGE_MARGIN, cursorY, { align: "right" });
    cursorY += 14;
    pdf.setLineWidth(0.2);
  };

  const writeText = (
    text: string,
    {
      fontSize = 12,
      fontStyle = "normal",
      indent = 0,
      gapAfter = 6,
    }: {
      fontSize?: number;
      fontStyle?: "normal" | "bold";
      indent?: number;
      gapAfter?: number;
    } = {}
  ) => {
    const availableWidth = contentWidth - indent;
    const { lines, lineHeight } = getTextHeight(text, availableWidth, fontSize);

    ensureSpace(lines.length * lineHeight + gapAfter);
    pdf.setFont("helvetica", fontStyle);
    pdf.setFontSize(fontSize);
    pdf.text(lines, PAGE_MARGIN + indent, cursorY);
    cursorY += lines.length * lineHeight + gapAfter;
  };

  const writeRule = () => {
    ensureSpace(10);
    pdf.setDrawColor(0, 0, 0);
    pdf.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY);
    cursorY += 10;
  };

  const writeBlankLines = (count: number, indent = 12) => {
    for (let index = 0; index < count; index += 1) {
      ensureSpace(LINE_HEIGHT + 6);
      pdf.setDrawColor(150, 150, 150);
      pdf.line(PAGE_MARGIN + indent, cursorY, pageWidth - PAGE_MARGIN - 12, cursorY);
      cursorY += LINE_HEIGHT + 2;
    }
    cursorY += 4;
  };

  const drawLabeledLine = (label: string, value = "", width = contentWidth / 2 - 12) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(label, PAGE_MARGIN + 16, cursorY);
    pdf.setFont("helvetica", "normal");
    if (value) {
      pdf.text(value, PAGE_MARGIN + 16 + lineLabelWidth, cursorY);
    }
    const lineStart = PAGE_MARGIN + 16 + lineLabelWidth;
    const lineEnd = PAGE_MARGIN + 16 + width;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(lineStart, cursorY + 3, lineEnd, cursorY + 3);
  };

  const drawStudentInfoSection = () => {
    ensureSpace(96);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("STUDENT INFORMATION", PAGE_MARGIN, cursorY);
    cursorY += 22;

    drawLabeledLine("Name:", "", contentWidth - 32);
    cursorY += 26;
    drawLabeledLine("Grade and Section:", "", contentWidth - 32);
    cursorY += 26;
    drawLabeledLine("Score:", "", contentWidth - 32);

    cursorY += 18;
    writeRule();
    cursorY += 4;
  };

  const drawSectionHeader = (section: PrintableSection, sectionIndex: number) => {
    const description = section.description?.trim() || "No section description provided.";
    ensureSpace(54);
    const testLabel = `Test ${toRomanNumeral(sectionIndex + 1)}:`;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(`${testLabel} ${section.title || `Section ${sectionIndex + 1}`}`, PAGE_MARGIN, cursorY);
    cursorY += 22;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    writeText(`Description: ${description}`, { gapAfter: 14 });
  };

  const getQuestionBlockHeight = (questionNumber: number, question: PrintableQuestion) => {
    const questionMetrics = getTextHeight(`${questionNumber}. ${question.question}`, contentWidth - 8, 12);
    const optionList = Array.isArray(question.options)
      ? question.options.filter((option) => option.trim().length > 0)
      : [];
    const normalizedType = question.type.toLowerCase();

    let height = questionMetrics.height + 18;

    if (optionList.length > 0) {
      height += 16;
      optionList.forEach((option) => {
        height += getTextHeight(option, contentWidth - 68, 11).height + 10;
      });
    } else if (normalizedType === "true-false") {
      height += 48;
    } else {
      height += normalizedType === "problem-solving" ? 96 : 52;
    }

    return Math.max(height, 88);
  };

  const drawChoiceRow = (label: string, text: string) => {
    const circleX = PAGE_MARGIN + 20;
    const textX = PAGE_MARGIN + 38;
    const metrics = getTextHeight(`${label}. ${text}`, contentWidth - 64, 11);
    ensureSpace(metrics.height + 10);
    pdf.setDrawColor(0, 0, 0);
    pdf.circle(circleX, cursorY - 4, 4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(metrics.lines, textX, cursorY);
    cursorY += metrics.height + 8;
  };

  const drawQuestionBlock = (questionNumber: number, question: PrintableQuestion) => {
    const blockHeight = getQuestionBlockHeight(questionNumber, question);
    ensureSpace(blockHeight + 4);

    const blockTop = cursorY;
    cursorY = blockTop + 4;
    writeText(`${questionNumber}. ${question.question}`, {
      fontStyle: "bold",
      gapAfter: 8,
      indent: 0,
    });

    const normalizedType = question.type.toLowerCase();
    const optionList = Array.isArray(question.options)
      ? question.options.filter((option) => option.trim().length > 0)
      : [];

    if (optionList.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("Choices", PAGE_MARGIN, cursorY);
      cursorY += 14;
      optionList.forEach((option, optionIndex) => {
        drawChoiceRow(String.fromCharCode(65 + optionIndex), option);
      });
    } else if (normalizedType === "true-false") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("Choices", PAGE_MARGIN, cursorY);
      cursorY += 14;
      drawChoiceRow("A", "True");
      drawChoiceRow("B", "False");
    } else {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("Answer", PAGE_MARGIN, cursorY);
      cursorY += 12;
      writeBlankLines(normalizedType === "problem-solving" ? 4 : 2, 18);
    }

    cursorY = blockTop + blockHeight + BLOCK_SPACING;
  };

  const addPageFooters = () => {
    const pageCount = pdf.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      pdf.setPage(pageNumber);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(
        `Page ${pageNumber} of ${pageCount}`,
        pageWidth - PAGE_MARGIN,
        pageHeight - 20,
        { align: "right" }
      );
      pdf.text(`${subjectLabel} • ${levelLabel}`, PAGE_MARGIN, pageHeight - 20);
    }
  };

  const sections = quiz.sections && quiz.sections.length > 0
    ? quiz.sections
    : [{ id: "default-section", title: "Questions", description: "" }];

  const sectionLookup = new Map<string, PrintableSection>();
  sections.forEach((section) => {
    sectionLookup.set(section.id, section);
    sectionLookup.set(normalizeKey(section.title), section);
  });

  const questionsBySection = new Map<string, PrintableQuestion[]>();
  sections.forEach((section) => {
    questionsBySection.set(section.id, []);
  });

  const fallbackSection = sections[0];
  quiz.questions.forEach((question) => {
    const matchedSection =
      (question.sectionId && sectionLookup.get(question.sectionId)) ||
      sectionLookup.get(normalizeKey(question.sectionTitle)) ||
      fallbackSection;

    const bucket = questionsBySection.get(matchedSection.id) ?? [];
    bucket.push(question);
    questionsBySection.set(matchedSection.id, bucket);
  });

  drawHeader();
  drawStudentInfoSection();

  let questionNumber = 1;

  sections.forEach((section, sectionIndex) => {
    const sectionQuestions = questionsBySection.get(section.id) ?? [];
    if (!sectionQuestions.length) {
      return;
    }

    if (sectionIndex > 0) {
      cursorY += SECTION_SPACING;
    }

    drawSectionHeader(section, sectionIndex);

    sectionQuestions.forEach((question) => {
      drawQuestionBlock(questionNumber, question);
      questionNumber += 1;
    });
  });

  addPageFooters();

  const fileName = `${sanitizeFileName(quiz.title || "quiz")}_${sanitizeFileName(subjectLabel)}.pdf`;
  pdf.save(fileName);
}
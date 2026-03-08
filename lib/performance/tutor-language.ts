export type TutorLanguage = "en" | "tl";

const ACCURACY_WORD_MAP: Record<string, string> = {
  "very clear": "napakalinaw",
  clear: "malinaw",
  "getting better": "gumagaling",
  "still a bit shaky": "medyo alangan pa",
  "still needs help": "kailangan pa ng tulong",
};

const OVERALL_WORD_MAP: Record<string, string> = {
  excellent: "napakahusay",
  great: "maganda",
  good: "maayos",
  fair: "pwede pa",
  "still improving": "patuloy pang gumagaling",
};

const SPEED_WORD_MAP: Record<string, string> = {
  "very smooth": "napakaganda ng daloy",
  smooth: "maganda ang daloy",
  okay: "ayos ang daloy",
  "a little slow": "medyo mabagal ang daloy",
  "slow for now": "mabagal pa sa ngayon",
};

const applyMathFriendlyReplacements = (value: string): string => {
  return value
    .replace(/Please enter your answer first\./gi, "Ilagay muna ang sagot mo.")
    .replace(/Excellent speed and accuracy!?/gi, "Ang galing! Mabilis at tama ang sagot mo!")
    .replace(/Good job! Try to be faster next time\./gi, "Good job! Subukan nating mas bumilis pa sa susunod.")
    .replace(/Correct! But a bit slow/gi, "Tama! Medyo mabagal lang, pero okay lang.")
    .replace(/Nice try! Let's solve it together using the formula\./gi, "Nice try! Tara, sagutan natin ito gamit ang formula.")
    .replace(/Formula:/gi, "Pormula:")
    .replace(/Re-read the problem and solve it step by step\./gi, "Basahin ulit ang problem at sagutan nang paisa-isa.")
    .replace(/Start with /gi, "Magsimula sa ")
    .replace(/Add /gi, "Idagdag ang ")
    .replace(/Take away /gi, "Ibawas ang ")
    .replace(/That makes /gi, "Kaya ang sagot ay ")
    .replace(/That leaves /gi, "Ang matitira ay ")
    .replace(/We are multiplying /gi, "Minu-multiply natin ang ")
    .replace(/Think of /gi, "Isipin na ")
    .replace(/That equals /gi, "Ang sagot ay ")
    .replace(/We are dividing /gi, "Hinahati natin ang ")
    .replace(/Split /gi, "Hatiin ang ")
    .replace(/Each group has /gi, "Bawat grupo ay may ")
    .replace(/Count forward /gi, "Magbilang pasulong ng ")
    .replace(/ step(s)?\./gi, " hakbang.")
    .replace(/Say the new number you land on\./gi, "Sabihin ang bagong numerong nakuha mo.");
};

const translateReadingSentence = (sentence: string): string => {
  const niceWorkMatch = sentence.match(/^Nice work,\s*(.+?) is improving little by little\.$/i);
  if (niceWorkMatch) {
    return `Magandang effort, unti-unting gumagaling si ${niceWorkMatch[1]}.`;
  }

  const hoorayMatch = sentence.match(/^Hooray,\s*(.+?)'s reading sounds (.+?) today and the flow is (.+?)\.$/i);
  if (hoorayMatch) {
    const name = hoorayMatch[1];
    const overallWord = OVERALL_WORD_MAP[(hoorayMatch[2] ?? "").toLowerCase()] ?? hoorayMatch[2];
    const speedWord = SPEED_WORD_MAP[(hoorayMatch[3] ?? "").toLowerCase()] ?? hoorayMatch[3];
    return `Hooray, ${overallWord} ang basa ni ${name} ngayon at ${speedWord}.`;
  }

  const goodTryMatch = sentence.match(/^Good try today,\s*(.+?) is still learning, and that's okay\.$/i);
  if (goodTryMatch) {
    return `Good try today, nag-aaral pa si ${goodTryMatch[1]}, at okay lang iyon.`;
  }

  const readingMatch = sentence.match(
    /^Word reading is (.+?), so let's focus on tricky words(?: like (.+?))? and keep practicing those words together\.$/i,
  );
  if (readingMatch) {
    const accuracyWord = ACCURACY_WORD_MAP[(readingMatch[1] ?? "").toLowerCase()] ?? readingMatch[1];
    const difficultWords = (readingMatch[2] ?? "").trim();
    if (difficultWords) {
      return `Sa pagbasa ng words, ${accuracyWord}, kaya tutukan natin ang mahihirap na salita tulad ng ${difficultWords} at tuloy-tuloy lang sa practice.`;
    }
    return `Sa pagbasa ng words, ${accuracyWord}, kaya tutukan natin ang mahihirap na salita at tuloy-tuloy lang sa practice.`;
  }

  const nextSlideStrongMatch = sentence.match(
    /^Based on recent work,\s*(.+?) can likely do very well on the next slide\.$/i,
  );
  if (nextSlideStrongMatch) {
    return `Base sa mga huling gawa, malaki ang chance na sobrang galing ni ${nextSlideStrongMatch[1]} sa susunod na slide.`;
  }

  const nextSlideGoodMatch = sentence.match(
    /^Based on recent work,\s*(.+?) can likely do well on the next slide\.$/i,
  );
  if (nextSlideGoodMatch) {
    return `Base sa mga huling gawa, malaki ang chance na maganda ang performance ni ${nextSlideGoodMatch[1]} sa susunod na slide.`;
  }

  const nextSlideImproveMatch = sentence.match(
    /^Based on recent work,\s*(.+?) can improve on the next slide with a little guidance\.$/i,
  );
  if (nextSlideImproveMatch) {
    return `Base sa mga huling gawa, puwedeng mas gumaling si ${nextSlideImproveMatch[1]} sa susunod na slide kung may kaunting gabay.`;
  }

  const nextSlideSupportMatch = sentence.match(
    /^Based on recent work,\s*(.+?) may need extra guidance before moving to the next slide\.$/i,
  );
  if (nextSlideSupportMatch) {
    return `Base sa mga huling gawa, baka kailangan pa ni ${nextSlideSupportMatch[1]} ng dagdag na gabay bago lumipat sa susunod na slide.`;
  }

  const guidedTryMatch = sentence.match(/^With one more guided try,\s*(.+?) can do better on the next slide\.$/i);
  if (guidedTryMatch) {
    return `Sa isa pang guided na try, mas gagaling pa si ${guidedTryMatch[1]} sa susunod na slide.`;
  }

  return sentence;
};

export const translateTutorText = (text: string, language: TutorLanguage): string => {
  if (language === "en") return text;
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";

  const sentenceParts = trimmed.match(/[^.!?]+[.!?]?/g) ?? [trimmed];
  const translated = sentenceParts
    .map((part) => translateReadingSentence(part.trim()))
    .filter(Boolean)
    .join(" ");

  const withGenericReplacements = translated
    .replace(/Preparing feedback\.\.\./gi, "Inihahanda ang feedback...")
    .replace(/Record a slide to generate per-slide feedback\./gi, "Mag-record muna ng slide para makagawa ng feedback.")
    .replace(/\s+/g, " ")
    .trim();

  return applyMathFriendlyReplacements(withGenericReplacements);
};

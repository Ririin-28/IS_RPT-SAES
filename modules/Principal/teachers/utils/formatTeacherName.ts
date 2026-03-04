type NameParts = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
};

const KNOWN_SUFFIXES = new Set([
  "jr",
  "jr.",
  "sr",
  "sr.",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
]);

const normalizeToken = (value: unknown): string => String(value ?? "").trim();

const formatSuffix = (value: string): string => {
  const lower = value.toLowerCase();
  if (lower === "jr" || lower === "jr.") return "Jr.";
  if (lower === "sr" || lower === "sr.") return "Sr.";
  if (KNOWN_SUFFIXES.has(lower)) return value.toUpperCase();
  return value;
};

const extractNameParts = (teacher: any): NameParts => {
  const firstName = normalizeToken(teacher?.firstName ?? teacher?.firstname);
  const middleName = normalizeToken(teacher?.middleName ?? teacher?.middlename ?? teacher?.middleInitial);
  const lastName = normalizeToken(teacher?.lastName ?? teacher?.lastname ?? teacher?.surname);
  const suffix = normalizeToken(teacher?.suffix ?? teacher?.nameSuffix);

  if (firstName || middleName || lastName || suffix) {
    return { firstName, middleName, lastName, suffix };
  }

  const raw = normalizeToken(teacher?.name);
  if (!raw) {
    return { firstName: "", middleName: "", lastName: "", suffix: "" };
  }

  if (raw.includes(",")) {
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
    const rawLastName = parts[0] ?? "";
    const firstMiddle = (parts[1] ?? "").split(/\s+/).filter(Boolean);
    const rawFirstName = firstMiddle[0] ?? "";
    const rawMiddleName = firstMiddle.slice(1).join(" ");
    const trailing = parts[2] ?? "";
    const rawSuffix = KNOWN_SUFFIXES.has(trailing.toLowerCase()) ? trailing : "";

    return {
      firstName: rawFirstName,
      middleName: rawMiddleName,
      lastName: rawLastName,
      suffix: rawSuffix,
    };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return { firstName: "", middleName: "", lastName: "", suffix: "" };
  }
  if (tokens.length === 1) {
    return { firstName: tokens[0], middleName: "", lastName: "", suffix: "" };
  }

  const suffixCandidate = tokens[tokens.length - 1] ?? "";
  const rawSuffix = KNOWN_SUFFIXES.has(suffixCandidate.toLowerCase()) ? suffixCandidate : "";
  const baseTokens = rawSuffix ? tokens.slice(0, -1) : tokens;

  if (baseTokens.length === 1) {
    return { firstName: baseTokens[0], middleName: "", lastName: "", suffix: rawSuffix };
  }

  return {
    firstName: baseTokens[0] ?? "",
    middleName: baseTokens.slice(1, -1).join(" "),
    lastName: baseTokens[baseTokens.length - 1] ?? "",
    suffix: rawSuffix,
  };
};

export const formatTeacherFullName = (teacher: any): string => {
  const { firstName, middleName, lastName, suffix } = extractNameParts(teacher);

  if (!firstName && !lastName) {
    return normalizeToken(teacher?.name);
  }

  const middleInitial = middleName ? `${middleName.charAt(0).toUpperCase()}.` : "";
  const formattedSuffix = suffix ? formatSuffix(suffix) : "";

  const base = [lastName, firstName].filter(Boolean).join(", ");
  const trailing = [middleInitial, formattedSuffix].filter(Boolean).join(", ");
  return trailing ? `${base}, ${trailing}` : base;
};


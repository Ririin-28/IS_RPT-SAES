type FlashcardKeyContext = {
  activityId?: string | number | null;
  phonemicId?: string | number | null;
  userId?: string | number | null;
};

const normalizeKeyPart = (value?: string | number | null): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
};

export const buildFlashcardContentKey = (baseKey: string, context?: FlashcardKeyContext): string => {
  const parts = [baseKey];
  if (!context) return baseKey;

  const activity = normalizeKeyPart(context.activityId);
  const phonemic = normalizeKeyPart(context.phonemicId);
  const user = normalizeKeyPart(context.userId);

  if (activity) parts.push(`activity:${activity}`);
  if (phonemic) parts.push(`phonemic:${phonemic}`);
  if (user) parts.push(`user:${user}`);

  return parts.join(":");
};

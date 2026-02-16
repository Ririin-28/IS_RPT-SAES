let fallbackCounter = 0;

const candidateKeys = [
  "id",
  "accountId",
  "teacherId",
  "principalId",
  "masterTeacherId",
  "userId",
  "employeeId",
  "email",
  "username",
];

export const ensureArchiveRowKey = (item: any): string | undefined => {
  if (!item) return undefined;
  if (item.__archiveKey) return String(item.__archiveKey);

  for (const key of candidateKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
      const resolved = String(item[key]);
      item.__archiveKey = resolved;
      return resolved;
    }
  }

  const generated = `archive-item-${fallbackCounter++}`;
  item.__archiveKey = generated;
  return generated;
};

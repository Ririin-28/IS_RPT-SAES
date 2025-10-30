type ExportColumn<T> = {
  header: string;
  accessor: (row: T) => unknown;
};

interface ExportRowsOptions<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  sheetName?: string;
}

const sanitizeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

export async function exportRowsToExcel<T>({ rows, columns, filename, sheetName = "Sheet1" }: ExportRowsOptions<T>): Promise<void> {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn("exportRowsToExcel called without rows; skipping export.");
    return;
  }

  const XLSX = await import("xlsx");

  const normalizedRows = rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const column of columns) {
      const raw = column.accessor(row);
      record[column.header] = sanitizeValue(raw);
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export type { ExportColumn, ExportRowsOptions };

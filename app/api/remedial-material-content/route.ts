import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export const dynamic = "force-dynamic";

const CONTENT_TABLE = "remedial_material_content";

async function ensureContentTable(): Promise<void> {
  await query<ResultSetHeader>(
    `CREATE TABLE IF NOT EXISTS ${CONTENT_TABLE} (
      content_id INT PRIMARY KEY AUTO_INCREMENT,
      material_id INT NOT NULL,
      request_id INT NOT NULL,
      phonemic_id INT NOT NULL,
      file_path LONGTEXT NULL,
      extracted_slides_json LONGTEXT NOT NULL,
      flashcards_json LONGTEXT NOT NULL,
      flashcards_override_json LONGTEXT NULL,
      extraction_status ENUM('success','error') NOT NULL DEFAULT 'success',
      extraction_error TEXT NULL,
      extracted_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_material_id (material_id),
      KEY idx_request_phonemic (request_id, phonemic_id)
    )`,
    [],
  );
}

function parseIntOrNull(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = parseIntOrNull(searchParams.get("requestId"));
    const phonemicId = parseIntOrNull(searchParams.get("phonemicId"));

    if (!requestId || !phonemicId) {
      return NextResponse.json(
        { success: false, error: "requestId and phonemicId are required" },
        { status: 400 },
      );
    }

    await ensureContentTable();

    const [rows] = await query<RowDataPacket[]>(
      `SELECT * FROM ${CONTENT_TABLE} WHERE request_id = ? AND phonemic_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [requestId, phonemicId],
    );

    const row = rows[0] as any;
    if (!row) {
      return NextResponse.json({ success: true, found: false });
    }

    const extractedSlides = safeJsonParse(row.extracted_slides_json);
    const flashcards = safeJsonParse(row.flashcards_json);
    const flashcardsOverride = safeJsonParse(row.flashcards_override_json);

    return NextResponse.json({
      success: true,
      found: true,
      content: {
        materialId: row.material_id,
        requestId: row.request_id,
        phonemicId: row.phonemic_id,
        filePath: row.file_path,
        extractionStatus: row.extraction_status,
        extractionError: row.extraction_error,
        extractedAt: row.extracted_at,
        extractedSlides,
        flashcards,
        flashcardsOverride,
      },
    });
  } catch (error) {
    console.error("Failed to load remedial material content", error);
    return NextResponse.json(
      { success: false, error: "Failed to load remedial material content" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      requestId?: number | string;
      phonemicId?: number | string;
      materialId?: number | string;
      flashcardsOverride?: unknown;
    } | null;

    const requestId = body?.requestId ? Number.parseInt(String(body.requestId), 10) : null;
    const phonemicId = body?.phonemicId ? Number.parseInt(String(body.phonemicId), 10) : null;

    if (!requestId || !phonemicId) {
      return NextResponse.json(
        { success: false, error: "requestId and phonemicId are required" },
        { status: 400 },
      );
    }

    await ensureContentTable();

    const overrideJson = JSON.stringify(body?.flashcardsOverride ?? null);

    // Update the newest row for this request+phonemic.
    const [rows] = await query<RowDataPacket[]>(
      `SELECT material_id FROM ${CONTENT_TABLE} WHERE request_id = ? AND phonemic_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [requestId, phonemicId],
    );
    const row = rows[0] as any;
    const materialId = body?.materialId
      ? Number.parseInt(String(body.materialId), 10)
      : row?.material_id
        ? Number.parseInt(String(row.material_id), 10)
        : null;

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: "No extracted content found to update." },
        { status: 404 },
      );
    }

    await query<ResultSetHeader>(
      `UPDATE ${CONTENT_TABLE} SET flashcards_override_json = ?, updated_at = NOW() WHERE material_id = ?`,
      [overrideJson, materialId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save remedial material content", error);
    return NextResponse.json(
      { success: false, error: "Failed to save remedial material content" },
      { status: 500 },
    );
  }
}

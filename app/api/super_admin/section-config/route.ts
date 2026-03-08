import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { runWithConnection } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

export const dynamic = "force-dynamic";

const gradeSectionKeys = ["1", "2", "3", "4", "5", "6"] as const;
type GradeSectionKey = (typeof gradeSectionKeys)[number];
type GradeSectionConfig = Record<GradeSectionKey, string[]>;

const defaultSections = ["A", "B", "C", "D", "E", "F"];

const buildDefaultConfig = (): GradeSectionConfig => ({
  "1": [...defaultSections],
  "2": [...defaultSections],
  "3": [...defaultSections],
  "4": [...defaultSections],
  "5": [...defaultSections],
  "6": [...defaultSections],
});

const normalizeSectionList = (sections: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const section of sections) {
    const trimmed = String(section ?? "").trim();
    if (!trimmed) continue;

    const canonical = trimmed.toLowerCase();
    if (seen.has(canonical)) continue;

    seen.add(canonical);
    normalized.push(trimmed);
  }

  return normalized;
};

const normalizeConfig = (raw: unknown): GradeSectionConfig => {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fallback = buildDefaultConfig();

  return gradeSectionKeys.reduce((acc, grade) => {
    const value = source[grade];
    const list = Array.isArray(value) ? value.map((item) => String(item ?? "")) : fallback[grade];
    const normalized = normalizeSectionList(list);
    acc[grade] = normalized.length > 0 ? normalized : ["A"];
    return acc;
  }, {} as GradeSectionConfig);
};

const ensureSectionConfigTable = async (connection: PoolConnection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS super_admin_grade_sections (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      grade_level VARCHAR(10) NOT NULL,
      section_name VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_grade_section (grade_level, section_name),
      INDEX idx_grade_level (grade_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

const fetchSectionConfig = async (): Promise<GradeSectionConfig> => {
  type SectionRow = RowDataPacket & {
    grade_level: string;
    section_name: string;
  };

  return runWithConnection(async (connection) => {
    await ensureSectionConfigTable(connection);

    const [rows] = await connection.query<SectionRow[]>(
      `SELECT grade_level, section_name
       FROM super_admin_grade_sections
       ORDER BY CAST(grade_level AS UNSIGNED) ASC, section_name ASC`
    );

    if (!rows.length) {
      const defaults = buildDefaultConfig();
      const values: Array<string> = [];
      const placeholders: string[] = [];

      for (const grade of gradeSectionKeys) {
        for (const section of defaults[grade]) {
          placeholders.push("(?, ?)");
          values.push(grade, section);
        }
      }

      if (placeholders.length > 0) {
        await connection.query(
          `INSERT INTO super_admin_grade_sections (grade_level, section_name) VALUES ${placeholders.join(",")}`,
          values
        );
      }

      return defaults;
    }

    const grouped: GradeSectionConfig = {
      "1": [],
      "2": [],
      "3": [],
      "4": [],
      "5": [],
      "6": [],
    };

    for (const row of rows) {
      const grade = String(row.grade_level ?? "").trim() as GradeSectionKey;
      if (!gradeSectionKeys.includes(grade)) continue;
      grouped[grade].push(String(row.section_name ?? "").trim());
    }

    return normalizeConfig(grouped);
  });
};

export async function GET() {
  try {
    const data = await fetchSectionConfig();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load section configuration", error);
    return NextResponse.json(
      { success: false, error: "Failed to load section configuration" },
      { status: 500 }
    );
  }
}

type UpdateSectionsPayload = {
  type: "updateSections";
  sections: Record<string, string[]>;
};

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request, { permission: "super_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as UpdateSectionsPayload;
    if (body?.type !== "updateSections") {
      return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
    }

    const sections = normalizeConfig(body.sections);

    await runWithConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        await ensureSectionConfigTable(connection);
        await connection.query("DELETE FROM super_admin_grade_sections");

        const values: Array<string> = [];
        const placeholders: string[] = [];

        for (const grade of gradeSectionKeys) {
          for (const section of sections[grade]) {
            placeholders.push("(?, ?)");
            values.push(grade, section);
          }
        }

        if (placeholders.length > 0) {
          await connection.query(
            `INSERT INTO super_admin_grade_sections (grade_level, section_name) VALUES ${placeholders.join(",")}`,
            values
          );
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });

    return NextResponse.json({ success: true, data: sections });
  } catch (error) {
    console.error("Failed to update section configuration", error);
    return NextResponse.json(
      { success: false, error: "Failed to update section configuration" },
      { status: 500 }
    );
  }
}

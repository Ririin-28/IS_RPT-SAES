import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";

import { RowDataPacket } from "mysql2/promise";



export const dynamic = "force-dynamic";



export async function GET(request: NextRequest) {

  try {

    const { searchParams } = new URL(request.url);

    const subjectName = searchParams.get("subject");



    if (!subjectName) {

      return NextResponse.json({ success: false, error: "Subject is required" }, { status: 400 });

    }



    // Map subject name to subject_id (Assuming 1: English, 2: Filipino, 3: Math based on init script)

    const subjectMap: Record<string, number> = {

      "English": 1,

      "Filipino": 2,

      "Math": 3

    };



    const subjectId = subjectMap[subjectName];



    if (!subjectId) {

      // Fallback: search by name in subject table if it exists

      const [subjectRows] = await query<RowDataPacket[]>(

        "SELECT subject_id FROM subject WHERE subject_name LIKE ?",

        [`%${subjectName}%`]

      );

      if (subjectRows.length > 0) {

        // use found id

      }

    }



    const normalizedSubject = String(subjectName).trim();

    const expectedLevelsBySubject: Record<string, string[]> = {

      English: ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],

      Filipino: ["Non Reader", "Syllable", "Word", "Phrase", "Sentence", "Paragraph"],

      Math: ["Not Proficient", "Low Proficient", "Nearly Proficient", "Proficient", "Highly Proficient"],

    };



    const normalizeLevel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");



    const [rows] = await query<RowDataPacket[]>(

      "SELECT phonemic_id, level_name FROM phonemic_level WHERE subject_id = ? ORDER BY phonemic_id ASC",

      [subjectId || 0]

    );



    const expectedLevels = expectedLevelsBySubject[normalizedSubject] ?? [];

    const existingLevelKeys = new Set(

      rows

        .map((row) => (typeof row.level_name === "string" ? row.level_name : ""))

        .filter(Boolean)

        .map((level) => normalizeLevel(level)),

    );



    const missingLevels = expectedLevels.filter((level) => !existingLevelKeys.has(normalizeLevel(level)));



    if (missingLevels.length && subjectId) {

      for (const levelName of missingLevels) {

        await query(

          "INSERT INTO phonemic_level (subject_id, level_name) VALUES (?, ?)",

          [subjectId, levelName],

        );

      }

    }



    const [finalRows] = missingLevels.length

      ? await query<RowDataPacket[]>(

          "SELECT phonemic_id, level_name FROM phonemic_level WHERE subject_id = ? ORDER BY phonemic_id ASC",

          [subjectId || 0]

        )

      : [rows];



    const orderedRows = expectedLevels.length

      ? [...finalRows].sort((a, b) => {

          const aName = typeof a.level_name === "string" ? a.level_name : "";

          const bName = typeof b.level_name === "string" ? b.level_name : "";

          const aIndex = expectedLevels.findIndex((level) => normalizeLevel(level) === normalizeLevel(aName));

          const bIndex = expectedLevels.findIndex((level) => normalizeLevel(level) === normalizeLevel(bName));

          const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;

          const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;

          if (safeA !== safeB) return safeA - safeB;

          return String(aName).localeCompare(String(bName));

        })

      : finalRows;



    return NextResponse.json({ success: true, levels: orderedRows });

  } catch (error) {

    console.error("Failed to fetch levels", error);

    return NextResponse.json({ success: false, error: "Failed to load levels" }, { status: 500 });

  }

}


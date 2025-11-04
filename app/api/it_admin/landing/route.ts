import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { query, runWithConnection } from "@/lib/db";
import { getDefaultLandingConfig } from "@/lib/utils/landing-config";

const parseStoredAsset = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      const dataUrl = typeof parsed.dataUrl === "string" ? parsed.dataUrl : null;
      const name = typeof parsed.name === "string" ? parsed.name : null;
      return { dataUrl, name };
    }
  } catch (error) {
    // Treat as plain string
  }
  return { dataUrl: value, name: null };
};

const seedLandingTablesIfEmpty = async () => {
  const defaults = getDefaultLandingConfig();

  type CountRow = RowDataPacket & { total: number };

  await runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      const [imageCountRows] = await connection.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM landing_images"
      );
      const imageCount = Number(imageCountRows[0]?.total ?? 0);
      if (imageCount === 0) {
        for (const image of defaults.carouselImages) {
          const payload = JSON.stringify({ name: image.name, dataUrl: image.url });
          await connection.query("INSERT INTO landing_images (image) VALUES (?)", [payload]);
        }
      }

      const [logoCountRows] = await connection.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM landing_logo"
      );
      const logoCount = Number(logoCountRows[0]?.total ?? 0);
      if (logoCount === 0) {
        const payload = JSON.stringify({
          name: defaults.theme.logoFileName ?? "logo.png",
          dataUrl: defaults.theme.logoUrl,
        });
        await connection.query("INSERT INTO landing_logo (logo) VALUES (?)", [payload]);
      }

      const [detailsCountRows] = await connection.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM saes_details"
      );
      const detailsCount = Number(detailsCountRows[0]?.total ?? 0);
      if (detailsCount === 0) {
        await connection.query(
          "INSERT INTO saes_details (location, contact_no, email, facebook) VALUES (?, ?, ?, ?)",
          [
            defaults.contact.address,
            defaults.contact.phone,
            defaults.contact.email,
            defaults.contact.facebook,
          ]
        );
      }

      const [policyCountRows] = await connection.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM privacy_policy"
      );
      const policyCount = Number(policyCountRows[0]?.total ?? 0);
      if (policyCount === 0) {
        const payload = JSON.stringify({
          name: defaults.privacyPolicyName,
          dataUrl: `/${defaults.privacyPolicyName}`,
        });
        await connection.query("INSERT INTO privacy_policy (file) VALUES (?)", [payload]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
};

const fetchLandingData = async () => {
  type ImageRow = RowDataPacket & { id: number; image: string; created_at: string };
  type LogoRow = RowDataPacket & { id: number; logo: string; created_at: string };
  type DetailsRow = RowDataPacket & {
    id: number;
    location: string;
    contact_no: string;
    email: string;
    facebook: string | null;
    updated_at: string;
  };
  type PolicyRow = RowDataPacket & { id: number; file: string; created_at: string };

  const [carouselRows] = await query<ImageRow[]>(
    "SELECT id, image, created_at FROM landing_images ORDER BY created_at DESC"
  );
  const [logoRows] = await query<LogoRow[]>(
    "SELECT id, logo, created_at FROM landing_logo ORDER BY created_at DESC LIMIT 1"
  );
  const [detailRows] = await query<DetailsRow[]>(
    "SELECT id, location, contact_no, email, facebook, updated_at FROM saes_details ORDER BY updated_at DESC LIMIT 1"
  );
  const [policyRows] = await query<PolicyRow[]>(
    "SELECT id, file, created_at FROM privacy_policy ORDER BY created_at DESC LIMIT 1"
  );

  const carouselImages = carouselRows.map((row) => {
    const asset = parseStoredAsset(row.image);
    return {
      id: row.id,
      image: row.image,
      dataUrl: asset?.dataUrl ?? null,
      name: asset?.name ?? null,
      createdAt: row.created_at,
    };
  });

  const logoRow = logoRows[0];
  const logo = logoRow
    ? (() => {
        const asset = parseStoredAsset(logoRow.logo);
        return {
          id: logoRow.id,
          logo: logoRow.logo,
          dataUrl: asset?.dataUrl ?? null,
          name: asset?.name ?? null,
          createdAt: logoRow.created_at,
        };
      })()
    : null;

  const saesDetails = detailRows[0] ?? null;

  const policyRow = policyRows[0];
  const privacyPolicy = policyRow
    ? (() => {
        const asset = parseStoredAsset(policyRow.file);
        return {
          id: policyRow.id,
          file: policyRow.file,
          dataUrl: asset?.dataUrl ?? null,
          name: asset?.name ?? null,
          createdAt: policyRow.created_at,
        };
      })()
    : null;

  return {
    carouselImages,
    logo,
    saesDetails,
    privacyPolicy,
  };
};

export async function GET() {
  try {
    await seedLandingTablesIfEmpty();
    const data = await fetchLandingData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load landing configuration", error);
    return NextResponse.json({ error: "Failed to load landing configuration" }, { status: 500 });
  }
}

type UpdateLandingPayload = {
  type: "updateLanding";
  contact?: {
    location?: string;
    contactNo?: string;
    email?: string;
    facebook?: string;
  };
  carousel?: {
    keepIds?: number[];
    removedIds?: number[];
    newImages?: Array<{ name?: string; dataUrl: string }>;
  };
  privacyPolicy?: { name?: string; dataUrl: string } | null;
};

type UpdateLogoPayload = {
  type: "updateLogo";
  logo: {
    name?: string;
    dataUrl: string;
  };
};

const normalizeNumberArray = (values?: number[]) =>
  Array.isArray(values) ? values.map((value) => Number(value)).filter((value) => Number.isFinite(value)) : [];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateLandingPayload | UpdateLogoPayload;
    if (body.type === "updateLanding") {
      await runWithConnection(async (connection) => {
        await connection.beginTransaction();
        try {
          const { contact, carousel, privacyPolicy } = body;

          if (contact) {
            const location = contact.location ?? "";
            const contactNo = contact.contactNo ?? "";
            const email = contact.email ?? "";
            const facebook = contact.facebook ?? "";

            const [existing] = await connection.query<RowDataPacket[]>(
              "SELECT id FROM saes_details ORDER BY updated_at DESC LIMIT 1"
            );
            if (existing.length > 0) {
              await connection.query(
                "UPDATE saes_details SET location = ?, contact_no = ?, email = ?, facebook = ? WHERE id = ?",
                [location, contactNo, email, facebook, existing[0].id]
              );
            } else {
              await connection.query(
                "INSERT INTO saes_details (location, contact_no, email, facebook) VALUES (?, ?, ?, ?)",
                [location, contactNo, email, facebook]
              );
            }
          }

          if (carousel) {
            const removedIds = normalizeNumberArray(carousel.removedIds);
            if (removedIds.length > 0) {
              const placeholders = removedIds.map(() => "?").join(",");
              await connection.query(`DELETE FROM landing_images WHERE id IN (${placeholders})`, removedIds);
            }

            if (Array.isArray(carousel.newImages)) {
              for (const image of carousel.newImages) {
                if (!image?.dataUrl) continue;
                const payload = JSON.stringify({ name: image.name ?? null, dataUrl: image.dataUrl });
                await connection.query("INSERT INTO landing_images (image) VALUES (?)", [payload]);
              }
            }
          }

          if (privacyPolicy?.dataUrl) {
            const payload = JSON.stringify({ name: privacyPolicy.name ?? null, dataUrl: privacyPolicy.dataUrl });
            await connection.query("INSERT INTO privacy_policy (file) VALUES (?)", [payload]);
          }

          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      });
    } else if (body.type === "updateLogo") {
      const payload = JSON.stringify({ name: body.logo.name ?? null, dataUrl: body.logo.dataUrl });
      await query("INSERT INTO landing_logo (logo) VALUES (?)", [payload]);
    } else {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const data = await fetchLandingData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to update landing configuration", error);
    return NextResponse.json({ error: "Failed to update landing configuration" }, { status: 500 });
  }
}

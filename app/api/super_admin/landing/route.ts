import { NextResponse } from "next/server";
import type { Connection, PoolConnection, RowDataPacket } from "mysql2/promise";
import { query, runWithConnection } from "@/lib/db";
import { getDefaultLandingConfig } from "@/lib/utils/landing-config";
import { requireSuperAdmin } from "@/lib/server/super-admin-auth";

const parseStoredAsset = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      const dataUrl = typeof parsed.dataUrl === "string" ? parsed.dataUrl : null;
      const name = typeof parsed.name === "string" ? parsed.name : null;
      return { dataUrl, name };
    }
  } catch {
    // Treat as plain string
  }
  return { dataUrl: value, name: null };
};

const getFallbackLandingData = () => {
  const defaults = getDefaultLandingConfig();

  return {
    carouselImages: defaults.carouselImages.map((image) => ({
      id: image.id,
      image: image.url,
      dataUrl: image.url,
      name: image.name,
      createdAt: image.uploadedAt,
    })),
    logo: {
      id: "default-logo",
      logo: defaults.theme.logoUrl,
      dataUrl: defaults.theme.logoUrl,
      name: defaults.theme.logoFileName ?? null,
      createdAt: null,
    },
    saesDetails: {
      location: defaults.contact.address,
      contact_no: defaults.contact.phone,
      email: defaults.contact.email,
      facebook: defaults.contact.facebook,
      updated_at: null,
    },
    privacyPolicy: {
      id: "default-policy",
      file: `/${defaults.privacyPolicyName}`,
      dataUrl: `/${defaults.privacyPolicyName}`,
      name: defaults.privacyPolicyName,
      createdAt: null,
    },
  };
};

const isDbConnectionError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return (
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EHOSTUNREACH" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ECONNRESET"
  );
};

let landingSchemaPrepared = false;

const ensureLandingTables = async (connection: Connection | PoolConnection) => {
  if (landingSchemaPrepared) return;

  await connection.query(`
    CREATE TABLE IF NOT EXISTS landing_images (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      image LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_landing_images_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS landing_logo (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      logo LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_landing_logo_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS saes_details (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      location VARCHAR(255) NOT NULL,
      contact_no VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      facebook VARCHAR(500) DEFAULT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS privacy_policy (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      file LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_privacy_policy_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  landingSchemaPrepared = true;
};

const seedLandingTablesIfEmpty = async () => {
  const defaults = getDefaultLandingConfig();

  type CountRow = RowDataPacket & { total: number };

  await runWithConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      await ensureLandingTables(connection);
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
    if (isDbConnectionError(error)) {
      const data = getFallbackLandingData();
      return NextResponse.json({ data, fallback: true });
    }
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
  const auth = await requireSuperAdmin(request, { permission: "super_admin:content.manage" });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as UpdateLandingPayload | UpdateLogoPayload;
    if (body.type === "updateLanding") {
      await runWithConnection(async (connection) => {
        await connection.beginTransaction();
        try {
          await ensureLandingTables(connection);
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
      await runWithConnection(async (connection) => {
        await ensureLandingTables(connection);
        await connection.query("INSERT INTO landing_logo (logo) VALUES (?)", [payload]);
      });
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

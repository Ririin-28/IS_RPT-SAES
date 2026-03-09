export const siteConfig = {
  name: "RPT-SAES",
  shortName: "RPT-SAES",
  title: "RPT-SAES | Remedial Performance Tracker for San Agustin Elementary School",
  description:
    "RPT-SAES helps San Agustin Elementary School manage student assessment, remedial learning, and student progress tracking in one platform.",
  schoolName: "San Agustin Elementary School",
  address: "Heavenly Drive St., San Agustin, Novaliches, Quezon City",
  locale: "en_PH",
  themeColor: "#013300",
  keywords: [
    "RPT-SAES",
    "rpt-saes",
    "RPT SAES system",
    "rptsaes",
    "rpt",
    "saes",
    "perrformance tracker",
    "RPTSAES",
    "RPT SAES",
    "RPT-SAES system",
    "Remedial Performance Tracker",
    "Remedial Performance Tracker SAES",
    "San Agustin Elementary School system",
    "student remedial tracking system",
    "remedial learning platform",
    "student progress tracking",
     "education technology Philippines",
    "student assessment system",
    "remedial learning platform",
    "San Agustin Elementary School",
    "education technology",
    "student progress tracking",
    "remedial program management",
  ],
  ogImage: "/RPT-SAES/RPTLogo.png",
} as const;

const DEFAULT_SITE_URL =
  process.env.NODE_ENV === "production"
    ? "https://www.rpt-saes.online"
    : "http://localhost:3000";

export function getSiteUrl(): URL {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL;

  const normalizedUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  try {
    return new URL(normalizedUrl);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

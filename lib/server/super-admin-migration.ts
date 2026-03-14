export type { DbConnection } from "@/lib/server/it-admin-migration";
export {
  CANONICAL_IT_ADMIN_ROLE,
  IT_ADMIN_ROLE_LABEL,
  LEGACY_IT_ADMIN_ROLE_NAMES,
  ensureItAdminPhaseOneMigration as ensureSuperAdminPhaseOneMigration,
  isLegacyItAdminRoleName,
  normalizeLegacyItAdminRoleName,
} from "@/lib/server/it-admin-migration";

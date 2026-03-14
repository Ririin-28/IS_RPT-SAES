export type {
  ItAdminAuthResult as SuperAdminAuthResult,
  ItAdminPermissionRequest as SuperAdminPermission,
} from "@/lib/server/it-admin-auth";
export {
  normalizeRequestedItAdminPermission,
  requireItAdmin as requireSuperAdmin,
} from "@/lib/server/it-admin-auth";

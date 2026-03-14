export type ItAdminPermission =
  | "it_admin:accounts.manage"
  | "it_admin:data.archive"
  | "it_admin:data.restore"
  | "it_admin:data.delete"
  | "it_admin:dashboard.view"
  | "it_admin:logs.view"
  | "it_admin:profile.manage"
  | "it_admin:content.manage"
  | "it_admin:maintenance.execute";

export type LegacySuperAdminPermission =
  | "super_admin:accounts.manage"
  | "super_admin:data.archive"
  | "super_admin:data.restore"
  | "super_admin:data.delete"
  | "super_admin:dashboard.view"
  | "super_admin:logs.view"
  | "super_admin:profile.manage"
  | "super_admin:content.manage"
  | "super_admin:maintenance.execute";

export type ItAdminPermissionRequest = ItAdminPermission | LegacySuperAdminPermission;

export const IT_ADMIN_PERMISSION_SET: Set<ItAdminPermission> = new Set([
  "it_admin:accounts.manage",
  "it_admin:data.archive",
  "it_admin:data.restore",
  "it_admin:data.delete",
  "it_admin:dashboard.view",
  "it_admin:logs.view",
  "it_admin:profile.manage",
  "it_admin:content.manage",
  "it_admin:maintenance.execute",
]);

export function normalizeRequestedItAdminPermission(
  permission?: ItAdminPermissionRequest,
): ItAdminPermission | undefined {
  if (!permission) {
    return undefined;
  }
  if (permission.startsWith("super_admin:")) {
    return permission.replace("super_admin:", "it_admin:") as ItAdminPermission;
  }
  return permission as ItAdminPermission;
}

import {
  CANONICAL_IT_ADMIN_ROLE,
  IT_ADMIN_ROLE_LABEL,
  buildUserLinkedAdminSyncSql,
  isLegacyItAdminRoleName,
  normalizeLegacyItAdminRoleName,
} from "../lib/server/it-admin-migration";

describe("IT admin migration helpers", () => {
  test("normalizes legacy role spellings to shared identifiers", () => {
    expect(normalizeLegacyItAdminRoleName("IT Admin")).toBe("it_admin");
    expect(normalizeLegacyItAdminRoleName("super-admin")).toBe("super_admin");
    expect(normalizeLegacyItAdminRoleName(" admin ")).toBe("admin");
  });

  test("recognizes legacy admin aliases during staged migration", () => {
    expect(isLegacyItAdminRoleName("IT Admin")).toBe(true);
    expect(isLegacyItAdminRoleName("super_admin")).toBe(true);
    expect(isLegacyItAdminRoleName("super admin")).toBe(true);
    expect(isLegacyItAdminRoleName("teacher")).toBe(false);
  });

  test("exports canonical admin identifiers", () => {
    expect(CANONICAL_IT_ADMIN_ROLE).toBe("it_admin");
    expect(IT_ADMIN_ROLE_LABEL).toBe("IT Admin");
  });

  test("builds user-linked sync SQL that skips orphaned admin rows", () => {
    const sql = buildUserLinkedAdminSyncSql("super_admin", "it_admin", ["it_admin_id", "user_id"]);

    expect(sql).toContain("INSERT IGNORE INTO `it_admin` (`it_admin_id`, `user_id`)");
    expect(sql).toContain("SELECT source.`it_admin_id`, source.`user_id`");
    expect(sql).toContain("FROM `super_admin` AS source");
    expect(sql).toContain("INNER JOIN `users` AS users_ref ON users_ref.user_id = source.user_id");
    expect(sql).toContain("WHERE source.user_id IS NOT NULL");
    expect(sql).toContain("SELECT 1 FROM `it_admin` AS target WHERE target.user_id = source.user_id");
  });
});

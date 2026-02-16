import { normalizeRoleName, resolveCanonicalRole, resolvePortalPath } from "../lib/server/role-resolution";

describe("role resolution", () => {
  test("normalizes role names with separators", () => {
    expect(normalizeRoleName("Super Admin")).toBe("super_admin");
    expect(normalizeRoleName("it-admin")).toBe("it_admin");
    expect(normalizeRoleName(" IT/Admin ")).toBe("it_admin");
  });

  test("canonicalizes legacy admin aliases to super_admin", () => {
    expect(resolveCanonicalRole("admin")).toBe("super_admin");
    expect(resolveCanonicalRole("it_admin")).toBe("super_admin");
    expect(resolveCanonicalRole("itadmin")).toBe("super_admin");
    expect(resolveCanonicalRole("superadmin")).toBe("super_admin");
  });

  test("keeps non-admin roles canonical", () => {
    expect(resolveCanonicalRole("principal")).toBe("principal");
    expect(resolveCanonicalRole("teacher")).toBe("teacher");
  });

  test("resolves portal path using canonical roles", () => {
    expect(resolvePortalPath("admin")).toBe("/IT_Admin/welcome");
    expect(resolvePortalPath("it_admin")).toBe("/IT_Admin/welcome");
    expect(resolvePortalPath("super_admin")).toBe("/IT_Admin/welcome");
    expect(resolvePortalPath("principal")).toBe("/Principal/welcome");
  });
});

export const VEGA_ROLES = ["STUDENT", "COMPANY", "TPO", "ADMIN", "SUPER_ADMIN"] as const;
export type VegaRole = typeof VEGA_ROLES[number];

export const roleCapabilities: Record<VegaRole, ReadonlySet<string>> = {
  STUDENT: new Set(["student:self", "jobs:read", "assessments:attempt", "interviews:join"]),
  COMPANY: new Set(["company:self", "jobs:manage", "applications:manage", "assessments:manage", "interviews:manage"]),
  TPO: new Set(["tpo:self", "students:college", "assessments:college", "reports:college"]),
  ADMIN: new Set(["admin:platform"]),
  SUPER_ADMIN: new Set(["admin:platform", "admin:security"]),
};

export function isVegaRole(value: unknown): value is VegaRole {
  return typeof value === "string" && (VEGA_ROLES as readonly string[]).includes(value);
}

export function hasCapability(role: VegaRole, capability: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  return roleCapabilities[role].has(capability);
}

export function isAdministrative(role: VegaRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

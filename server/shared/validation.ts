import { ValidationError } from "./errors.ts";

export function positiveInt(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ValidationError(`${field} must be a positive integer`);
  return parsed;
}

export function boundedInt(value: unknown, field: string, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function pagination(query: any, defaults = { page: 1, limit: 25 }, maxLimit = 100) {
  const page = boundedInt(query?.page, "page", defaults.page, 1, 1_000_000);
  const limit = boundedInt(query?.limit, "limit", defaults.limit, 1, maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

export function nonEmptyString(value: unknown, field: string, maxLength = 10_000): string {
  if (typeof value !== "string") throw new ValidationError(`${field} is required`);
  const normalized = value.trim();
  if (!normalized) throw new ValidationError(`${field} is required`);
  if (normalized.length > maxLength) throw new ValidationError(`${field} must be at most ${maxLength} characters`);
  return normalized;
}

export function optionalString(value: unknown, field: string, maxLength = 10_000): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new ValidationError(`${field} must be at most ${maxLength} characters`);
  return normalized;
}

export function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

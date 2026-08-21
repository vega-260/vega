/**
 * Enterprise Form Validation Utilities
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
export const PHONE_DIGITS_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;
export const URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i;

// Text / Name / Location regexes for input sanitation validation
export const TEXT_SAFE_REGEX = /^[a-zA-Z0-9\s.,'()&/-]+$/;
export const NAME_SAFE_REGEX = /^[a-zA-Z][a-zA-Z\s.,'-]{1,99}$/;
export const LOCATION_SAFE_REGEX = /^[a-zA-Z0-9\s.,'-]+$/;
export const COLLEGE_CODE_REGEX = /^[A-Za-z0-9_-]{2,30}$/;

/**
 * Validates whether text contains only safe printable text characters (letters, numbers, spaces, standard punctuation)
 */
export function isValidText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return TEXT_SAFE_REGEX.test(text.trim());
}

/**
 * Validates whether name contains only valid name characters
 */
export function isValidName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  return NAME_SAFE_REGEX.test(name.trim());
}

/**
 * Validates whether location (district, state, country) contains only valid location characters
 */
export function isValidLocation(location: string): boolean {
  if (!location || typeof location !== 'string') return false;
  return LOCATION_SAFE_REGEX.test(location.trim());
}

/**
 * Validates whether an email is properly formatted
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Validates phone numbers (7 to 15 digits, no invalid special characters)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!PHONE_DIGITS_REGEX.test(trimmed)) return false;
  const digitsOnly = trimmed.replace(/\D/g, '');
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

/**
 * Validates website URLs (allows with or without http/https protocol)
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return URL_REGEX.test(trimmed);
}

/**
 * Validates college codes (alphanumeric and dashes/underscores)
 */
export function isValidCollegeCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  return COLLEGE_CODE_REGEX.test(trimmed);
}

/**
 * Common validation utilities for inputs across the platform.
 */

/**
 * Validates whether a given string is a valid web URL or uploaded asset URL.
 * Accepts:
 * - Full URLs (http://, https://)
 * - Domain-prefixed URLs (e.g., drive.google.com, www.example.com, example.com/path?foo=bar)
 * - Local/relative uploaded file paths (e.g., /uploads/certificates/..., /api/...)
 * - Data or blob URIs (blob:..., data:...)
 * Returns true if empty/null (to allow optional fields), but false if invalid text is provided.
 */
export function isValidUrl(urlString?: string | null): boolean {
  if (!urlString) return true;
  const trimmed = urlString.trim();
  if (!trimmed) return true;

  // Any whitespace within the URL string is invalid
  if (/\s/.test(trimmed)) {
    return false;
  }

  // Allow relative asset paths from local uploads or API endpoints or blob/data URLs
  if (
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return true;
  }

  // Reject strings starting with single slashes that aren't uploads/api or invalid chars
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return false;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (!parsed.hostname) return false;

    // Check valid hostname: localhost, IPv4/IPv6, or standard domain name with valid TLD
    const isLocalhost = parsed.hostname === 'localhost';
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname) || parsed.hostname.startsWith('[');
    // Domain name must have at least one period separating name and TLD (e.g. google.com, drive.google.com)
    const hasValidDomain = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(parsed.hostname);

    return isLocalhost || isIp || hasValidDomain;
  } catch {
    return false;
  }
}

/**
 * Ensures a URL starts with http:// or https:// if provided (unless it is a local upload path or blob/data URL).
 */
export function normalizeUrl(urlString?: string | null): string {
  if (!urlString) return "";
  const trimmed = urlString.trim();
  if (!trimmed) return "";
  if (
    /^https?:\/\//i.test(trimmed) || 
    trimmed.startsWith('/') || 
    trimmed.startsWith('blob:') || 
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Validates whether an entered grade/score format is valid.
 * Accepts:
 * - CGPA / GPA (e.g., 9.8, 8.07, 9.8 CGPA, 8.5 GPA, GPA 3.8, 3.8/4.0, 9.5/10)
 * - Percentage (e.g., 92%, 88.5%, 85 %)
 * - Scale/Fraction marks (e.g., 85/100, 450/500)
 * - Letter grades (e.g., A+, A, A-, B+, B, B-, C+, C, C-, D, E, F, O, S, A*, A++)
 * - Academic honors/divisions (e.g., First Class with Distinction, First Class, Second Class, Distinction, Pass)
 * Rejects text like "ABC", URLs, script injections, or arbitrary text.
 */
export function isValidGrade(gradeStr?: string | null): boolean {
  if (!gradeStr) return true;
  const trimmed = String(gradeStr).trim();
  if (!trimmed) return true;

  // Reject URLs or web addresses
  if (
    trimmed.includes("://") ||
    /^https?:\/\//i.test(trimmed) ||
    /www\./i.test(trimmed) ||
    /\.(com|org|net|edu|gov|io|co|in|app|dev|me|ai|tech|online|site)(\/|$|\?)/i.test(trimmed)
  ) {
    return false;
  }

  // Reject overly long input
  if (trimmed.length > 50) return false;

  // 1. Check for standard letter grades (e.g. A+, A, A-, B+, B, B-, C+, C, C-, D, E, F, O, S, A*, A++)
  const letterGradeRegex = /^(?:grade\s*[:\-]?\s*)?(A\+{1,2}|A\*|A\-|A|B\+|B\-|B|C\+|C\-|C|D\+|D\-|D|E|F|O|S)$/i;
  if (letterGradeRegex.test(trimmed)) {
    return true;
  }

  // 2. Check for standard academic classifications
  const standingRegex = /^(?:grade\s*[:\-]?\s*)?(first class with distinction|first class with honours|first class|second class|third class|distinction|first division|second division|third division|pass class|pass|passed|merit|honours|honors|satisfactory|outstanding|excellent|very good|good)$/i;
  if (standingRegex.test(trimmed)) {
    return true;
  }

  // 3. Check for percentage format: e.g. "92%", "88.5%", "100%", "85.75 %"
  const percentageRegex = /^(?:(?:percentage|score|marks)\s*[:\-]?\s*)?(100(?:\.0{1,2})?|[0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%(?:age)?$/i;
  if (percentageRegex.test(trimmed)) {
    return true;
  }

  // 4. Check for fraction/scale format: e.g. "9.8/10", "8.5 / 10 CGPA", "85/100", "450/500", "3.8/4.0", "3.8 / 4"
  const fractionMatch = trimmed.match(/^(?:(?:cgpa|gpa|grade|score|marks)\s*[:\-]?\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*(?:cgpa|gpa|marks|%))?$/i);
  if (fractionMatch) {
    const score = parseFloat(fractionMatch[1]);
    const total = parseFloat(fractionMatch[2]);
    if (!isNaN(score) && !isNaN(total) && total > 0 && score <= total && score >= 0) {
      return true;
    }
    return false;
  }

  // 5. Check for numeric CGPA / GPA / Score format: e.g. "9.8", "8.07", "9.8 CGPA", "CGPA: 9.8", "GPA 3.85", "88.5"
  const numericMatch = trimmed.match(/^(?:(cgpa|gpa|grade|score|marks|percentage)\s*[:\-]?\s*)?(\d+(?:\.\d+)?)(?:\s*(cgpa|gpa|marks|%|percent))?$/i);
  if (numericMatch) {
    const num = parseFloat(numericMatch[2]);
    if (!isNaN(num)) {
      // Valid score range: between 0 and 100
      if (num >= 0 && num <= 100) {
        return true;
      }
    }
  }

  return false;
}

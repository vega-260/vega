import db from "../db.ts";

export interface CanonicalTalentScoreResult {
  talentScore: number | null;
  talentScoreStatus: "AVAILABLE" | "NOT_AVAILABLE" | "PENDING" | "FAILED";
  talentScoreSource: "PERSISTED" | "COMPLETED_ASSESSMENT" | "CANONICAL_FORMULA" | null;
  talentScoreUpdatedAt: string | null;
}

/**
 * Sanitizes and validates a raw talent score.
 * Enforces canonical boundaries:
 * - Real score: numeric, finite, 0 <= score <= 100.
 * - Genuine score 0 remains 0 (not converted to null/missing).
 * - Missing/null/undefined -> null with NOT_AVAILABLE status.
 * - Out-of-bounds / NaN / Infinity -> null with FAILED status.
 */
export function sanitizeTalentScore(
  rawScore: any,
  updatedAt?: any,
  sourceName: "PERSISTED" | "COMPLETED_ASSESSMENT" | "CANONICAL_FORMULA" = "PERSISTED"
): CanonicalTalentScoreResult {
  if (rawScore === null || rawScore === undefined || rawScore === "") {
    return {
      talentScore: null,
      talentScoreStatus: "NOT_AVAILABLE",
      talentScoreSource: null,
      talentScoreUpdatedAt: null
    };
  }

  const num = typeof rawScore === "number" ? rawScore : Number(rawScore);

  if (isNaN(num) || !isFinite(num) || num < 0 || num > 100) {
    return {
      talentScore: null,
      talentScoreStatus: "FAILED",
      talentScoreSource: null,
      talentScoreUpdatedAt: null
    };
  }

  return {
    talentScore: Math.round(num * 10) / 10, // Round to 1 decimal place max
    talentScoreStatus: "AVAILABLE",
    talentScoreSource: sourceName,
    talentScoreUpdatedAt: updatedAt ? new Date(updatedAt).toISOString() : null
  };
}

/**
 * Sorts candidate records deterministically by talent score.
 * - Real scores are sorted numerically in requested order ('desc' or 'asc').
 * - Missing/null scores are ALWAYS placed last.
 */
export function sortCandidatesByTalentScore(candidates: any[], order: "desc" | "asc" = "desc"): any[] {
  return [...candidates].sort((a, b) => {
    const rawA = a.talent_score ?? a.talentScore;
    const rawB = b.talent_score ?? b.talentScore;

    const resA = sanitizeTalentScore(rawA);
    const resB = sanitizeTalentScore(rawB);

    const hasA = resA.talentScoreStatus === "AVAILABLE" && resA.talentScore !== null;
    const hasB = resB.talentScoreStatus === "AVAILABLE" && resB.talentScore !== null;

    if (hasA && hasB) {
      const numA = resA.talentScore as number;
      const numB = resB.talentScore as number;
      return order === "desc" ? numB - numA : numA - numB;
    }

    if (hasA) return -1; // A comes first
    if (hasB) return 1;  // B comes first
    return 0; // both missing
  });
}

/**
 * Calculates average talent score across candidates, strictly excluding missing scores.
 * Also returns coverage count and total count.
 */
export function calculateTalentScoreMetrics(candidates: any[]): {
  averageScore: number | null;
  scoredCandidatesCount: number;
  totalCandidatesCount: number;
  scoreCoverageRatio: number;
} {
  let sum = 0;
  let count = 0;

  for (const c of candidates) {
    const raw = c.talent_score ?? c.talentScore;
    const res = sanitizeTalentScore(raw);
    if (res.talentScoreStatus === "AVAILABLE" && res.talentScore !== null) {
      sum += res.talentScore;
      count++;
    }
  }

  const total = candidates.length;
  const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  const ratio = total > 0 ? Math.round((count / total) * 100) / 100 : 0;

  return {
    averageScore: avg,
    scoredCandidatesCount: count,
    totalCandidatesCount: total,
    scoreCoverageRatio: ratio
  };
}

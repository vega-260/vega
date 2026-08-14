export const formatAssessmentScore = (score: any) => {
  if (score === null || score === undefined || score === "") return null;
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};

export const isRejectedCandidate = (candidate: any) =>
  String(candidate?.status || "").toUpperCase() === "REJECTED" || Boolean(candidate?.rejection_stage_id);

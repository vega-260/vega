import db from "../../db.ts";

export async function getStudentMetrics(userId: number) {
  let talentScore = 60;
  const [talRows]: any = await db.query("SELECT overall_score FROM talent_scores WHERE user_id = ?", [userId]);
  if (talRows && talRows.length > 0) {
    talentScore = talRows[0].overall_score;
  }

  let codingScore = 55;
  const [codRows]: any = await db.query("SELECT coding_score FROM coding_analysis WHERE user_id = ?", [userId]);
  if (codRows && codRows.length > 0) {
    codingScore = codRows[0].coding_score;
  }

  let interviewScore = 0;
  const [perfRows]: any = await db.query("SELECT avg_interview_score FROM student_performance_stats WHERE user_id = ?", [userId]);
  if (perfRows && perfRows.length > 0 && perfRows[0].avg_interview_score) {
    interviewScore = Math.round(perfRows[0].avg_interview_score);
  }
  if (interviewScore === 0) {
    const [histRows]: any = await db.query("SELECT AVG(score) as avg_score FROM interview_history WHERE student_id = (SELECT id FROM student_profiles WHERE user_id = ?)", [userId]);
    if (histRows && histRows[0] && histRows[0].avg_score) {
      interviewScore = Math.round(histRows[0].avg_score);
    }
  }
  if (interviewScore === 0) {
    interviewScore = 50; // Dynamic default fallback
  }

  let quizScore = 0;
  const [quizRows]: any = await db.query(
    "SELECT AVG(percentage) as avg_score FROM quizzes WHERE user_id = ? AND status = 'COMPLETED'",
    [userId]
  );
  if (quizRows && quizRows[0] && quizRows[0].avg_score) {
    quizScore = Math.round(quizRows[0].avg_score);
  }
  if (quizScore === 0) {
    quizScore = 45; // Dynamic default fallback
  }

  let psychometricScore = 50;
  const [psyRows]: any = await db.query("SELECT overall_score FROM psychometric_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [userId]);
  if (psyRows && psyRows.length > 0) {
    psychometricScore = psyRows[0].overall_score || 50;
  }

  return {
    talentScore,
    codingScore,
    interviewScore,
    quizScore,
    psychometricScore
  };
}

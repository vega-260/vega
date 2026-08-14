import db from "../../db.ts";

export async function getTPOContext(userId: number) {
  const [tpoProfiles]: any = await db.query("SELECT id FROM tpo_profiles WHERE user_id = ?", [userId]);
  if (tpoProfiles.length === 0) return null;
  const tpoId = tpoProfiles[0].id;
  const [colleges]: any = await db.query("SELECT college_id FROM tpo_colleges WHERE tpo_id = ?", [tpoId]);
  const collegeIdsSet = new Set<number>(colleges.map((c: any) => Number(c.college_id)));
  const [batchColleges]: any = await db.query("SELECT DISTINCT college_id FROM batches WHERE assigned_tpo_id = ?", [tpoId]);
  batchColleges.forEach((b: any) => collegeIdsSet.add(Number(b.college_id)));
  return { tpoId, collegeIds: Array.from(collegeIdsSet) };
}

import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";
const router = express.Router();
// Comprehensive TPO Analytics Route with Batch and Advanced Filters
router.get("/analytics", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.json({ success: true, data: null });
    }

    const { collegeIds, tpoId } = context;
    const collegePlaceholders = collegeIds.map(() => '?').join(',');

    // 1. Fetch all assigned batches for filter dropdown
    const [assignedBatches]: any = await db.query(`
      SELECT DISTINCT b.id, b.batch_name
      FROM batches b
      WHERE b.assigned_tpo_id = ? OR b.college_id IN (${collegePlaceholders})
    `, [tpoId, ...collegeIds]);

    const batchList = [
      { id: 'all', name: 'All Assigned Batches' },
      ...assignedBatches.map((b: any) => ({
        id: String(b.id),
        name: b.batch_name || `Batch ${b.id}`
      }))
    ];

    // Filter params
    const selectedBatchId = (req.query.batchId as string) || 'all';
    const selectedCategory = (req.query.category as string) || 'all';
    const searchQuery = (req.query.search as string) || '';

    // Build Student Query with filters
    let studentWhereClause = `COALESCE(sp.college_id, b.college_id) IN (${collegePlaceholders})`;
    const studentQueryParams: any[] = [...collegeIds];

    if (selectedBatchId !== 'all') {
      studentWhereClause += ` AND (b.id = ? OR sb.batch_id = ? OR sp.batch = (SELECT batch_name FROM batches WHERE id = ? LIMIT 1))`;
      studentQueryParams.push(selectedBatchId, selectedBatchId, selectedBatchId);
    }

    if (searchQuery.trim()) {
      studentWhereClause += ` AND (sp.full_name LIKE ? OR sp.aadhar_or_college_id LIKE ?)`;
      studentQueryParams.push(`%${searchQuery.trim()}%`, `%${searchQuery.trim()}%`);
    }

    // Query students under this filter
    const [students]: any = await db.query(`
      SELECT DISTINCT sp.id, sp.user_id, sp.full_name,
             COALESCE(sp.onboarding_industry, 'General') as department,
             COALESCE(sp.aadhar_or_college_id, CONCAT('REG', sp.id)) as roll_number, 
             COALESCE(b.batch_name, sp.batch, 'General Batch') as batch_name,
             sp.completeness_score,
             ts.overall_score as talent_score,
             ts.breakdown_json
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON sb.batch_id = b.id
      LEFT JOIN talent_scores ts ON sp.user_id = ts.user_id
      WHERE ${studentWhereClause}
      ORDER BY ts.overall_score DESC
    `, studentQueryParams);

    const studentIds = students.map((s: any) => s.id);
    let placementsMap: Record<number, { status: string; company: string; package: string }> = {};
    let placedCount = 0;
    let totalPackage = 0;
    let packageCount = 0;
    const companyOffersMap: Record<string, { offers: number; totalPkg: number }> = {};
    const batchPlacementMap: Record<string, { total: number; placed: number }> = {};
    const deptPlacementMap: Record<string, { total: number; placed: number }> = {};

    if (studentIds.length > 0) {
      const studentPlaceholders = studentIds.map(() => '?').join(',');
      
      // 1. Fetch placements from job applications
      try {
        const [jobAppRows]: any = await db.query(`
          SELECT ja.student_id, ja.status, cp.company_name, j.salary_range as package_offered
          FROM job_applications ja
          JOIN jobs j ON ja.job_id = j.id
          LEFT JOIN company_profiles cp ON j.company_id = cp.id
          WHERE ja.student_id IN (${studentPlaceholders}) AND (ja.status = 'SELECTED' OR ja.status = 'PLACED' OR ja.status = 'HIRED')
        `, studentIds);
        
        (jobAppRows || []).forEach((reg: any) => {
          const comp = reg.company_name || 'Partner Company';
          const pkgStr = reg.package_offered || 'N/A';
          const pkgNum = parseFloat(String(pkgStr).replace(/[^0-9.]/g, '')) || 0;

          if (!placementsMap[reg.student_id]) {
            placementsMap[reg.student_id] = {
              status: 'PLACED',
              company: comp,
              package: pkgStr !== 'N/A' ? pkgStr : '0 LPA'
            };
            placedCount += 1;
            if (pkgNum > 0) {
              totalPackage += pkgNum;
              packageCount += 1;
            }

            if (!companyOffersMap[comp]) {
              companyOffersMap[comp] = { offers: 0, totalPkg: 0 };
            }
            companyOffersMap[comp].offers += 1;
            companyOffersMap[comp].totalPkg += pkgNum;
          }
        });
      } catch (_) {}

      // 2. Fetch placements from event registrations
      try {
        const [eventRows]: any = await db.query(`
          SELECT er.student_id, er.status, pd.company_name, pd.package_details as package_offered
          FROM event_registrations er
          LEFT JOIN placement_drives pd ON er.event_id = pd.event_id
          WHERE er.student_id IN (${studentPlaceholders}) AND (er.status = 'SELECTED' OR er.status = 'PLACED')
        `, studentIds);

        (eventRows || []).forEach((reg: any) => {
          if (!placementsMap[reg.student_id]) {
            const comp = reg.company_name || 'Campus Placement Drive';
            const pkgStr = reg.package_offered || 'N/A';
            const pkgNum = parseFloat(String(pkgStr).replace(/[^0-9.]/g, '')) || 0;

            placementsMap[reg.student_id] = {
              status: 'PLACED',
              company: comp,
              package: pkgStr !== 'N/A' ? pkgStr : '0 LPA'
            };
            placedCount += 1;
            if (pkgNum > 0) {
              totalPackage += pkgNum;
              packageCount += 1;
            }

            if (!companyOffersMap[comp]) {
              companyOffersMap[comp] = { offers: 0, totalPkg: 0 };
            }
            companyOffersMap[comp].offers += 1;
            companyOffersMap[comp].totalPkg += pkgNum;
          }
        });
      } catch (_) {}

      // 3. Profiles marked as placed directly
      students.forEach((s: any) => {
        if (!placementsMap[s.id] && (s.is_placed || s.placed_company)) {
          const comp = s.placed_company || 'Recruiter Partner';
          placementsMap[s.id] = {
            status: 'PLACED',
            company: comp,
            package: '0 LPA'
          };
          placedCount += 1;

          if (!companyOffersMap[comp]) {
            companyOffersMap[comp] = { offers: 0, totalPkg: 0 };
          }
          companyOffersMap[comp].offers += 1;
        }
      });
    }

    students.forEach((s: any) => {
      const batchName = s.batch_name || 'General Batch';
      if (!batchPlacementMap[batchName]) {
        batchPlacementMap[batchName] = { total: 0, placed: 0 };
      }
      batchPlacementMap[batchName].total += 1;

      const deptName = s.department || 'General';
      if (!deptPlacementMap[deptName]) {
        deptPlacementMap[deptName] = { total: 0, placed: 0 };
      }
      deptPlacementMap[deptName].total += 1;

      if (placementsMap[s.id]?.status === 'PLACED') {
        batchPlacementMap[batchName].placed += 1;
        deptPlacementMap[deptName].placed += 1;
      }
    });

    let assessmentScoresMap: Record<number, { totalScore: number; count: number }> = {};
    let categoryScoresMap: Record<string, { total: number; count: number }> = {};
    let studentCategoryScores: Record<number, Record<string, { total: number; count: number }>> = {};

    if (studentIds.length > 0) {
      const studentPlaceholders = studentIds.map(() => '?').join(',');
      try {
        const [submissions]: any = await db.query(`
          SELECT sp.id as student_id, aa.score as percentage, at.category
          FROM assessment_attempts aa
          JOIN assessment_tests at ON aa.assessment_id = at.id
          JOIN users u ON aa.student_user_id = u.id
          JOIN student_profiles sp ON sp.user_id = u.id
          WHERE sp.id IN (${studentPlaceholders})
        `, studentIds);
        (submissions || []).forEach((att: any) => {
          const val = Number(att.percentage) || 0;
          if (!assessmentScoresMap[att.student_id]) {
            assessmentScoresMap[att.student_id] = { totalScore: 0, count: 0 };
          }
          assessmentScoresMap[att.student_id].totalScore += val;
          assessmentScoresMap[att.student_id].count += 1;

          const cat = att.category || 'General Assessment';
          if (!categoryScoresMap[cat]) categoryScoresMap[cat] = { total: 0, count: 0 };
          categoryScoresMap[cat].total += val;
          categoryScoresMap[cat].count += 1;

          if (!studentCategoryScores[att.student_id]) studentCategoryScores[att.student_id] = {};
          if (!studentCategoryScores[att.student_id][cat]) studentCategoryScores[att.student_id][cat] = { total: 0, count: 0 };
          studentCategoryScores[att.student_id][cat].total += val;
          studentCategoryScores[att.student_id][cat].count += 1;
        });
      } catch (_) {
        try {
          const [submissions]: any = await db.query(`
            SELECT ts.student_id, ts.score as percentage, 'General Assessment' as category
            FROM test_submissions ts
            WHERE ts.student_id IN (${studentPlaceholders})
          `, studentIds);
          (submissions || []).forEach((att: any) => {
            const val = Number(att.percentage) || 0;
            if (!assessmentScoresMap[att.student_id]) {
              assessmentScoresMap[att.student_id] = { totalScore: 0, count: 0 };
            }
            assessmentScoresMap[att.student_id].totalScore += val;
            assessmentScoresMap[att.student_id].count += 1;

            const cat = att.category || 'General Assessment';
            if (!categoryScoresMap[cat]) categoryScoresMap[cat] = { total: 0, count: 0 };
            categoryScoresMap[cat].total += val;
            categoryScoresMap[cat].count += 1;

            if (!studentCategoryScores[att.student_id]) studentCategoryScores[att.student_id] = {};
            if (!studentCategoryScores[att.student_id][cat]) studentCategoryScores[att.student_id][cat] = { total: 0, count: 0 };
            studentCategoryScores[att.student_id][cat].total += val;
            studentCategoryScores[att.student_id][cat].count += 1;
          });
        } catch (_) {}
      }
    }

    const totalStudents = students.length;
    const avgPackage = packageCount > 0 ? (totalPackage / packageCount).toFixed(1) : "0.0";
    const placementRate = totalStudents > 0 ? Math.round((placedCount / totalStudents) * 100) : 0;

    let totalScoreSum = 0;
    let scoreCount = 0;
    let totalTalentSum = 0;
    let talentCount = 0;

    let aptSum = 0, techSum = 0, softSum = 0, commSum = 0;

    const leaderboard = students.map((s: any) => {
      const p = placementsMap[s.id];
      const assData = assessmentScoresMap[s.id];
      const testScore = assData && assData.count > 0 ? Math.round(assData.totalScore / assData.count) : 0;
      const tScore = s.talent_score !== null && s.talent_score !== undefined ? Number(s.talent_score) : 0;
      
      const finalTalentScore = tScore > 0 ? tScore : (testScore > 0 ? testScore : Number(s.completeness_score || 0));

      if (assData && assData.count > 0) {
        totalScoreSum += testScore;
        scoreCount += 1;
      }
      if (finalTalentScore > 0) {
        totalTalentSum += finalTalentScore;
        talentCount += 1;
      }

      let bObj: any = {};
      if (s.breakdown_json) {
        try {
          bObj = typeof s.breakdown_json === 'string' ? JSON.parse(s.breakdown_json) : s.breakdown_json;
        } catch (_) {}
      }

      const studentCats = studentCategoryScores[s.id] || {};
      const getCatAvg = (keywords: string[]) => {
        for (const cat of Object.keys(studentCats)) {
          if (keywords.some(k => cat.toLowerCase().includes(k.toLowerCase()))) {
            return Math.round(studentCats[cat].total / studentCats[cat].count);
          }
        }
        return null;
      };

      const aptScore = bObj.aptitude ?? getCatAvg(['aptitude', 'logic']) ?? finalTalentScore;
      const techScore = bObj.technical ?? getCatAvg(['coding', 'tech', 'algorithm']) ?? finalTalentScore;
      const softScore = bObj.softskills ?? getCatAvg(['soft', 'verbal']) ?? finalTalentScore;
      const commScore = bObj.communication ?? getCatAvg(['comm', 'speak', 'interview']) ?? finalTalentScore;

      aptSum += aptScore;
      techSum += techScore;
      softSum += softScore;
      commSum += commScore;

      return {
        id: s.id,
        name: s.full_name || 'Student User',
        rollNumber: s.roll_number || `REG${s.id}`,
        department: s.department || 'General',
        batchName: s.batch_name || 'General Batch',
        talentScore: finalTalentScore,
        assessmentAvg: testScore,
        placementStatus: p ? 'PLACED' : 'NOT_PLACED',
        company: p ? p.company : 'N/A',
        packageOffered: p ? p.package : 'N/A'
      };
    });

    const avgAssessmentScore = scoreCount > 0 ? Math.round(totalScoreSum / scoreCount) : 0;
    const avgTalentScore = talentCount > 0 ? Math.round(totalTalentSum / talentCount) : 0;

    const tiers = [
      { tier: "Star Performer (80+)", count: leaderboard.filter(l => l.talentScore >= 80).length, percentage: totalStudents > 0 ? Math.round((leaderboard.filter(l => l.talentScore >= 80).length / totalStudents) * 100) : 0 },
      { tier: "Job Ready (60-79)", count: leaderboard.filter(l => l.talentScore >= 60 && l.talentScore < 80).length, percentage: totalStudents > 0 ? Math.round((leaderboard.filter(l => l.talentScore >= 60 && l.talentScore < 80).length / totalStudents) * 100) : 0 },
      { tier: "Developing (40-59)", count: leaderboard.filter(l => l.talentScore >= 40 && l.talentScore < 60).length, percentage: totalStudents > 0 ? Math.round((leaderboard.filter(l => l.talentScore >= 40 && l.talentScore < 60).length / totalStudents) * 100) : 0 },
      { tier: "Needs Support (<40)", count: leaderboard.filter(l => l.talentScore < 40).length, percentage: totalStudents > 0 ? Math.round((leaderboard.filter(l => l.talentScore < 40).length / totalStudents) * 100) : 0 }
    ];

    const batchBreakdown = Object.keys(batchPlacementMap).map(batch => ({
      name: batch,
      value: batchPlacementMap[batch].total,
      placed: batchPlacementMap[batch].placed
    }));

    const deptBreakdown = Object.keys(deptPlacementMap).map(dept => ({
      name: dept,
      value: deptPlacementMap[dept].total,
      placed: deptPlacementMap[dept].placed
    }));

    const topRecruiters = Object.keys(companyOffersMap).map(comp => ({
      company: comp,
      offers: companyOffersMap[comp].offers,
      avgPackage: companyOffersMap[comp].offers > 0 && companyOffersMap[comp].totalPkg > 0
        ? (companyOffersMap[comp].totalPkg / companyOffersMap[comp].offers).toFixed(1) + " LPA"
        : "N/A"
    }));

    const packageDistribution = [
      { range: "< 4.5 LPA", count: leaderboard.filter(l => l.placementStatus === 'PLACED' && parseFloat(l.packageOffered) > 0 && parseFloat(l.packageOffered) < 4.5).length },
      { range: "4.5 - 7.5 LPA", count: leaderboard.filter(l => l.placementStatus === 'PLACED' && parseFloat(l.packageOffered) >= 4.5 && parseFloat(l.packageOffered) < 7.5).length },
      { range: "7.5 - 12 LPA", count: leaderboard.filter(l => l.placementStatus === 'PLACED' && parseFloat(l.packageOffered) >= 7.5 && parseFloat(l.packageOffered) < 12).length },
      { range: "12+ LPA High Tier", count: leaderboard.filter(l => l.placementStatus === 'PLACED' && parseFloat(l.packageOffered) >= 12).length }
    ];

    const assessmentDistribution = [
      { range: "80-100% (Excellent)", count: leaderboard.filter(l => l.assessmentAvg >= 80).length },
      { range: "60-79% (Good)", count: leaderboard.filter(l => l.assessmentAvg >= 60 && l.assessmentAvg < 80).length },
      { range: "40-59% (Average)", count: leaderboard.filter(l => l.assessmentAvg >= 40 && l.assessmentAvg < 60).length },
      { range: "< 40% (Below Avg)", count: leaderboard.filter(l => l.assessmentAvg < 40).length }
    ];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const monthlyTrendMap: Record<string, { placed: number; drives: number }> = {};
    monthNames.forEach(m => { monthlyTrendMap[m] = { placed: 0, drives: 0 }; });

    if (studentIds.length > 0) {
      const studentPlaceholders = studentIds.map(() => '?').join(',');
      try {
        const [monthlyPlacements]: any = await db.query(`
          SELECT MONTH(applied_at) as month_num, COUNT(DISTINCT student_id) as cnt
          FROM job_applications
          WHERE student_id IN (${studentPlaceholders}) AND (status = 'SELECTED' OR status = 'PLACED' OR status = 'HIRED')
          GROUP BY MONTH(applied_at)
        `, studentIds);
        (monthlyPlacements || []).forEach((row: any) => {
          const idx = (row.month_num || 1) - 1;
          if (idx >= 0 && idx < 6) {
            monthlyTrendMap[monthNames[idx]].placed += row.cnt;
          }
        });
      } catch (_) {}

      try {
        const [monthlyDrives]: any = await db.query(`
          SELECT MONTH(created_at) as month_num, COUNT(*) as cnt
          FROM events
          WHERE event_type LIKE '%placement%' OR event_type LIKE '%drive%'
          GROUP BY MONTH(created_at)
        `);
        (monthlyDrives || []).forEach((row: any) => {
          const idx = (row.month_num || 1) - 1;
          if (idx >= 0 && idx < 6) {
            monthlyTrendMap[monthNames[idx]].drives += row.cnt;
          }
        });
      } catch (_) {}
    }

    const monthlyTrend = monthNames.map(m => ({
      month: m,
      placed: monthlyTrendMap[m].placed,
      drives: monthlyTrendMap[m].drives
    }));

    res.json({
      success: true,
      data: {
        filters: {
          batches: batchList,
          categories: ["All Categories", "Aptitude", "Coding / Technical", "Soft Skills", "Domain Specific"]
        },
        metrics: {
          totalStudents,
          placedStudents: placedCount,
          placementRate,
          avgPackage: avgPackage + " LPA",
          avgAssessmentScore,
          avgTalentScore,
          starPerformers: leaderboard.filter(l => l.talentScore >= 80).length
        },
        placementAnalytics: {
          monthlyTrend,
          batchBreakdown,
          deptBreakdown,
          packageDistribution,
          topRecruiters
        },
        assessmentAnalytics: {
          categoryScores: Object.keys(categoryScoresMap).map(c => ({
            category: c,
            avgScore: Math.round(categoryScoresMap[c].total / categoryScoresMap[c].count),
            attempts: categoryScoresMap[c].count
          })),
          scoreDistribution: assessmentDistribution
        },
        talentMatrix: {
          tiers,
          skillAverages: {
            aptitude: totalStudents > 0 ? Math.round(aptSum / totalStudents) : 0,
            technical: totalStudents > 0 ? Math.round(techSum / totalStudents) : 0,
            communication: totalStudents > 0 ? Math.round(commSum / totalStudents) : 0,
            softskills: totalStudents > 0 ? Math.round(softSum / totalStudents) : 0
          }
        },
        studentLeaderboard: leaderboard
      }
    });
  } catch (error) {
    console.error("TPO Analytics Route Error:", error);
    res.status(500).json({ success: false, message: "Error generating analytics data" });
  }
});


export default router;

import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";
const router = express.Router();
router.get("/dashboard-stats", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) {
      return res.json({ 
        success: true, 
        data: { 
          metrics: {
            totalStudents: 0,
            activeStudents: 0,
            placedStudents: 0,
            placementRate: 0,
            avgTalentScore: 0,
            atRiskStudents: 0
          }, 
          collegeAnalytics: [] 
        } 
      });
    }

    const { collegeIds } = context;
    const placeholders = collegeIds.map(() => '?').join(',');

    // 1. Core Metrics
    const [studentStats]: any = await db.query(`
      SELECT COUNT(*) as totalStudents,
             SUM(CASE WHEN sp.completeness_score >= 80 THEN 1 ELSE 0 END) as activeStudents
      FROM student_profiles sp
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders})
    `, [...collegeIds]);

    let placedStudents = 0;
    try {
      const [placementStats]: any = await db.query(`
        SELECT COUNT(DISTINCT er.student_id) as placedStudents
        FROM event_registrations er
        JOIN student_profiles sp ON er.student_id = sp.id
        LEFT JOIN student_batch sb ON sp.id = sb.student_id
        LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
        WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders}) AND er.status = 'SELECTED'
      `, [...collegeIds]);
      placedStudents = placementStats[0]?.placedStudents || 0;
    } catch (_) {
      // Quiet fallback
    }

    const [talentStats]: any = await db.query(`
      SELECT AVG(overall_score) as avgTalentScore,
             SUM(CASE WHEN overall_score < 40 THEN 1 ELSE 0 END) as atRiskStudents
      FROM talent_scores ts
      JOIN student_profiles sp ON ts.user_id = sp.user_id
      LEFT JOIN student_batch sb ON sp.id = sb.student_id
      LEFT JOIN batches b ON COALESCE(sp.batch_id, sb.batch_id) = b.id
      WHERE COALESCE(sp.college_id, b.college_id) IN (${placeholders})
    `, [...collegeIds]);

    // 2. College-wise Analytics
    const [collegeAnalytics]: any = await db.query(`
      SELECT cm.college_name, ca.*
      FROM college_analytics ca
      JOIN college_master cm ON ca.college_id = cm.id
      WHERE ca.college_id IN (${placeholders})
    `, [...collegeIds]);

    // 3. Assessment Tests
    let dbTests: any[] = [];
    const now = new Date();

    function computeTestEffectiveStatus(test: any, currentTime: Date) {
      if (test.status === 'CANCELLED' || test.status === 'DRAFT') {
        return test.status;
      }
      if (!test.test_date) {
        return test.status || 'SCHEDULED';
      }

      let dateStr = '';
      if (test.test_date instanceof Date) {
        const y = test.test_date.getFullYear();
        const m = String(test.test_date.getMonth() + 1).padStart(2, '0');
        const d = String(test.test_date.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      } else {
        dateStr = String(test.test_date).split('T')[0];
      }

      let hours = 0;
      let minutes = 0;
      if (test.start_time) {
        const timeStr = String(test.start_time).trim();
        const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
        if (match) {
          hours = parseInt(match[1], 10);
          minutes = parseInt(match[2], 10);
          const ampm = match[3] ? match[3].toUpperCase() : null;
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }

      const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
      if (!year || !month || !day) return test.status || 'SCHEDULED';

      const startTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
      const duration = Number(test.duration_minutes) || 60;
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      if (currentTime > endTime) {
        return 'COMPLETED';
      } else if (currentTime >= startTime && currentTime <= endTime) {
        return 'LIVE';
      } else {
        return 'SCHEDULED';
      }
    }

    try {
      const [testsResult]: any = await db.query(`
        SELECT id, title, category, department, status, test_date, start_time, duration_minutes, created_at
        FROM assessment_tests
        WHERE college_id IN (${placeholders})
        ORDER BY created_at DESC
      `, [...collegeIds]);

      const rawTests = testsResult || [];
      const autoCompletedIds: number[] = [];

      dbTests = rawTests.map((t: any) => {
        const computedStatus = computeTestEffectiveStatus(t, now);
        if (computedStatus === 'COMPLETED' && t.status !== 'COMPLETED' && t.id) {
          autoCompletedIds.push(t.id);
        }
        return {
          ...t,
          status: computedStatus
        };
      });

      if (autoCompletedIds.length > 0) {
        const updatePlaceholders = autoCompletedIds.map(() => '?').join(',');
        db.query(`UPDATE assessment_tests SET status = 'COMPLETED' WHERE id IN (${updatePlaceholders})`, autoCompletedIds)
          .catch(err => console.log("Failed to auto-update test statuses to COMPLETED:", err));
      }
    } catch (err) {
      console.log("No assessment_tests table or query failed, using empty list");
    }

    // 4. Batches Performance (Real DB calculation)
    let batchStatsList: any[] = [];
    try {
      const [batchesResult]: any = await db.query(`
        SELECT b.id, b.batch_name, b.department,
               COUNT(DISTINCT sp.id) as student_count,
               ROUND(AVG(COALESCE(ts.overall_score, 0))) as avg_score,
               ROUND(AVG(CASE WHEN COALESCE(ts.overall_score, 0) >= 50 THEN 1 ELSE 0 END) * 100) as pass_rate
        FROM batches b
        LEFT JOIN student_batch sb ON b.id = sb.batch_id
        LEFT JOIN student_profiles sp ON (sb.student_id = sp.id OR sp.batch_id = b.id)
        LEFT JOIN talent_scores ts ON sp.user_id = ts.user_id
        WHERE b.college_id IN (${placeholders})
        GROUP BY b.id, b.batch_name, b.department
        ORDER BY student_count DESC
      `, [...collegeIds]);
      batchStatsList = (batchesResult || []).filter((b: any) => (b.student_count || 0) > 0);
    } catch (err) {
      console.log("No batches table or query error");
    }

    if (batchStatsList.length === 0) {
      try {
        const [studentBatchRes]: any = await db.query(`
          SELECT COALESCE(sp.batch, sp.department, 'General') as batch_name,
                 COUNT(DISTINCT sp.id) as student_count,
                 ROUND(AVG(COALESCE(ts.overall_score, 0))) as avg_score,
                 ROUND(AVG(CASE WHEN COALESCE(ts.overall_score, 0) >= 50 THEN 1 ELSE 0 END) * 100) as pass_rate
          FROM student_profiles sp
          LEFT JOIN talent_scores ts ON sp.user_id = ts.user_id
          WHERE sp.college_id IN (${placeholders}) AND (sp.batch IS NOT NULL OR sp.department IS NOT NULL)
          GROUP BY batch_name
          ORDER BY student_count DESC
        `, [...collegeIds]);
        batchStatsList = studentBatchRes || [];
      } catch (e) {
        console.log("Error querying student profiles by batch:", e);
      }
    }

    const finalBatchPerformance = batchStatsList.map((b: any) => ({
      batch_name: b.batch_name || b.department || 'General Batch',
      student_count: Number(b.student_count) || 0,
      avg_score: Number(b.avg_score) || 0,
      pass_rate: Number(b.pass_rate) || 0
    }));

    // 5. Upcoming Assessments (Real DB tests)
    const upcomingDb = dbTests.filter((t: any) => t.status === 'SCHEDULED' || t.status === 'LIVE' || t.status === 'UPCOMING');
    const upcomingAssessments = upcomingDb.map((t: any) => ({
      id: t.id,
      title: t.title,
      department: t.department || 'All Batches',
      date_str: t.test_date ? new Date(t.test_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Upcoming',
      time_str: `${t.start_time || '10:00 AM'} • ${t.duration_minutes || 60} min`,
      status: t.status === 'LIVE' ? 'Live' : 'Scheduled'
    }));

    // 6. Assessment Performance (Real Status Breakdown)
    const perfFilterParam = (req.query.perfFilter as string) || 'This Month';
    const trendFilterParam = (req.query.trendFilter as string) || 'Monthly';

    let filteredPerfTests = dbTests;

    function isSameMonthAndYear(dateVal: any, targetYear: number, targetMonth: number) {
      if (!dateVal) return false;
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    }

    if (perfFilterParam === 'This Month') {
      filteredPerfTests = dbTests.filter((t: any) => 
        isSameMonthAndYear(t.created_at || t.test_date, now.getFullYear(), now.getMonth())
      );
    } else if (perfFilterParam === 'Last Month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      filteredPerfTests = dbTests.filter((t: any) => 
        isSameMonthAndYear(t.created_at || t.test_date, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
      );
    }

    const upcomingCount = filteredPerfTests.filter((t: any) => t.status === 'SCHEDULED' || t.status === 'UPCOMING').length;
    const liveCount = filteredPerfTests.filter((t: any) => t.status === 'LIVE').length;
    const completedCount = filteredPerfTests.filter((t: any) => t.status === 'COMPLETED').length;
    const draftCount = filteredPerfTests.filter((t: any) => t.status === 'DRAFT').length;
    const cancelledCount = filteredPerfTests.filter((t: any) => t.status === 'CANCELLED').length;
    const totalCount = filteredPerfTests.length;

    const assessmentStatusBreakdown = [
      { name: 'Upcoming', count: upcomingCount, percentage: totalCount > 0 ? Math.round((upcomingCount / totalCount) * 100) : 0, color: '#2563eb' },
      { name: 'Live', count: liveCount, percentage: totalCount > 0 ? Math.round((liveCount / totalCount) * 100) : 0, color: '#16a34a' },
      { name: 'Completed', count: completedCount, percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0, color: '#f97316' },
      { name: 'Draft', count: draftCount, percentage: totalCount > 0 ? Math.round((draftCount / totalCount) * 100) : 0, color: '#9333ea' },
      { name: 'Cancelled', count: cancelledCount, percentage: totalCount > 0 ? Math.round((cancelledCount / totalCount) * 100) : 0, color: '#dc2626' },
    ];

    // 7. Assessment Trends (Monthly, Weekly, Quarterly calculated dynamically)
    let assessmentTrends: any[] = [];

    if (trendFilterParam === 'Weekly') {
      const weeksList: { label: string; start: Date; end: Date; Created: number; Completed: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(now.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        weeksList.push({
          label: `Wk ${6 - i}`,
          start,
          end,
          Created: 0,
          Completed: 0
        });
      }

      dbTests.forEach((t: any) => {
        const cDate = t.created_at ? new Date(t.created_at) : (t.test_date ? new Date(t.test_date) : null);
        if (cDate) {
          weeksList.forEach(w => {
            if (cDate >= w.start && cDate <= w.end) {
              w.Created += 1;
              if (t.status === 'COMPLETED') {
                w.Completed += 1;
              }
            }
          });
        }
      });

      assessmentTrends = weeksList.map(w => ({
        month: w.label,
        Created: w.Created,
        Completed: w.Completed
      }));
    } else if (trendFilterParam === 'Quarterly') {
      const quartersList: { label: string; year: number; qNum: number; Created: number; Completed: number }[] = [];
      const currentQ = Math.floor(now.getMonth() / 3) + 1;
      let yr = now.getFullYear();

      for (let i = 3; i >= 0; i--) {
        let q = currentQ - i;
        let y = yr;
        while (q <= 0) {
          q += 4;
          y -= 1;
        }
        quartersList.push({
          label: `Q${q} ${y}`,
          year: y,
          qNum: q,
          Created: 0,
          Completed: 0
        });
      }

      dbTests.forEach((t: any) => {
        const cDate = t.created_at ? new Date(t.created_at) : (t.test_date ? new Date(t.test_date) : null);
        if (cDate) {
          const cYear = cDate.getFullYear();
          const cQ = Math.floor(cDate.getMonth() / 3) + 1;
          const qMatch = quartersList.find(q => q.year === cYear && q.qNum === cQ);
          if (qMatch) {
            qMatch.Created += 1;
            if (t.status === 'COMPLETED') {
              qMatch.Completed += 1;
            }
          }
        }
      });

      assessmentTrends = quartersList.map(q => ({
        month: q.label,
        Created: q.Created,
        Completed: q.Completed
      }));
    } else {
      // Monthly
      const monthsList: { year: number; monthNum: number; monthLabel: string; Created: number; Completed: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthsList.push({
          year: d.getFullYear(),
          monthNum: d.getMonth(),
          monthLabel: d.toLocaleDateString('en-US', { month: 'short' }),
          Created: 0,
          Completed: 0
        });
      }

      dbTests.forEach((t: any) => {
        const cDate = t.created_at ? new Date(t.created_at) : (t.test_date ? new Date(t.test_date) : null);
        if (cDate) {
          const mMatch = monthsList.find(m => m.year === cDate.getFullYear() && m.monthNum === cDate.getMonth());
          if (mMatch) {
            mMatch.Created += 1;
            if (t.status === 'COMPLETED') {
              mMatch.Completed += 1;
            }
          }
        }
      });

      assessmentTrends = monthsList.map(m => ({
        month: m.monthLabel,
        Created: m.Created,
        Completed: m.Completed
      }));
    }

    // 8. Recent Completed Assessments (Real DB)
    const completedDb = dbTests.filter((t: any) => t.status === 'COMPLETED');
    let recentAssessments: any[] = [];

    if (completedDb.length > 0) {
      const testIds = completedDb.map((t: any) => t.id);
      let attemptScoresMap: Record<number, number> = {};
      try {
        const testPlaceholders = testIds.map(() => '?').join(',');
        const [avgScores]: any = await db.query(`
          SELECT assessment_id, ROUND(AVG(percentage)) as avg_score
          FROM assessment_attempts
          WHERE assessment_id IN (${testPlaceholders}) AND (status = 'SUBMITTED' OR status = 'COMPLETED')
          GROUP BY assessment_id
        `, testIds);
        (avgScores || []).forEach((row: any) => {
          attemptScoresMap[row.assessment_id] = row.avg_score;
        });
      } catch (e) {
        console.log("Error querying attempt scores:", e);
      }

      recentAssessments = completedDb.map((t: any) => {
        const avgScore = attemptScoresMap[t.id];
        return {
          id: t.id,
          title: t.title,
          department: t.department || 'All Batches',
          status: 'Completed',
          score: avgScore !== undefined && avgScore !== null ? `${avgScore}%` : 'N/A'
        };
      });
    }

    // 9. Calendar Activities (Tests, Events/Drives, Notices)
    let calendarActivities: any[] = [];
    try {
      const toDateKey = (dateInput: any): string | null => {
        if (!dateInput) return null;
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // 9a. From tests
      dbTests.forEach((t: any) => {
        const dateKey = toDateKey(t.test_date || t.created_at);
        if (dateKey) {
          calendarActivities.push({
            id: `test-${t.id}`,
            type: 'TEST',
            title: t.title,
            category: t.category || 'Assessment Test',
            date: dateKey,
            time: `${t.start_time || '10:00 AM'} (${t.duration_minutes || 60} mins)`,
            department: t.department || 'All Departments',
            status: t.status || 'SCHEDULED',
            color: 'blue'
          });
        }
      });

      // 9b. From events & drives
      const [eventsList]: any = await db.query(`
        SELECT id, title, event_type, start_date, end_date, location_or_link, description, status, created_at 
        FROM events 
        WHERE (college_id IN (${placeholders}) OR college_id IS NULL)
          AND (status IS NULL OR status NOT IN ('INACTIVE', 'DEACTIVE', 'CANCELLED'))
      `, [...collegeIds]);

      (eventsList || []).forEach((e: any) => {
        const dateKey = toDateKey(e.start_date || e.created_at);
        if (dateKey) {
          calendarActivities.push({
            id: `event-${e.id}`,
            type: 'EVENT',
            title: e.title,
            category: e.event_type || 'Placement Drive',
            date: dateKey,
            time: e.start_date ? new Date(e.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day',
            location: e.location_or_link || 'TBD',
            description: e.description || '',
            status: e.status || 'UPCOMING',
            color: 'purple'
          });
        }
      });

      // 9c. From notices
      const [noticesList]: any = await db.query(`
        SELECT id, title, category, batch_name, priority, message, created_at 
        FROM campus_notices 
        WHERE (college_id IN (${placeholders}) OR college_id IS NULL)
      `, [...collegeIds]);

      (noticesList || []).forEach((n: any) => {
        const dateKey = toDateKey(n.created_at);
        if (dateKey) {
          calendarActivities.push({
            id: `notice-${n.id}`,
            type: 'NOTICE',
            title: n.title,
            category: n.category || 'Campus Notice',
            date: dateKey,
            time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            batch: n.batch_name || 'All Batches',
            priority: n.priority || 'NORMAL',
            description: n.message || '',
            color: 'amber'
          });
        }
      });
    } catch (err) {
      console.log("Error building calendar activities:", err);
    }

    res.json({
      success: true,
      data: {
        metrics: {
          totalStudents: studentStats[0].totalStudents || 0,
          activeStudents: studentStats[0].activeStudents || 0,
          placedStudents: placedStudents,
          placementRate: studentStats[0].totalStudents > 0 ? Math.round((placedStudents / studentStats[0].totalStudents) * 100) : 0,
          avgTalentScore: talentStats[0].avgTalentScore || 0,
          atRiskStudents: talentStats[0].atRiskStudents || 0
        },
        collegeAnalytics,
        assessmentTrends,
        upcomingAssessments,
        batchPerformance: finalBatchPerformance,
        assessmentPerformance: {
          total: totalCount,
          breakdown: assessmentStatusBreakdown
        },
        recentAssessments,
        calendarActivities
      }
    });
  } catch (error) {
    console.error("TPO Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Error fetching dashboard stats" });
  }
});


export default router;

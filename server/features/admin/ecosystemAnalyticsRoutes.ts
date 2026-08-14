import express from "express";
import db from "../../db.ts";
import { logAdminAction } from "./adminAudit.ts";
const router = express.Router();
import bcrypt from "bcryptjs";
import { cacheGetOrLoad } from "../../services/cacheService.ts";
// --- ENTERPRISE AUDIT & SYSTEM ANALYTICS ---

router.get("/audit-logs", async (req, res) => {
  try {
    const [logs]: any = await db.query(`
      SELECT al.*, u.email as admin_email
      FROM admin_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Fetch Audit Logs Error:", error);
    res.status(500).json({ success: false, message: "Error fetching enterprise audit logs" });
  }
});

router.get("/college-analytics", async (req, res) => {
  try {
    const data = await cacheGetOrLoad<any>("admin:college-analytics", ["global"], Number(process.env.CACHE_TTL_DASHBOARD_SECONDS || 30), async () => {
      // One round trip instead of five independent COUNT queries.
      const [rows]: any = await db.readQuery(`
        SELECT
          (SELECT COUNT(*) FROM college_master WHERE status = 'ACTIVE') AS totalColleges,
          (SELECT COUNT(*) FROM tpo_profiles WHERE status = 'ACTIVE') AS totalTPOs,
          (SELECT COUNT(*) FROM batches WHERE status = 'ACTIVE') AS totalBatches,
          (SELECT COUNT(*) FROM student_profiles) AS totalStudents,
          (SELECT COUNT(*) FROM student_profiles WHERE is_placed = 1) AS totalPlaced
      `);
      const row = rows[0] || {};
      const totalStudents = Number(row.totalStudents || 0);
      const totalPlaced = Number(row.totalPlaced || 0);
      return {
        totalColleges: Number(row.totalColleges || 0), totalTPOs: Number(row.totalTPOs || 0),
        totalBatches: Number(row.totalBatches || 0), totalStudents, totalPlaced,
        overallPlacementRate: totalStudents > 0 ? ((totalPlaced / totalStudents) * 100).toFixed(1) : "0.0"
      };
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Analytics Fetch Error:", error);
    res.status(500).json({ success: false, message: "Error fetching system analytics" });
  }
});

// Seed High-Fidelity Mock Data for TPO Ecosystem
router.post("/seed-tpo-data-v2", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  try {
    // 1. Colleges
    const colleges = [
      { name: "Orchid College of Engineering", code: "ORCHID-01", city: "Solapur" },
      { name: "WIT Solapur (Walchand Institute of Technology)", code: "WIT-02", city: "Solapur" },
      { name: "BMIT (Brahmdevdada Mane Institute of Technology)", code: "BMIT-03", city: "Solapur" }
    ];

    const collegeIds = [];
    for (const c of colleges) {
      const [existing]: any = await db.query("SELECT id FROM college_master WHERE college_code = ?", [c.code]);
      if (existing.length > 0) {
        collegeIds.push(existing[0].id);
      } else {
        const [res]: any = await db.query(`
          INSERT INTO college_master (college_name, college_code, district, state)
          VALUES (?, ?, ?, 'Maharashtra')
        `, [c.name, c.code, c.city]);
        collegeIds.push(res.insertId);
      }
    }

    // 2. Ensure at least one TPO exists for events
    let tpoId;
    const [tpos]: any = await db.query("SELECT id FROM tpo_profiles LIMIT 1");
    if (tpos.length > 0) {
      tpoId = tpos[0].id;
    } else {
      // Create a dummy TPO for seeding
      const tempPassword = await bcrypt.hash("Admin@123", 10);
      const [u]: any = await db.query("INSERT INTO users (email, password_hash, role, is_verified) VALUES (?, ?, 'TPO', 1)", [`seed_tpo@vega.com`, tempPassword]);
      const [t]: any = await db.query("INSERT INTO tpo_profiles (user_id, full_name, designation) VALUES (?, 'System Seed TPO', 'Administrator')", [u.insertId]);
      tpoId = t.insertId;
      // Assign to all seeded colleges
      for (const cid of collegeIds) {
        await db.query("INSERT INTO tpo_colleges (tpo_id, college_id) VALUES (?, ?)", [tpoId, cid]);
      }
    }

    // 3. Students (20 High-Fidelity Profiles)
    const departments = ['CSE', 'ECE', 'Mechanical', 'Civil'];
    const years = ['Third Year', 'Final Year'];
    const names = ["Aditya", "Sneha", "Rohan", "Pooja", "Vikram", "Anjali", "Siddharth", "Nisha", "Sameer", "Riya", "Kunal", "Tanvi", "Pranav", "Ishita", "Yash", "Meera", "Abhishek", "Shweta", "Rahul", "Deepa"];

    for (let i = 0; i < 20; i++) {
      const email = `student${i + 100}@vega.com`;
      const [existing]: any = await db.query("SELECT id FROM users WHERE email = ?", [email]);
      if (existing.length > 0) continue;

      const passwordHash = await bcrypt.hash("Student123!", 10);
      const [u]: any = await db.query("INSERT INTO users (email, password_hash, role, is_verified) VALUES (?, ?, 'STUDENT', 1)", [email, passwordHash]);
      const userId = u.insertId;

      const dept = departments[i % 4];
      const year = years[i % 2];
      const collegeId = collegeIds[i % collegeIds.length];
      const score = 30 + Math.floor(Math.random() * 65); // 30-95

      await db.query(`
        INSERT INTO student_profiles (user_id, college_id, full_name, completeness_score, skills_json, education_json)
        VALUES (?, ?, ?, 100, ?, ?)
      `, [userId, collegeId, names[i] + " Patil", 100, JSON.stringify(['React', 'Node.js', 'SQL']), JSON.stringify({ department: dept, year: year })]);

      await db.query(`
        INSERT INTO talent_scores (user_id, overall_score, breakdown_json)
        VALUES (?, ?, ?)
      `, [userId, score, JSON.stringify({ technical: score, aptitude: score - 5, communication: score + 5 })]);
    }

    // 4. Companies & Drives
    const dateSql = db.useMySQL ? "DATE_ADD(NOW(), INTERVAL 7 DAY)" : "datetime('now', '+7 days')";
    const [driveRes]: any = await db.query(`
      INSERT INTO events (college_id, tpo_id, title, description, event_type, start_date, status)
      VALUES (?, ?, 'TCS Ninja Drive 2026', 'Campus recruitment for TCS Ninja role', 'PLACEMENT_DRIVE', ${dateSql}, 'UPCOMING')
    `, [collegeIds[0], tpoId]);
    
    const eventId = driveRes.insertId;
    await db.query(`
      INSERT INTO placement_drives (event_id, company_name, job_role, package_details)
      VALUES (?, 'TCS', 'System Engineer', '3.6 - 7.0 LPA')
    `, [eventId]);

    // 5. Update college analytics
    for (const cid of collegeIds) {
      const statsData = [cid, 7, 2, 69.2, 72.5, 65.0];
      if (db.useMySQL) {
        await db.query(`
          INSERT INTO college_analytics (college_id, total_students, placed_students, avg_talent_score, avg_coding_score, avg_interview_score)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            total_students = VALUES(total_students), 
            placed_students = VALUES(placed_students), 
            avg_talent_score = VALUES(avg_talent_score),
            avg_coding_score = VALUES(avg_coding_score),
            avg_interview_score = VALUES(avg_interview_score)
        `, statsData);
      } else {
        await db.query(`
          INSERT INTO college_analytics (college_id, total_students, placed_students, avg_talent_score, avg_coding_score, avg_interview_score)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(college_id) DO UPDATE SET
            total_students = excluded.total_students,
            placed_students = excluded.placed_students,
            avg_talent_score = excluded.avg_talent_score,
            avg_coding_score = excluded.avg_coding_score,
            avg_interview_score = excluded.avg_interview_score
        `, statsData);
      }
    }

    res.json({ success: true, message: "Production-grade mock data seeded successfully" });
  } catch (error: any) {
    console.error("Seeding Error:", error);
    res.status(500).json({ success: false, message: `Seeding failed: ${error.message || 'Unknown error'}` });
  }
});

router.get("/tpos", async (req, res) => {
  try {
    const [tpos]: any = await db.query(`
      SELECT t.*, u.email, u.status as user_status, 
      GROUP_CONCAT(c.college_name) as assigned_colleges
      FROM tpo_profiles t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN tpo_colleges tc ON t.id = tc.tpo_id
      LEFT JOIN college_master c ON tc.college_id = c.id
      GROUP BY t.id
    `);
    res.json({ success: true, data: tpos });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching TPOs" });
  }
});


export default router;

import express from "express";
import db from "../../db.ts";
import { getTPOContext } from "./tpoContext.ts";
const router = express.Router();
router.get("/questions", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(403).json({ success: false, message: "Unauthorized" });

    const [questions]: any = await db.query(
      `SELECT * FROM question_bank WHERE tpo_id = ? ORDER BY id DESC`,
      [context.tpoId]
    );
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error("Error fetching question bank:", error);
    res.status(500).json({ success: false, message: "Error fetching questions" });
  }
});

router.post("/questions", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(403).json({ success: false, message: "Unauthorized" });

    const { topic, question_text, question_type, difficulty, options_json, correct_answers_json, explanation } = req.body;
    
    await db.query(`
      INSERT INTO question_bank (tpo_id, topic, question_text, question_type, difficulty, options_json, correct_answers_json, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [context.tpoId, topic, question_text, question_type, difficulty, options_json, correct_answers_json, explanation]);
    
    res.json({ success: true, message: "Question added successfully" });
  } catch (error) {
    console.error("Error adding question:", error);
    res.status(500).json({ success: false, message: "Error adding question" });
  }
});

// Event Management
router.post("/events", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context) return res.status(403).json({ success: false, message: "TPO profile not found" });

    const { title, description, event_type, start_date, end_date, location_or_link, college_id, image_url } = req.body;

    const targetCollegeId = Number(college_id);
    if (!context.collegeIds.map((id: any) => Number(id)).includes(targetCollegeId)) {
      return res.status(403).json({ success: false, message: "Unauthorized for this college" });
    }

    const safeStartDate = start_date || null;
    const safeEndDate = end_date || null;

    const [result]: any = await db.query(`
      INSERT INTO events (college_id, tpo_id, title, description, event_type, start_date, end_date, location_or_link, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [targetCollegeId, context.tpoId, title, description, event_type, safeStartDate, safeEndDate, location_or_link, image_url || null]);

    res.json({ success: true, message: "Event created successfully", eventId: result.insertId });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, message: "Error creating event" });
  }
});

router.get("/events", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) return res.json({ success: true, data: [] });

    const placeholders = context.collegeIds.map(() => '?').join(',');

    const [events]: any = await db.query(`
      SELECT e.*, cm.college_name,
             (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count
      FROM events e
      JOIN college_master cm ON e.college_id = cm.id
      WHERE e.college_id IN (${placeholders})
      ORDER BY e.start_date DESC
    `, [...context.collegeIds]);

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching events" });
  }
});

router.put("/events/:id/status", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    const eventId = Number(req.params.id);
    const { status } = req.body;

    const [eventRow]: any = await db.query(`SELECT college_id FROM events WHERE id = ?`, [eventId]);
    if (eventRow.length === 0 || !context.collegeIds.map((id: any) => Number(id)).includes(Number(eventRow[0].college_id))) {
      return res.status(403).json({ success: false, message: "Unauthorized for this event" });
    }

    await db.query(`UPDATE events SET status = ? WHERE id = ?`, [status, eventId]);

    res.json({ success: true, message: `Event status updated to ${status}` });
  } catch (error) {
    console.error("Error updating event status:", error);
    res.status(500).json({ success: false, message: "Error updating event status" });
  }
});

router.get("/events/:id/registrations", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    const eventId = Number(req.params.id);

    // Verify if this event belongs to the TPO's colleges
    const [eventRow]: any = await db.query(`SELECT college_id FROM events WHERE id = ?`, [eventId]);
    if (eventRow.length === 0 || !context.collegeIds.map((id: any) => Number(id)).includes(Number(eventRow[0].college_id))) {
      return res.status(403).json({ success: false, message: "Unauthorized for this event" });
    }

    const [registrations]: any = await db.query(`
      SELECT er.id as registration_id, er.status, er.registered_at, 
             sp.id as student_id, sp.full_name, sp.contact, sp.profile_photo_url, sp.resume_url, sp.aadhar_or_college_id
      FROM event_registrations er
      JOIN student_profiles sp ON er.student_id = sp.id
      WHERE er.event_id = ?
      ORDER BY er.registered_at DESC
    `, [eventId]);

    res.json({ success: true, data: registrations });
  } catch (error) {
    console.error("Error fetching event registrations:", error);
    res.status(500).json({ success: false, message: "Error fetching registrations" });
  }
});

router.put("/events/:id/registrations/:regId", async (req: any, res) => {
  try {
    const context = await getTPOContext(req.user.userId);
    if (!context || context.collegeIds.length === 0) return res.status(403).json({ success: false, message: "Unauthorized" });

    const eventId = Number(req.params.id);
    const regId = Number(req.params.regId);
    const { status } = req.body;

    // Verify if this event belongs to the TPO's colleges
    const [eventRow]: any = await db.query(`SELECT college_id FROM events WHERE id = ?`, [eventId]);
    if (eventRow.length === 0 || !context.collegeIds.map((id: any) => Number(id)).includes(Number(eventRow[0].college_id))) {
      return res.status(403).json({ success: false, message: "Unauthorized for this event" });
    }

    await db.query(`
      UPDATE event_registrations 
      SET status = ? 
      WHERE id = ? AND event_id = ?
    `, [status, regId, eventId]);

    res.json({ success: true, message: "Registration status updated successfully" });
  } catch (error) {
    console.error("Error updating event registration status:", error);
    res.status(500).json({ success: false, message: "Error updating registration status" });
  }
});


export default router;

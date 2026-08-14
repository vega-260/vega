import express from "express";
import db from "../db.ts";

const router = express.Router();

// Helper function to sanitize input strings against script tags and HTML injection
function sanitizeInput(str: any): string {
  if (typeof str !== "string") return "";
  // Strip script/HTML tags and trim whitespace
  return str.replace(/<[^>]*>/g, "").trim();
}

// Public contact form submission endpoint
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Name, email, and message are required." });
    }

    // Sanitize and trim all inputs
    const cleanName = sanitizeInput(name).slice(0, 100);
    const cleanEmail = sanitizeInput(email).slice(0, 100);
    const cleanSubject = sanitizeInput(subject || 'General Support Request').slice(0, 150);
    const cleanMessage = sanitizeInput(message).slice(0, 2000);

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).json({ success: false, message: "Name, email, and message cannot be empty or contain invalid tags." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    if (cleanMessage.length < 5) {
      return res.status(400).json({ success: false, message: "Message must be at least 5 characters long." });
    }

    await db.query(`
      INSERT INTO contact_inquiries (name, email, subject, message, status, created_at)
      VALUES (?, ?, ?, ?, 'PENDING', NOW())
    `, [
      cleanName,
      cleanEmail,
      cleanSubject || 'General Support Request',
      cleanMessage
    ]);

    return res.json({
      success: true,
      message: "Your message has been submitted successfully! Our engineering support will be in touch."
    });
  } catch (error: any) {
    console.error("Error saving contact inquiry:", error);
    return res.status(500).json({ success: false, message: "Internal server error while processing inquiry." });
  }
});

export default router;


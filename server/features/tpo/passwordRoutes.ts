import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "../../db.ts";
import { sendTPOPasswordResetOTP, sendTPOPasswordChangedAlert } from "../../services/emailService.ts";

const router = express.Router();

// Helper to log security actions
async function logTPOSecurityEvent(userId: number, action: string, req: express.Request, details?: string) {
  try {
    await db.query(
      "INSERT INTO security_logs (user_id, action, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?)",
      [userId, action, req.ip || "unknown", req.headers["user-agent"] || "unknown", details || null]
    );
  } catch (e) {
    console.error("Security event logging error:", e);
  }
}

// Password strength validation helper
function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (!password || typeof password !== "string") {
    return { isValid: false, message: "Password is required." };
  }
  if (password.length < 8) {
    return { isValid: false, message: "Password must be at least 8 characters long." };
  }
  if (password.length > 64) {
    return { isValid: false, message: "Password cannot exceed 64 characters." };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one uppercase letter (A-Z)." };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one lowercase letter (a-z)." };
  }
  if (!/\d/.test(password)) {
    return { isValid: false, message: "Password must contain at least one number (0-9)." };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one special character." };
  }
  return { isValid: true };
}

/**
 * GET /password/status
 * Returns current TPO password status and security information.
 */
router.get("/password/status", async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const [users]: any = await db.query("SELECT email, role, status FROM users WHERE id = ?", [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    const [tpoProfiles]: any = await db.query("SELECT full_name, first_login FROM tpo_profiles WHERE user_id = ?", [userId]);
    const firstLogin = tpoProfiles?.[0]?.first_login === 1;

    return res.json({
      success: true,
      data: {
        email: users[0].email,
        requiresPasswordChange: firstLogin,
        fullName: tpoProfiles?.[0]?.full_name || "Placement Officer"
      }
    });
  } catch (error: any) {
    console.error("Error checking password status:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve security status." });
  }
});

/**
 * POST /password/send-otp
 * Generates and dispatches a secure 6-digit OTP to the authenticated TPO's email for password reset.
 */
router.post("/password/send-otp", async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const [users]: any = await db.query("SELECT id, email, status FROM users WHERE id = ?", [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const user = users[0];

    if (user.status && user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "Account is not active." });
    }

    const [profiles]: any = await db.query("SELECT full_name FROM tpo_profiles WHERE user_id = ?", [userId]);
    const fullName = profiles?.[0]?.full_name || "Placement Officer";

    // Rate-limiting: Check existing OTP timestamp to prevent spam (minimum 45 seconds cooldown)
    const [existingOtps]: any = await db.query(
      "SELECT expires_at FROM otps WHERE email = ? ORDER BY expires_at DESC LIMIT 1",
      [user.email]
    );

    if (existingOtps && existingOtps.length > 0) {
      let expDate = new Date(existingOtps[0].expires_at);
      if (typeof existingOtps[0].expires_at === "string" && !existingOtps[0].expires_at.includes("Z")) {
        expDate = new Date(existingOtps[0].expires_at.replace(" ", "T") + "Z");
      }
      // If the existing OTP was created within the last 45s (assuming 10m total validity)
      const tenMinutes = 10 * 60 * 1000;
      const createdAt = new Date(expDate.getTime() - tenMinutes);
      const secondsSinceCreated = (Date.now() - createdAt.getTime()) / 1000;

      if (secondsSinceCreated < 45 && secondsSinceCreated > 0) {
        const remaining = Math.ceil(45 - secondsSinceCreated);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before requesting another verification code.`
        });
      }
    }

    // Cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in DB (replace any previous OTPs for this email)
    await db.query("DELETE FROM otps WHERE email = ?", [user.email]);
    await db.query("INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)", [user.email, otp, expiresAt]);

    // Dispatch email
    sendTPOPasswordResetOTP(user.email, fullName, otp).catch((err) => {
      console.error("[TPO Password Reset] Failed to send email:", err);
    });

    await logTPOSecurityEvent(userId, "TPO_PASSWORD_RESET_OTP_REQUESTED", req);

    console.log(`[TPO SECURITY] Generated Password Reset OTP for TPO ${user.email}: ${otp}`);

    return res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${user.email}.`,
      expiresInMinutes: 10,
      debugOtp: process.env.NODE_ENV !== "production" ? otp : undefined
    });
  } catch (error: any) {
    console.error("Error in TPO send-otp:", error);
    return res.status(500).json({ success: false, message: "Failed to dispatch verification code." });
  }
});

/**
 * POST /password/reset-with-otp
 * Method 1: Verifies the 6-digit OTP and securely updates the TPO password.
 */
router.post("/password/reset-with-otp", async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { otp, newPassword, confirmPassword } = req.body;

    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ success: false, message: "Please provide the 6-digit verification code." });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "New password and confirmation are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match." });
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const [users]: any = await db.query("SELECT id, email, password_hash, status FROM users WHERE id = ?", [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }
    const user = users[0];

    // Verify OTP
    const cleanOtp = String(otp).trim();
    const [otps]: any = await db.query("SELECT * FROM otps WHERE email = ? AND code = ?", [user.email, cleanOtp]);
    if (!otps || otps.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid verification code. Please check and try again." });
    }

    const otpRecord = otps[0];
    let expiryDate: Date;
    if (otpRecord.expires_at instanceof Date) {
      expiryDate = otpRecord.expires_at;
    } else {
      const dateStr = String(otpRecord.expires_at);
      if (dateStr.includes(" ") && !dateStr.includes("T")) {
        expiryDate = new Date(dateStr.replace(" ", "T") + "Z");
      } else if (!dateStr.includes("Z") && !dateStr.includes("+")) {
        expiryDate = new Date(dateStr + "Z");
      } else {
        expiryDate = new Date(dateStr);
      }
    }

    if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
      return res.status(400).json({ success: false, message: "Verification code has expired. Please request a new code." });
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be identical to your current password for security reasons."
      });
    }

    // Hash new password with 12 rounds
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and clear any lockouts
    await db.query(
      "UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
      [hashedPassword, userId]
    );

    // Mark first_login as completed
    await db.query("UPDATE tpo_profiles SET first_login = 0 WHERE user_id = ?", [userId]);

    // Single-use: delete used OTP
    await db.query("DELETE FROM otps WHERE email = ?", [user.email]);

    // Log security event
    await logTPOSecurityEvent(userId, "TPO_PASSWORD_RESET_OTP_SUCCESS", req, "Password reset via verified email OTP");

    // Fetch full name for email alert
    const [profiles]: any = await db.query("SELECT full_name FROM tpo_profiles WHERE user_id = ?", [userId]);
    const fullName = profiles?.[0]?.full_name || "Placement Officer";

    // Send confirmation alert
    sendTPOPasswordChangedAlert(user.email, fullName, req.ip).catch(() => {});

    return res.json({
      success: true,
      message: "Your password has been successfully reset! Your new credentials are now active."
    });
  } catch (error: any) {
    console.error("Error resetting TPO password with OTP:", error);
    return res.status(500).json({ success: false, message: "Failed to reset password. Please try again." });
  }
});

/**
 * POST /password/change-direct
 * Method 2: Verifies current password and updates to new password.
 */
router.post("/password/change-direct", async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ success: false, message: "Current password is required." });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "New password and confirmation are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match." });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password."
      });
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const [users]: any = await db.query("SELECT id, email, password_hash, status FROM users WHERE id = ?", [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }
    const user = users[0];

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      await logTPOSecurityEvent(userId, "TPO_PASSWORD_CHANGE_FAILED", req, "Invalid current password attempt");
      return res.status(401).json({ success: false, message: "The current password you entered is incorrect." });
    }

    // Hash new password with 12 rounds
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update DB
    await db.query(
      "UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
      [hashedPassword, userId]
    );

    // Mark first_login as completed
    await db.query("UPDATE tpo_profiles SET first_login = 0 WHERE user_id = ?", [userId]);

    // Log security event
    await logTPOSecurityEvent(userId, "TPO_PASSWORD_CHANGE_DIRECT_SUCCESS", req, "Password changed using current credentials");

    // Fetch full name for email alert
    const [profiles]: any = await db.query("SELECT full_name FROM tpo_profiles WHERE user_id = ?", [userId]);
    const fullName = profiles?.[0]?.full_name || "Placement Officer";

    // Send confirmation alert
    sendTPOPasswordChangedAlert(user.email, fullName, req.ip).catch(() => {});

    return res.json({
      success: true,
      message: "Your password has been changed successfully."
    });
  } catch (error: any) {
    console.error("Error changing TPO password directly:", error);
    return res.status(500).json({ success: false, message: "Failed to update password. Please try again." });
  }
});

export default router;

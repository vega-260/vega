import type { Request } from "express";
import db from "../../db.ts";
export async function logAdminAction(adminId: number, action: string, details: unknown, req: Request) {
  try {
    const ip = req.ip || req.socket?.remoteAddress || null;
    await db.query(`INSERT INTO admin_logs (admin_id, action, details, ip_address) VALUES (?, ?, ?, ?)`, [adminId, action, typeof details === "string" ? details : JSON.stringify(details ?? {}), ip]);
  } catch (error) {
    console.error("Admin audit logging failed:", error);
  }
}

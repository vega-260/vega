import type { Router } from "express";
import db from "../../db.ts";
import { authenticate } from "../../middleware/auth.ts";
import { verifyToken } from "../../services/authService.ts";
import { getCloudObjectByUrl } from "../../services/storageService.ts";
import fs from "fs";
import path from "path";
import { dropsUploadDir, dropImageUpload, validateAndSanitizeDiskImage, runAsyncGeminiModeration } from "./dropMediaService.ts";

type CompanyResolver = (userId: number, requiredAction?: string) => Promise<any>;

export function registerDropRoutes(router: Router, resolveCompanyAndCheckPermission: CompanyResolver) {
// Status-aware media serving route
router.get(["/drops/media/:mediaId", "/jobs/drops/media/:mediaId"], async (req: any, res) => {
  try {
    const { mediaId } = req.params;
    const [mediaRows]: any = await db.query(
      `SELECT m.*, d.status as drop_status, d.company_id as drop_company_id 
       FROM drop_media m 
       LEFT JOIN drops d ON m.drop_id = d.id 
       WHERE m.id = ?`,
      [mediaId]
    );

    if (!mediaRows || mediaRows.length === 0) {
      return res.status(404).json({ success: false, message: "Media file not found." });
    }

    const media = mediaRows[0];
    if (media.status === 'DELETED' || media.moderation_status === 'REJECTED') {
      return res.status(404).json({ success: false, message: "Media file is unavailable." });
    }

    // Check visibility permissions
    if (media.drop_status === 'ACTIVE') {
      // Publicly accessible for active published drops
    } else {
      // Pending upload or non-active drop media requires authenticated company user
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(403).json({ success: false, message: "Access denied. Authentication required for unpublished media." });
      }
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const decoded: any = verifyToken(token);
      if (!decoded?.userId) {
        return res.status(401).json({ success: false, message: "Invalid token." });
      }
      const authCheck = await resolveCompanyAndCheckPermission(Number(decoded.userId), 'VIEW');
      if (authCheck.error || Number(authCheck.companyId) !== Number(media.company_id)) {
        return res.status(403).json({ success: false, message: "Access denied to private company media." });
      }
    }

    if (typeof media.file_url === "string" && /^https:\/\//i.test(media.file_url)) {
      try {
        const object = await getCloudObjectByUrl(media.file_url);
        res.setHeader("Content-Type", object.contentType || media.mime_type || "application/octet-stream");
        if (object.contentLength) res.setHeader("Content-Length", String(object.contentLength));
        res.setHeader("Cache-Control", media.drop_status === "ACTIVE" ? "public, max-age=300" : "private, no-store");
        const body: any = object.body;
        if (typeof body.pipe === "function") return body.pipe(res);
        const bytes = await body.transformToByteArray();
        return res.end(Buffer.from(bytes));
      } catch (error) {
        console.error("Cloud Drop media read failed:", error);
        return res.status(503).json({ success: false, message: "Media storage is temporarily unavailable." });
      }
    }

    const storageKey = media.storage_key || media.file_name || path.basename(media.file_url || '');
    if (!storageKey) {
      return res.status(404).json({ success: false, message: "Media file reference missing." });
    }

    const filePath = path.join(dropsUploadDir, storageKey);
    if (!filePath.startsWith(dropsUploadDir)) {
      return res.status(403).json({ success: false, message: "Invalid file path." });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Physical file missing on server." });
    }

    res.setHeader("Content-Type", media.mime_type || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return fs.createReadStream(filePath).pipe(res);
  } catch (err: any) {
    console.error("Error serving drop media:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Endpoint for multipart image upload & asynchronous AI moderation
router.post(["/drops/upload-image", "/jobs/drops/upload-image"], authenticate, dropImageUpload.single("image"), async (req: any, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    const authCheck = await resolveCompanyAndCheckPermission(userId, "CREATE");
    if (authCheck.error) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(authCheck.statusCode!).json({ success: false, message: authCheck.error });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided." });
    }

    const filePath = req.file.path;
    const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");

    const sanitizeRes = await validateAndSanitizeDiskImage(filePath);

    if (!sanitizeRes.valid) {
      return res.status(422).json({
        success: false,
        message: sanitizeRes.message,
        reasonCode: sanitizeRes.reasonCode
      });
    }

    const storageKey = path.basename(filePath);

    // Create pending drop_media record
    const [insertRes]: any = await db.query(`
      INSERT INTO drop_media (
        company_id, uploaded_by_user_id, storage_key, sanitized_original_name, file_url, file_name, mime_type, size_bytes, width, height, content_hash, moderation_status, moderation_reason_code, moderation_provider, moderation_model, status
      ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', 'GEMINI', 'gemini-2.5-flash', 'PENDING')
    `, [
      authCheck.companyId,
      userId,
      storageKey,
      sanitizedName,
      sanitizedName,
      sanitizeRes.mimeType,
      sanitizeRes.sizeBytes,
      sanitizeRes.width,
      sanitizeRes.height,
      sanitizeRes.contentHash
    ]);

    const mediaId = insertRes.insertId;
    const previewUrl = `/api/jobs/drops/media/${mediaId}`;

    await db.query(`UPDATE drop_media SET file_url = ? WHERE id = ?`, [previewUrl, mediaId]);

    // Trigger AI moderation asynchronously outside HTTP upload response
    setImmediate(() => {
      void runAsyncGeminiModeration(mediaId, authCheck.companyId, filePath, sanitizeRes.mimeType || "image/jpeg").catch(async error => {
        console.error("Drop media background moderation failed:", error);
        try {
          await db.query(`
            UPDATE drop_media
            SET moderation_status = 'MODERATION_FAILED', moderation_reason_code = 'WORKER_ERROR', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND company_id = ? AND moderation_status = 'PROCESSING' AND status NOT IN ('DELETED', 'REJECTED', 'EXPIRED')
          `, [mediaId, authCheck.companyId]);
        } catch (fbErr) {
          console.error("Fallback status update failed for media:", mediaId, fbErr);
        }
      });
    });

    return res.json({
      success: true,
      data: {
        mediaId,
        fileName: sanitizedName,
        mediaUrl: previewUrl,
        moderationStatus: "PENDING"
      },
      mediaId,
      previewUrl,
      imageUrl: previewUrl,
      fileName: sanitizedName,
      moderationStatus: "PENDING",
      fileSize: sanitizeRes.sizeBytes,
      mimeType: sanitizeRes.mimeType,
      width: sanitizeRes.width,
      height: sanitizeRes.height,
      message: "Image uploaded and queued for safety verification."
    });
  } catch (error: any) {
    console.error("Error uploading drop image:", error);
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
});

// Endpoint to check media moderation status
router.get(["/drops/media/:mediaId/status", "/jobs/drops/media/:mediaId/status"], authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    const authCheck = await resolveCompanyAndCheckPermission(userId, "VIEW");
    if (authCheck.error) {
      return res.status(authCheck.statusCode!).json({ success: false, message: authCheck.error });
    }

    const mediaId = Number(req.params.mediaId);
    if (!mediaId || isNaN(mediaId)) {
      return res.status(400).json({ success: false, message: "Invalid media ID." });
    }

    const [rows]: any = await db.query(
      `SELECT id, company_id, moderation_status, moderation_reason_code, status FROM drop_media WHERE id = ?`,
      [mediaId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Media item not found." });
    }

    const media = rows[0];
    if (Number(media.company_id) !== Number(authCheck.companyId)) {
      return res.status(403).json({ success: false, message: "Forbidden: Media item belongs to another company." });
    }

    let message = "Image verification is in progress.";
    if (media.moderation_status === "APPROVED") {
      message = "Image verified and ready.";
    } else if (media.moderation_status === "REJECTED") {
      message = "This image could not be accepted. Please choose another image.";
    } else if (media.moderation_status === "MODERATION_FAILED") {
      message = "Image verification could not be completed. Retry verification or remove the image.";
    }

    return res.json({
      success: true,
      data: {
        mediaId: media.id,
        moderationStatus: media.moderation_status,
        moderationReasonCode: media.moderation_reason_code,
        message
      }
    });
  } catch (error: any) {
    console.error("Error checking media status:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Endpoint to retry AI moderation on an unverified media item
router.post(["/drops/media/:mediaId/retry-moderation", "/jobs/drops/media/:mediaId/retry-moderation"], authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    const authCheck = await resolveCompanyAndCheckPermission(userId, "Drops Create");
    if (authCheck.error) {
      return res.status(authCheck.statusCode!).json({ success: false, message: authCheck.error });
    }

    const mediaId = Number(req.params.mediaId);
    if (!mediaId || isNaN(mediaId)) {
      return res.status(400).json({ success: false, message: "Invalid media ID." });
    }

    const [rows]: any = await db.query(
      `SELECT id, company_id, storage_key, mime_type, moderation_status FROM drop_media WHERE id = ?`,
      [mediaId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Media item not found." });
    }

    const media = rows[0];
    if (Number(media.company_id) !== Number(authCheck.companyId)) {
      return res.status(403).json({ success: false, message: "Forbidden: Media item belongs to another company." });
    }

    if (media.moderation_status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Image is already verified and approved."
      });
    }

    if (media.moderation_status === "PENDING" || media.moderation_status === "PROCESSING") {
      return res.status(400).json({
        success: false,
        message: "Image moderation is currently in progress."
      });
    }

    if (media.moderation_status === "REJECTED") {
      return res.status(400).json({
        success: false,
        message: "This image was rejected by safety policy and cannot be retried."
      });
    }

    if (media.moderation_status !== "MODERATION_FAILED") {
      return res.status(400).json({
        success: false,
        message: "Only images with failed moderation status can be retried."
      });
    }

    const filePath = path.join(dropsUploadDir, media.storage_key);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Physical image file missing on server." });
    }

    // Trigger moderation retry asynchronously
    setImmediate(() => {
      void runAsyncGeminiModeration(mediaId, authCheck.companyId, filePath, media.mime_type || "image/jpeg").catch(async error => {
        console.error("Drop media retry background moderation failed:", error);
        try {
          await db.query(`
            UPDATE drop_media
            SET moderation_status = 'MODERATION_FAILED', moderation_reason_code = 'WORKER_ERROR', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND company_id = ? AND moderation_status = 'PROCESSING' AND status NOT IN ('DELETED', 'REJECTED', 'EXPIRED')
          `, [mediaId, authCheck.companyId]);
        } catch (fbErr) {
          console.error("Fallback status update failed for media:", mediaId, fbErr);
        }
      });
    });

    return res.json({
      success: true,
      data: {
        mediaId: media.id,
        moderationStatus: "PENDING",
        message: "Moderation retry initiated."
      }
    });
  } catch (error: any) {
    console.error("Error retrying media moderation:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Get all drops for the authenticated company
router.get(["/drops/all", "/company/drops"], authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User is not authenticated." });
    }

    const authCheck = await resolveCompanyAndCheckPermission(userId, "VIEW");
    if (authCheck.error) {
      return res.status(authCheck.statusCode!).json({ success: false, message: authCheck.error });
    }

    const companyId = authCheck.companyId;

    const [drops]: any = await db.query(`
      SELECT 
        D.*,
        J.title as job_title,
        (SELECT COUNT(DISTINCT viewer_user_id) FROM drop_views WHERE drop_id = D.id) as real_views_count,
        (SELECT COUNT(DISTINCT user_id) FROM drop_likes WHERE drop_id = D.id) as real_likes_count,
        (SELECT COUNT(*) FROM drop_comments WHERE drop_id = D.id) as real_comments_count
      FROM drops D
      LEFT JOIN jobs J ON D.job_id = J.id
      WHERE D.company_id = ? AND D.status != 'DELETED'
      ORDER BY D.created_at DESC
    `, [companyId]);

    const dropIds = drops.map((d: any) => Number(d.id)).filter(Number.isFinite);
    const mediaByDrop = new Map<number, any[]>();
    if (dropIds.length > 0) {
      const placeholders = dropIds.map(() => '?').join(',');
      const [allMedia]: any = await db.query(
        `SELECT id, drop_id FROM drop_media WHERE drop_id IN (${placeholders}) AND status != 'DELETED' AND moderation_status = 'APPROVED' ORDER BY id`,
        dropIds
      );
      for (const media of allMedia || []) {
        const id = Number(media.drop_id);
        if (!mediaByDrop.has(id)) mediaByDrop.set(id, []);
        mediaByDrop.get(id)!.push(media);
      }
    }
    const formattedDrops = drops.map((d: any) => {
      const mediaRows = mediaByDrop.get(Number(d.id)) || [];
      const mediaUrls = mediaRows.map((m: any) => `/api/jobs/drops/media/${m.id}`);
      return {
        ...d,
        views_count: d.real_views_count !== undefined ? d.real_views_count : (d.views_count || 0),
        likes_count: d.real_likes_count !== undefined ? d.real_likes_count : (d.likes_count || 0),
        comments_count: d.real_comments_count !== undefined ? d.real_comments_count : (d.comments_count || 0),
        images: mediaUrls,
        mediaItems: mediaRows.map((m: any) => ({ id: m.id, url: `/api/jobs/drops/media/${m.id}` }))
      };
    });

    return res.json({ success: true, data: formattedDrops });
  } catch (error) {
    console.error("Error fetching company drops:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Get single drop details
router.get("/drops/:dropId", authenticate, async (req: any, res) => {
  try {
    const { dropId } = req.params;
    const [drops]: any = await db.query(`
      SELECT D.*, J.title as job_title, C.company_name, C.logo_url,
        (SELECT COUNT(DISTINCT viewer_user_id) FROM drop_views WHERE drop_id = D.id) as real_views_count,
        (SELECT COUNT(DISTINCT user_id) FROM drop_likes WHERE drop_id = D.id) as real_likes_count,
        (SELECT COUNT(*) FROM drop_comments WHERE drop_id = D.id) as real_comments_count
      FROM drops D
      LEFT JOIN jobs J ON D.job_id = J.id
      LEFT JOIN company_profiles C ON D.company_id = C.id
      WHERE D.id = ? AND D.status != 'DELETED'
    `, [dropId]);

    if (!drops || drops.length === 0) {
      return res.status(404).json({ success: false, message: "Drop not found." });
    }

    const drop = drops[0];
    drop.views_count = drop.real_views_count;
    drop.likes_count = drop.real_likes_count;
    drop.comments_count = drop.real_comments_count;

    const [mediaRows]: any = await db.query(
      `SELECT id FROM drop_media WHERE drop_id = ? AND status != 'DELETED' AND moderation_status = 'APPROVED'`,
      [dropId]
    );
    const mediaUrls = mediaRows.map((m: any) => `/api/jobs/drops/media/${m.id}`);
    drop.images = mediaUrls;
    drop.mediaItems = mediaRows.map((m: any) => ({ id: m.id, url: `/api/jobs/drops/media/${m.id}` }));

    return res.json({ success: true, data: drop });
  } catch (error) {
    console.error("Error fetching drop detail:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Create a new drop (atomic transaction)
router.post(["/drops", "/drops/create", "/company/drops/create", "/jobs/drops/create"], authenticate, async (req: any, res) => {
  const { title, type, customLabel, description, jobId, location, scheduledAt, mediaIds, images } = req.body;

  try {
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ success: false, message: "User is not authenticated." });

    const authCheck = await resolveCompanyAndCheckPermission(userId, "CREATE");
    if (authCheck.error) {
      return res.status(authCheck.statusCode!).json({ success: false, message: authCheck.error });
    }
    const companyId = authCheck.companyId;

    let requestedMediaIds: number[] = [];
    if (Array.isArray(mediaIds)) {
      requestedMediaIds = mediaIds.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    } else if (Array.isArray(images)) {
      for (const img of images) {
        if (typeof img === 'number') {
          requestedMediaIds.push(img);
        } else if (typeof img === 'string') {
          const match = img.match(/\/drops\/media\/(\d+)/);
          if (match) requestedMediaIds.push(parseInt(match[1], 10));
        }
      }
    }

    if (requestedMediaIds.length > 4) {
      return res.status(400).json({ success: false, message: "Maximum 4 images allowed per drop." });
    }

    const CANONICAL_TYPES: Record<string, string> = {
      'HIRING': 'HIRING_ALERT',
      'HIRING_ALERT': 'HIRING_ALERT',
      'TECH': 'TECH_UPDATE',
      'TECH_UPDATE': 'TECH_UPDATE',
      'EVENT_MEET': 'CAMPUS_MEET',
      'CAMPUS_MEET': 'CAMPUS_MEET',
      'MILESTONE': 'MILESTONE',
      'EVENTS': 'EVENT',
      'EVENT': 'EVENT',
      'BLOG': 'BLOG',
      'CUSTOM': 'CUSTOM'
    };

    const uppercaseTypeInput = (type || "").toUpperCase().trim();
    const canonicalType = CANONICAL_TYPES[uppercaseTypeInput];
    if (!canonicalType) {
      return res.status(400).json({ success: false, message: "Invalid drop category selected." });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ success: false, message: "Drop title is required." });
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ success: false, message: "Description is required." });
    }

    let finalCustomLabel: string | null = null;
    if (canonicalType === 'CUSTOM') {
      if (!customLabel || typeof customLabel !== 'string' || !customLabel.trim()) {
        return res.status(400).json({ success: false, message: "Custom Drop label is required." });
      }
      finalCustomLabel = customLabel.trim().slice(0, 50);
    }

    let verifiedJobId = null;
    if (jobId && jobId !== "") {
      const [jobs]: any = await db.query("SELECT id FROM jobs WHERE id = ? AND company_id = ?", [jobId, companyId]);
      if (jobs.length > 0) {
        verifiedJobId = jobs[0].id;
      } else {
        return res.status(400).json({ success: false, message: "Linked job posting was not found for this company." });
      }
    }

    if (requestedMediaIds.length > 0) {
      const uniqueMediaIds = Array.from(new Set(requestedMediaIds));
      const placeholders = uniqueMediaIds.map(() => "?").join(",");

      const [mediaRows]: any = await db.query(
        `SELECT id, company_id, moderation_status, status, drop_id FROM drop_media WHERE id IN (${placeholders})`,
        [...uniqueMediaIds]
      );

      const foundMap = new Map<number, any>();
      if (Array.isArray(mediaRows)) {
        for (const row of mediaRows) {
          foundMap.set(Number(row.id), row);
        }
      }

      for (const id of uniqueMediaIds) {
        const m = foundMap.get(id);
        if (!m) {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} not found in drop_media database.`);
          return res.status(400).json({ success: false, message: "One or more selected media items do not exist." });
        }
        if (Number(m.company_id) !== Number(companyId)) {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} belongs to company ${m.company_id}, expected ${companyId}.`);
          return res.status(403).json({ success: false, message: "Forbidden: Selected media item belongs to another company." });
        }
        if (m.moderation_status !== 'APPROVED') {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} moderation status is ${m.moderation_status}.`);
          return res.status(400).json({ success: false, message: "One or more selected media items have not passed safety moderation." });
        }
        if (m.status === 'DELETED') {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} status is DELETED.`);
          return res.status(400).json({ success: false, message: "One or more selected media items are deleted." });
        }
        if (m.drop_id !== null) {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} is already attached to drop_id ${m.drop_id}.`);
          return res.status(400).json({ success: false, message: "One or more selected media items are already attached to another drop." });
        }
      }
    }

    await db.transaction(async (tx) => {
      const [result]: any = await tx.query(`
        INSERT INTO drops (
          company_id, job_id, created_by_user_id, title, type, custom_label, description, location, scheduled_at, status, views_count, likes_count, comments_count, shares_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, 0, 0, 0)
      `, [
        companyId,
        verifiedJobId,
        userId,
        title.trim(),
        canonicalType,
        finalCustomLabel,
        description.trim(),
        location ? location.trim() : null,
        scheduledAt || null
      ]);

      const newDropId = result.insertId;

      if (requestedMediaIds.length > 0) {
        const uniqueMediaIds = Array.from(new Set(requestedMediaIds));
        const placeholders = uniqueMediaIds.map(() => "?").join(",");
        await tx.query(
          `UPDATE drop_media SET drop_id = ?, status = 'APPROVED' WHERE id IN (${placeholders}) AND company_id = ?`,
          [newDropId, ...uniqueMediaIds, companyId]
        );
      }

      await tx.query(`
        INSERT INTO company_audit_logs (
          company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id
        ) VALUES (?, ?, ?, ?, 'CREATE_DROP', 'Company Drops', ?, 'drops', ?)
      `, [
        companyId,
        userId,
        `${authCheck.designation} (${req.user.email})`,
        authCheck.roleType,
        `Published Company Drop: "${title.trim()}".`,
        newDropId
      ]);

      return newDropId;
    });

    return res.status(201).json({ success: true, message: "Drop published successfully." });
  } catch (error: any) {
    console.error("Error creating drop:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
});

// Edit Drop (atomic transaction)
const handleUpdateDrop = async (req: any, res: any) => {
  const { dropId } = req.params;
  const { title, type, customLabel, description, jobId, mediaIds, images } = req.body;

  try {
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ success: false, message: "User is not authenticated." });

    const authCheck = await resolveCompanyAndCheckPermission(userId, "EDIT");
    if (authCheck.error) {
      return res.status(authCheck.statusCode!).json({ success: false, message: authCheck.error });
    }
    const companyId = authCheck.companyId;

    const [existingDrops]: any = await db.query(
      "SELECT * FROM drops WHERE id = ? AND company_id = ? AND status != 'DELETED'",
      [dropId, companyId]
    );

    if (!existingDrops || existingDrops.length === 0) {
      return res.status(404).json({ success: false, message: "Drop post not found or you do not have permission to modify it." });
    }

    const existingDrop = existingDrops[0];

    let requestedMediaIds: number[] = [];
    if (Array.isArray(mediaIds)) {
      requestedMediaIds = mediaIds.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    } else if (Array.isArray(images)) {
      for (const img of images) {
        if (typeof img === 'number') {
          requestedMediaIds.push(img);
        } else if (typeof img === 'string') {
          const match = img.match(/\/drops\/media\/(\d+)/);
          if (match) requestedMediaIds.push(parseInt(match[1], 10));
        }
      }
    }

    if (requestedMediaIds.length > 4) {
      return res.status(400).json({ success: false, message: "Maximum 4 images allowed per drop." });
    }

    const CANONICAL_TYPES: Record<string, string> = {
      'HIRING': 'HIRING_ALERT',
      'HIRING_ALERT': 'HIRING_ALERT',
      'TECH': 'TECH_UPDATE',
      'TECH_UPDATE': 'TECH_UPDATE',
      'EVENT_MEET': 'CAMPUS_MEET',
      'CAMPUS_MEET': 'CAMPUS_MEET',
      'MILESTONE': 'MILESTONE',
      'EVENTS': 'EVENT',
      'EVENT': 'EVENT',
      'BLOG': 'BLOG',
      'CUSTOM': 'CUSTOM'
    };

    const uppercaseTypeInput = (type || existingDrop.type).toUpperCase().trim();
    const canonicalType = CANONICAL_TYPES[uppercaseTypeInput];
    if (!canonicalType) {
      return res.status(400).json({ success: false, message: "Invalid drop category selected." });
    }

    let finalCustomLabel: string | null = existingDrop.custom_label;
    if (canonicalType === 'CUSTOM') {
      if (!customLabel || typeof customLabel !== 'string' || !customLabel.trim()) {
        return res.status(400).json({ success: false, message: "Custom Drop label is required." });
      }
      finalCustomLabel = customLabel.trim().slice(0, 50);
    } else {
      finalCustomLabel = null;
    }

    let verifiedJobId = existingDrop.job_id;
    if (jobId !== undefined) {
      if (jobId && jobId !== "") {
        const [jobs]: any = await db.query("SELECT id FROM jobs WHERE id = ? AND company_id = ?", [jobId, companyId]);
        if (jobs.length > 0) {
          verifiedJobId = jobs[0].id;
        } else {
          return res.status(400).json({ success: false, message: "Linked job posting was not found for this company." });
        }
      } else {
        verifiedJobId = null;
      }
    }

    if (requestedMediaIds.length > 0) {
      const uniqueMediaIds = Array.from(new Set(requestedMediaIds));
      const placeholders = uniqueMediaIds.map(() => "?").join(",");

      const [mediaRows]: any = await db.query(
        `SELECT id, company_id, moderation_status, status, drop_id FROM drop_media WHERE id IN (${placeholders})`,
        [...uniqueMediaIds]
      );

      const foundMap = new Map<number, any>();
      if (Array.isArray(mediaRows)) {
        for (const row of mediaRows) {
          foundMap.set(Number(row.id), row);
        }
      }

      for (const id of uniqueMediaIds) {
        const m = foundMap.get(id);
        if (!m) {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} not found in drop_media database.`);
          return res.status(400).json({ success: false, message: "One or more selected media items do not exist." });
        }
        if (Number(m.company_id) !== Number(companyId)) {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} belongs to company ${m.company_id}, expected ${companyId}.`);
          return res.status(403).json({ success: false, message: "Forbidden: Selected media item belongs to another company." });
        }
        if (m.moderation_status !== 'APPROVED') {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} moderation status is ${m.moderation_status}.`);
          return res.status(400).json({ success: false, message: "One or more selected media items have not passed safety moderation." });
        }
        if (m.status === 'DELETED') {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} status is DELETED.`);
          return res.status(400).json({ success: false, message: "One or more selected media items are deleted." });
        }
        if (m.drop_id !== null && Number(m.drop_id) !== Number(dropId)) {
          console.warn(`[DROP_MEDIA_VALIDATION] Media ID ${id} is already attached to another drop_id ${m.drop_id}.`);
          return res.status(400).json({ success: false, message: "One or more selected media items are already attached to another drop." });
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.query(`
        UPDATE drops SET
          title = ?,
          type = ?,
          custom_label = ?,
          description = ?,
          job_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `, [
        title ? title.trim() : existingDrop.title,
        canonicalType,
        finalCustomLabel,
        description ? description.trim() : existingDrop.description,
        verifiedJobId,
        dropId,
        companyId
      ]);

      if (requestedMediaIds.length > 0) {
        const uniqueMediaIds = Array.from(new Set(requestedMediaIds));
        const placeholders = uniqueMediaIds.map(() => "?").join(",");

        await tx.query(`
          UPDATE drop_media SET drop_id = NULL, status = 'UNLINKED' WHERE drop_id = ? AND id NOT IN (${placeholders}) AND company_id = ?
        `, [dropId, ...uniqueMediaIds, companyId]);

        await tx.query(`
          UPDATE drop_media SET drop_id = ?, status = 'APPROVED' WHERE id IN (${placeholders}) AND company_id = ?
        `, [dropId, ...uniqueMediaIds, companyId]);
      } else {
        await tx.query(`
          UPDATE drop_media SET drop_id = NULL, status = 'UNLINKED' WHERE drop_id = ? AND company_id = ?
        `, [dropId, companyId]);
      }

      await tx.query(`
        INSERT INTO company_audit_logs (
          company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id
        ) VALUES (?, ?, ?, ?, 'UPDATE_DROP', 'Company Drops', ?, 'drops', ?)
      `, [
        companyId,
        userId,
        `${authCheck.designation} (${req.user.email})`,
        authCheck.roleType,
        `Updated Company Drop: "${title ? title.trim() : existingDrop.title}".`,
        dropId
      ]);
    });

    return res.json({ success: true, message: "Drop updated successfully." });
  } catch (error: any) {
    console.error("Error updating drop:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

router.put(["/drops/:dropId", "/company/drops/:dropId", "/jobs/drops/:dropId"], authenticate, handleUpdateDrop);
router.patch(["/drops/:dropId", "/company/drops/:dropId", "/jobs/drops/:dropId"], authenticate, handleUpdateDrop);

// Delete Drop (atomic transaction)
router.delete(["/drops/:dropId", "/company/drops/:dropId", "/jobs/drops/:dropId"], authenticate, async (req: any, res) => {
  const { dropId } = req.params;

  try {
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ success: false, message: "User is not authenticated." });

    const authCheck = await resolveCompanyAndCheckPermission(userId, "DELETE");
    if (authCheck.error) {
      return res.status(authCheck.statusCode!).json({ success: false, message: authCheck.error });
    }
    const companyId = authCheck.companyId;

    const [drops]: any = await db.query(
      "SELECT id, title FROM drops WHERE id = ? AND company_id = ? AND status != 'DELETED'",
      [dropId, companyId]
    );

    if (!drops || drops.length === 0) {
      return res.status(404).json({ success: false, message: "Drop post not found or you do not have permission to delete it." });
    }

    const drop = drops[0];

    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE drops SET status = 'DELETED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?",
        [dropId, companyId]
      );

      await tx.query(
        "UPDATE drop_media SET status = 'DELETED', updated_at = CURRENT_TIMESTAMP WHERE drop_id = ? AND company_id = ?",
        [dropId, companyId]
      );

      await tx.query(`
        INSERT INTO company_audit_logs (
          company_id, actor_user_id, actor_name, actor_role, action_type, module, description, target_type, target_id
        ) VALUES (?, ?, ?, ?, 'DELETE_DROP', 'Company Drops', ?, 'drops', ?)
      `, [
        companyId,
        userId,
        `${authCheck.designation} (${req.user.email})`,
        authCheck.roleType,
        `Deleted Company Drop: "${drop.title}".`,
        dropId
      ]);
    });

    return res.json({ success: true, message: "Drop deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting drop:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
});

// Record view on drop
router.post("/drops/:dropId/view", authenticate, async (req: any, res) => {
  try {
    const { dropId } = req.params;
    const userId = req.user.userId;

    const [students]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ?", [userId]);
    if (!students || students.length === 0) {
      return res.json({ success: true, message: "Company view ignored for engagement count." });
    }

    if (db.useMySQL) {
      await db.query(`
        INSERT INTO drop_views (drop_id, viewer_user_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE viewed_at = CURRENT_TIMESTAMP
      `, [dropId, userId]);
    } else {
      const [existing]: any = await db.query(`SELECT id FROM drop_views WHERE drop_id = ? AND viewer_user_id = ?`, [dropId, userId]);
      if (existing && existing.length > 0) {
        await db.query(`UPDATE drop_views SET viewed_at = CURRENT_TIMESTAMP WHERE id = ?`, [existing[0].id]);
      } else {
        await db.query(`INSERT INTO drop_views (drop_id, viewer_user_id) VALUES (?, ?)`, [dropId, userId]);
      }
    }

    return res.json({ success: true, message: "View recorded." });
  } catch (error) {
    console.error("Error recording drop view:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Toggle like on drop
router.post("/drops/:dropId/like", authenticate, async (req: any, res) => {
  try {
    const { dropId } = req.params;
    const userId = req.user.userId;

    const [existing]: any = await db.query(
      "SELECT id FROM drop_likes WHERE drop_id = ? AND user_id = ?",
      [dropId, userId]
    );

    let liked = false;
    if (existing && existing.length > 0) {
      await db.query("DELETE FROM drop_likes WHERE drop_id = ? AND user_id = ?", [dropId, userId]);
      liked = false;
    } else {
      await db.query("INSERT INTO drop_likes (drop_id, user_id) VALUES (?, ?)", [dropId, userId]);
      liked = true;
    }

    await db.query(`
      UPDATE drops SET likes_count = (SELECT COUNT(DISTINCT user_id) FROM drop_likes WHERE drop_id = ?) WHERE id = ?
    `, [dropId, dropId]);

    return res.json({ success: true, liked });
  } catch (error) {
    console.error("Error toggling drop like:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Add comment to drop
router.post("/drops/:dropId/comments", authenticate, async (req: any, res) => {
  try {
    const { dropId } = req.params;
    const { commentText } = req.body;
    const userId = req.user.userId;

    if (!commentText || typeof commentText !== 'string' || !commentText.trim()) {
      return res.status(400).json({ success: false, message: "Comment text is required." });
    }

    await db.query(
      "INSERT INTO drop_comments (drop_id, user_id, comment_text) VALUES (?, ?, ?)",
      [dropId, userId, commentText.trim()]
    );

    await db.query(`
      UPDATE drops SET comments_count = (SELECT COUNT(*) FROM drop_comments WHERE drop_id = ?) WHERE id = ?
    `, [dropId, dropId]);

    return res.json({ success: true, message: "Comment added." });
  } catch (error) {
    console.error("Error adding drop comment:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Get comments for drop
router.get("/drops/:dropId/comments", authenticate, async (req: any, res) => {
  try {
    const { dropId } = req.params;
    const [comments]: any = await db.query(`
      SELECT DC.id, DC.comment_text, DC.created_at, U.email, U.name
      FROM drop_comments DC
      JOIN users U ON DC.user_id = U.id
      WHERE DC.drop_id = ?
      ORDER BY DC.created_at DESC
    `, [dropId]);

    return res.json({ success: true, data: comments });
  } catch (error) {
    console.error("Error fetching drop comments:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});


}

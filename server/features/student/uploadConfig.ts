import multer from "multer";
import path from "path";

export function isSafeExtension(filename: string, allowedExts: string[]): boolean {
  const ext = path.extname(filename).toLowerCase();
  const parts = filename.split(".");
  if (parts.length > 2) {
    const dangerous = new Set([".js", ".jsx", ".ts", ".tsx", ".sh", ".bash", ".php", ".exe", ".bat", ".cmd", ".py", ".pl", ".html", ".htm", ".jsp", ".asp", ".aspx"]);
    for (const part of parts) if (dangerous.has(`.${part.toLowerCase()}`)) return false;
  }
  return allowedExts.includes(ext);
}

export function createMemoryUpload(field: "resume" | "avatar" | "certificate") {
  const limits = { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 };
  return multer({
    storage: multer.memoryStorage(),
    limits,
    fileFilter: (_req, file, cb) => {
      const allowed = field === "resume"
        ? file.mimetype === "application/pdf" && isSafeExtension(file.originalname, [".pdf"])
        : field === "avatar"
          ? ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.mimetype) && isSafeExtension(file.originalname, [".png", ".jpg", ".jpeg", ".webp", ".gif"])
          : (file.mimetype === "application/pdf" || ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) && isSafeExtension(file.originalname, [".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
      if (allowed) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported or unsafe ${field} file type`));
      }
    },
  });
}

export const uploadResume = createMemoryUpload("resume");
export const uploadAvatar = createMemoryUpload("avatar");
export const uploadCertificate = createMemoryUpload("certificate");

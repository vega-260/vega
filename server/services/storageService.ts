import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import crypto from "crypto";

let s3Client: S3Client | null = null;
const bucketName = process.env.AWS_S3_BUCKET_NAME;

// Lazy initialize the SDK only when needed & credentials exist
function getS3Client(): S3Client | null {
  if (!s3Client) {
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (accessKey && secretKey && bucketName) {
      try {
        s3Client = new S3Client({
          region,
          credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
          },
        });
        console.log("☁️  AWS S3 storage driver initialized successfully.");
      } catch (err) {
        console.warn("⚠️  Failed to initialize AWS S3 storage client:", err);
        return null;
      }
    }
  }
  return s3Client;
}

/**
 * Persists an uploaded file either to AWS S3 or the fallback local container storage.
 * @param localFilePath The current temp location of the uploaded file on disk.
 * @param originalName Name of the file before upload, to determine extensions.
 * @param mimeType The content MIME metadata definition.
 */
export async function uploadToCloudBucket(
  localFilePath: string,
  originalName: string,
  mimeType: string
): Promise<string> {
  const client = getS3Client();
  const fileHashName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${path.extname(originalName)}`;

  if (client && bucketName) {
    try {
      const fileStream = fs.createReadStream(localFilePath);
      const uploadParams: any = {
        Bucket: bucketName,
        Key: `uploads/${fileHashName}`,
        Body: fileStream,
        ContentType: mimeType,
        ServerSideEncryption: "AES256",
      };

      console.log(`☁️ Unifying binary assets: Uploading ${originalName} directly to S3 Bucket [${bucketName}]...`);
      await client.send(new PutObjectCommand(uploadParams));

      // Return AWS S3 Public Resource Identifier URL
      const region = process.env.AWS_REGION || "us-east-1";
      return `https://${bucketName}.s3.${region}.amazonaws.com/uploads/${fileHashName}`;
    } catch (err) {
      console.warn("⚠️ S3 upload failed, falling back to local storage:", err);
    }
  }

  // Local persistent container storage fallback
  const targetLocalPath = path.join(process.cwd(), "uploads", fileHashName);
  
  if (localFilePath !== targetLocalPath) {
    await fs.promises.mkdir(path.dirname(targetLocalPath), { recursive: true });
    await fs.promises.rename(localFilePath, targetLocalPath);
  }

  console.log(`💾 Local Preservation: File successfully stored at relative link [ /uploads/${fileHashName} ]`);
  return `/uploads/${fileHashName}`;
}



export async function uploadBufferToCloudBucket(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  prefix = "uploads"
): Promise<string> {
  const client = getS3Client();
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "uploads";
  const extension = path.extname(originalName).toLowerCase();
  const objectKey = `${safePrefix}/${crypto.randomUUID()}${extension}`;

  if (client && bucketName) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
        ServerSideEncryption: "AES256",
      }));

      const region = process.env.AWS_REGION || "us-east-1";
      return `https://${bucketName}.s3.${region}.amazonaws.com/${objectKey}`;
    } catch (err) {
      console.warn("⚠️ S3 upload failed, using local storage fallback:", err);
    }
  }

  const localPath = path.join(process.cwd(), "uploads", objectKey.replace(/^uploads\//, ""));
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
  await fs.promises.writeFile(localPath, buffer);
  return `/uploads/${objectKey.replace(/^uploads\//, "")}`;
}

/** Reads an object previously written by this storage service without making the bucket public. */
export async function getCloudObjectByUrl(fileUrl: string): Promise<{ body: any; contentType?: string; contentLength?: number }> {
  const client = getS3Client();
  if (client && bucketName && /^https?:\/\//i.test(fileUrl)) {
    try {
      const parsed = new URL(fileUrl);
      const expectedHost = `${bucketName}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;
      if (parsed.hostname === expectedHost) {
        const key = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
        if (key.startsWith("uploads/")) {
          const object = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
          if (object.Body) {
            return { body: object.Body, contentType: object.ContentType, contentLength: object.ContentLength };
          }
        }
      }
    } catch (e) {
      console.warn("Could not retrieve cloud object from S3, checking local:", e);
    }
  }

  // Local fallback
  let relativePath = fileUrl;
  if (/^https?:\/\//i.test(relativePath)) {
    const parsed = new URL(relativePath);
    relativePath = parsed.pathname;
  }
  relativePath = relativePath.replace(/^\/+/, "");
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!absolutePath.startsWith(uploadsDir + path.sep)) throw new Error("File not found or access denied");

  if (!fs.existsSync(absolutePath)) {
    throw new Error("Object body is unavailable");
  }

  const stat = await fs.promises.stat(absolutePath);
  const stream = fs.createReadStream(absolutePath);
  return { body: stream, contentLength: stat.size };
}


/**
 * Safely removes a file created by this storage service.
 * Supports the configured S3 bucket and development-only /uploads files.
 * Deletion is idempotent: missing files are treated as already deleted.
 */
export async function deleteFromStorage(fileUrlOrPath: string): Promise<boolean> {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== "string") return true;

  try {
    const client = getS3Client();
    if (client && bucketName && /^https?:\/\//i.test(fileUrlOrPath)) {
      try {
        const parsed = new URL(fileUrlOrPath);
        const expectedHost = `${bucketName}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;
        if (parsed.hostname === expectedHost) {
          const key = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
          if (!key.startsWith("uploads/")) return false;
          await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
          return true;
        }
      } catch {
        // Fall through to local-path handling only for development paths.
      }
    }

    let relativePath = fileUrlOrPath;
    if (/^https?:\/\//i.test(relativePath)) {
      const parsed = new URL(relativePath);
      relativePath = parsed.pathname;
    }
    relativePath = relativePath.replace(/^\/+/, "");
    if (!relativePath.startsWith("uploads/")) return false;

    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const absolutePath = path.resolve(process.cwd(), relativePath);
    if (!absolutePath.startsWith(uploadsDir + path.sep)) return false;

    try {
      await fs.promises.unlink(absolutePath);
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
    return true;
  } catch (error) {
    console.error("Storage deletion failed:", error);
    return false;
  }
}

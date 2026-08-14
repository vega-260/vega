import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
      console.error("❌ S3 upload failed:", err);
      if (process.env.NODE_ENV === "production") {
        throw new Error("Object storage is temporarily unavailable");
      }
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("AWS S3 storage configuration is required in production");
  }

  // Development-only local fallback. Production containers must never persist user files locally.
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

  if (!client || !bucketName) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AWS S3 storage configuration is required in production");
    }
    const localPath = path.join(process.cwd(), "uploads", objectKey.replace(/^uploads\//, ""));
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, buffer);
    return `/uploads/${objectKey.replace(/^uploads\//, "")}`;
  }

  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
    ServerSideEncryption: "AES256",
  }));

  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucketName}.s3.${region}.amazonaws.com/${objectKey}`;
}

/** Reads an object previously written by this storage service without making the bucket public. */
export async function getCloudObjectByUrl(fileUrl: string): Promise<{ body: any; contentType?: string; contentLength?: number }> {
  const client = getS3Client();
  if (!client || !bucketName) throw new Error("Object storage is not configured");
  const parsed = new URL(fileUrl);
  const expectedHost = `${bucketName}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;
  if (parsed.hostname !== expectedHost) throw new Error("Untrusted object-storage URL");
  const key = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!key.startsWith("uploads/")) throw new Error("Invalid object-storage key");
  const object = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  if (!object.Body) throw new Error("Object body is unavailable");
  return { body: object.Body, contentType: object.ContentType, contentLength: object.ContentLength };
}

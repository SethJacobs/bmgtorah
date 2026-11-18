import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function r2() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

const ALLOWED = /^(audio\/(mpeg|mp4|x-m4a|aac|ogg|wav|x-wav|webm)|video\/(mp4|webm|quicktime)|application\/pdf|image\/(jpeg|png|webp))$/;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function isAllowedType(contentType: string) {
  return ALLOWED.test(contentType);
}

/** Builds a tidy object key: shiurim/2026/11/<random>-<cleaned-name>.mp3 */
export function makeKey(folder: "shiurim" | "sources" | "images", filename: string) {
  const now = new Date();
  const clean = filename.toLowerCase().replace(/[^a-z0-9.\-]+/g, "-").replace(/-+/g, "-").slice(-80);
  const rand = crypto.randomUUID().slice(0, 8);
  return `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${rand}-${clean}`;
}

/** A short-lived URL the browser can PUT the file to directly (the file never touches our server). */
export async function presignUpload(key: string, contentType: string) {
  const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, ContentType: contentType });
  return getSignedUrl(r2(), cmd, { expiresIn: 60 * 60 });
}

export async function deleteObject(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
}

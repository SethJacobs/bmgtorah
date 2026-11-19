import "server-only";
import { DeleteObjectCommand, GetBucketCorsCommand, GetObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Works with any S3-compatible storage. Set S3_* for Backblaze B2 (or anything else);
// the older R2_* variables still work as a fallback.
//   Backblaze B2: S3_ENDPOINT=https://s3.<region>.backblazeb2.com  S3_REGION=<region>  e.g. us-east-005
//   Cloudflare R2: S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com  S3_REGION=auto
const env = (k: string) => process.env[k] || undefined;

export const STORAGE = {
  endpoint: env("S3_ENDPOINT") ?? (env("R2_ACCOUNT_ID") ? `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com` : undefined),
  region: env("S3_REGION") ?? "auto",
  accessKeyId: env("S3_ACCESS_KEY_ID") ?? env("R2_ACCESS_KEY_ID") ?? "",
  secretAccessKey: env("S3_SECRET_ACCESS_KEY") ?? env("R2_SECRET_ACCESS_KEY") ?? "",
  bucket: env("S3_BUCKET") ?? env("R2_BUCKET") ?? "bmgtorah-media",
};

let client: S3Client | null = null;

function s3() {
  if (!client) {
    client = new S3Client({
      region: STORAGE.region,
      endpoint: STORAGE.endpoint,
      credentials: { accessKeyId: STORAGE.accessKeyId, secretAccessKey: STORAGE.secretAccessKey },
      // Presigned browser uploads must not require checksum headers the browser won't send
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
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
  const cmd = new PutObjectCommand({ Bucket: STORAGE.bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3(), cmd, { expiresIn: 60 * 60 });
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: STORAGE.bucket, Key: key }));
}

/**
 * Short-lived download/stream URL for a file in a private bucket.
 * Served through /api/media/<key>, so the bucket never has to be public.
 */
export async function presignDownload(key: string, opts: { download?: boolean; expiresIn?: number } = {}) {
  const filename = key.split("/").pop() ?? "file";
  const cmd = new GetObjectCommand({
    Bucket: STORAGE.bucket,
    Key: key,
    ...(opts.download ? { ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"` } : {}),
  });
  return getSignedUrl(s3(), cmd, { expiresIn: opts.expiresIn ?? 6 * 60 * 60 });
}

/** Lets browsers on these origins PUT files straight into the bucket (needed for uploads). */
export async function setUploadCors(origins: string[]) {
  await s3().send(new PutBucketCorsCommand({
    Bucket: STORAGE.bucket,
    CORSConfiguration: {
      CORSRules: [{
        AllowedOrigins: origins,
        AllowedMethods: ["GET", "HEAD", "PUT"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      }],
    },
  }));
}

export async function getCors() {
  try {
    const r = await s3().send(new GetBucketCorsCommand({ Bucket: STORAGE.bucket }));
    return r.CORSRules ?? [];
  } catch (e) {
    return { error: (e as Error).name + ": " + (e as Error).message };
  }
}

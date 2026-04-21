/**
 * storage.js — Cloudflare R2 (S3-compatible) object storage utility.
 *
 * Priority:
 *   1. R2_* env vars  (Cloudflare R2 — active credentials)
 *   2. Legacy AWS_* / S3_* env vars (backwards-compat with old Render/S3 config)
 *   3. Local disk fallback (dev without object storage)
 *
 * SECURITY: ALL credentials are read from process.env (server-side only).
 * None of these values are ever sent to the frontend.
 */

import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── Config resolution ────────────────────────────────────────────────────────

// Cloudflare R2 specific vars (takes priority)
const r2Endpoint  = (process.env.R2_ENDPOINT  || "").trim();
const r2AccessKey = (process.env.R2_ACCESS_KEY_ID     || "").trim();
const r2SecretKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
const r2Bucket    = (process.env.R2_BUCKET_NAME || "").trim();
const r2PublicUrl = (process.env.R2_PUBLIC_URL  || "").trim().replace(/\/$/, "");

// Legacy S3 / AWS vars (fallback)
const legacyBucket     = (process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "").trim();
const legacyRegion     = (process.env.AWS_REGION || "us-east-1").trim();
const legacyEndpoint   = (process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || "").trim();
const legacyForcePathStyle =
  process.env.S3_FORCE_PATH_STYLE === "1" || process.env.S3_FORCE_PATH_STYLE === "true";

// Local disk root
const localRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

// ─── Derived active config ────────────────────────────────────────────────────

function isR2Configured() {
  return Boolean(r2Endpoint && r2AccessKey && r2SecretKey && r2Bucket);
}

function isLegacyS3Configured() {
  return Boolean(
    legacyBucket &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

/** True when object storage (R2 or legacy S3) is available. */
export function objectStorageEnabled() {
  return isR2Configured() || isLegacyS3Configured();
}

/** True specifically when Cloudflare R2 is active. */
export function r2Enabled() {
  return isR2Configured();
}

function getActiveBucket() {
  return isR2Configured() ? r2Bucket : legacyBucket;
}

// ─── S3 client (singleton, lazy) ─────────────────────────────────────────────

let _s3Client = null;

function getS3() {
  if (!_s3Client) {
    if (isR2Configured()) {
      // Cloudflare R2: region must be "auto", forcePathStyle required
      _s3Client = new S3Client({
        region: "auto",
        endpoint: r2Endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: r2AccessKey,
          secretAccessKey: r2SecretKey,
        },
      });
    } else {
      // Legacy AWS S3 / S3-compatible
      _s3Client = new S3Client({
        region: legacyRegion,
        ...(legacyEndpoint ? { endpoint: legacyEndpoint } : {}),
        ...(legacyForcePathStyle ? { forcePathStyle: true } : {}),
      });
    }
  }
  return _s3Client;
}

// ─── Key normalisation ────────────────────────────────────────────────────────

export function normalizeUploadKey(relPath) {
  return String(relPath || "")
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .replace(/^uploads\/?/i, "");
}

export function getLocalUploadRoot() {
  return localRoot;
}

// ─── Public URL resolution ────────────────────────────────────────────────────

/**
 * Returns the fully-qualified public URL for a stored file.
 *  - R2:    uses R2_PUBLIC_URL (Cloudflare public bucket / custom domain)
 *  - Local: returns a relative /uploads/<key> path (served by Express)
 */
export function getPublicUrl(relPath) {
  const key = normalizeUploadKey(relPath);
  if (isR2Configured() && r2PublicUrl) {
    return `${r2PublicUrl}/${key}`;
  }
  return `/uploads/${key}`;
}

// ─── Presigned URLs ───────────────────────────────────────────────────────────

/**
 * Generate a presigned PUT URL so the browser can upload directly to R2.
 * Falls back to null when object storage is not enabled.
 *
 * @param {string} relPath   - storage key (e.g. "textbook/ch1.pdf")
 * @param {string} contentType - MIME type of the file
 * @param {number} expiresIn   - seconds until the URL expires (default: 900 = 15 min)
 * @returns {Promise<{uploadUrl: string, publicUrl: string, key: string} | null>}
 */
export async function getPresignedPutUrl(relPath, contentType = "application/octet-stream", expiresIn = 900) {
  if (!objectStorageEnabled()) return null;
  const key = normalizeUploadKey(relPath);
  const command = new PutObjectCommand({
    Bucket: getActiveBucket(),
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn });
  const publicUrl = getPublicUrl(key);
  return { uploadUrl, publicUrl, key };
}

/**
 * Generate a presigned GET URL for a private object (time-limited access).
 * Use this if your R2 bucket is NOT public.
 *
 * @param {string} relPath
 * @param {number} expiresIn - seconds (default: 3600 = 1 hour)
 * @returns {Promise<string | null>}
 */
export async function getPresignedGetUrl(relPath, expiresIn = 3600) {
  if (!objectStorageEnabled()) return null;
  const key = normalizeUploadKey(relPath);
  const command = new GetObjectCommand({
    Bucket: getActiveBucket(),
    Key: key,
  });
  return getSignedUrl(getS3(), command, { expiresIn });
}

// ─── Core storage operations ──────────────────────────────────────────────────

/**
 * Save a buffer to object storage (R2/S3) or local disk.
 */
export async function saveUploadBuffer(relPath, buffer, contentType = "application/octet-stream") {
  const key = normalizeUploadKey(relPath);
  if (objectStorageEnabled()) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: getActiveBucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return;
  }
  // Local fallback
  const dest = path.join(localRoot, key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
}

/**
 * Delete an object from R2/S3 or local disk.
 * Returns true if deleted, false if not found.
 */
export async function deleteUpload(relPath) {
  const key = normalizeUploadKey(relPath);
  if (objectStorageEnabled()) {
    try {
      await getS3().send(
        new DeleteObjectCommand({
          Bucket: getActiveBucket(),
          Key: key,
        })
      );
      return true;
    } catch (err) {
      console.error("[storage] deleteUpload R2 error:", err.message);
      return false;
    }
  }
  // Local fallback
  const filePath = path.join(localRoot, key);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Check whether an upload exists (local or object storage).
 */
export async function uploadExists(relPath) {
  const key = normalizeUploadKey(relPath);
  // Check local first (faster)
  if (fs.existsSync(path.join(localRoot, key))) return true;
  if (!objectStorageEnabled()) return false;
  try {
    await getS3().send(new HeadObjectCommand({ Bucket: getActiveBucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export function localFileExists(relPath) {
  const key = normalizeUploadKey(relPath);
  const dest = path.join(localRoot, key);
  return fs.existsSync(dest) && fs.statSync(dest).isFile();
}

/**
 * List objects under a prefix (R2/S3 only).
 * Returns an empty array when using local storage.
 *
 * @param {string} prefix   - key prefix (e.g. "textbook/")
 * @param {number} maxKeys  - max results (default: 200)
 */
export async function listUploads(prefix = "", maxKeys = 200) {
  if (!objectStorageEnabled()) {
    // Local fallback: list files under the prefix directory
    const dir = path.join(localRoot, prefix);
    if (!fs.existsSync(dir)) return [];
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => fs.statSync(path.join(dir, f)).isFile())
        .map((f) => ({
          key: `${prefix}${f}`,
          publicUrl: getPublicUrl(`${prefix}${f}`),
          size: fs.statSync(path.join(dir, f)).size,
          lastModified: fs.statSync(path.join(dir, f)).mtime.toISOString(),
        }));
    } catch {
      return [];
    }
  }
  try {
    const out = await getS3().send(
      new ListObjectsV2Command({
        Bucket: getActiveBucket(),
        Prefix: normalizeUploadKey(prefix),
        MaxKeys: maxKeys,
      })
    );
    return (out.Contents || []).map((obj) => ({
      key: obj.Key,
      publicUrl: getPublicUrl(obj.Key),
      size: obj.Size,
      lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
    }));
  } catch (err) {
    console.error("[storage] listUploads error:", err.message);
    return [];
  }
}

/** Readable stream + optional Content-Type, or null if missing. */
export async function getUploadReadableStream(relPath) {
  const key = normalizeUploadKey(relPath);
  const local = path.join(localRoot, key);
  if (fs.existsSync(local) && fs.statSync(local).isFile()) {
    return { stream: fs.createReadStream(local), contentType: null, source: "local" };
  }
  if (!objectStorageEnabled()) return null;
  try {
    const out = await getS3().send(new GetObjectCommand({ Bucket: getActiveBucket(), Key: key }));
    return {
      stream: out.Body,
      contentType: out.ContentType || null,
      source: isR2Configured() ? "r2" : "s3",
    };
  } catch {
    return null;
  }
}

export async function readUploadBuffer(relPath) {
  const key = normalizeUploadKey(relPath);
  const local = path.join(localRoot, key);
  if (fs.existsSync(local) && fs.statSync(local).isFile()) {
    return fs.readFileSync(local);
  }
  if (!objectStorageEnabled()) return null;
  try {
    const out = await getS3().send(new GetObjectCommand({ Bucket: getActiveBucket(), Key: key }));
    const chunks = [];
    for await (const chunk of out.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

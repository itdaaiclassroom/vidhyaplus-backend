import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const localRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");
const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "";
const region = process.env.AWS_REGION || "us-east-1";
const endpoint = (process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || "").trim();
const forcePathStyle =
  process.env.S3_FORCE_PATH_STYLE === "1" || process.env.S3_FORCE_PATH_STYLE === "true";

let s3Client = null;

function getS3() {
  if (!s3Client) {
    const options = {
      region,
      ...(endpoint ? { endpoint } : {}),
      ...(forcePathStyle ? { forcePathStyle: true } : {}),
    };
    s3Client = new S3Client(options);
  }
  return s3Client;
}

/** True when uploads should go to S3 (Render / production) instead of local disk. */
export function objectStorageEnabled() {
  return Boolean(
    bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );
}

export function normalizeUploadKey(relPath) {
  return String(relPath || "")
    .replace(/\\/g, "/")
    .replace(/^\//, "")
    .replace(/^uploads\/?/i, "");
}

export function getLocalUploadRoot() {
  return localRoot;
}

export async function saveUploadBuffer(relPath, buffer, contentType = "application/octet-stream") {
  const key = normalizeUploadKey(relPath);
  if (objectStorageEnabled()) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return;
  }
  const dest = path.join(localRoot, key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
}

export function localFileExists(relPath) {
  const key = normalizeUploadKey(relPath);
  const dest = path.join(localRoot, key);
  return fs.existsSync(dest) && fs.statSync(dest).isFile();
}

export async function uploadExists(relPath) {
  const key = normalizeUploadKey(relPath);
  if (fs.existsSync(path.join(localRoot, key))) return true;
  if (!objectStorageEnabled()) return false;
  try {
    await getS3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
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
    const out = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return {
      stream: out.Body,
      contentType: out.ContentType || null,
      source: "s3",
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
    const out = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks = [];
    for await (const chunk of out.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

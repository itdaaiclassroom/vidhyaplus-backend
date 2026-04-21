/**
 * One-time (or repeat) sync: copy your local `uploads/` tree to S3 so production
 * matches paths already stored in MySQL (textbook/*, ppt/*, qrcodes/*, etc.).
 *
 * Requires: S3_BUCKET (or AWS_S3_BUCKET), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 * Run from repo root: npm run sync:uploads-s3
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, "..", "uploads");

const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || "us-east-1";

function mimeForFile(abs) {
  const lower = abs.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  return "application/octet-stream";
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

async function main() {
  if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("Missing S3 env: S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (and AWS_REGION)");
    process.exit(1);
  }
  if (!fs.existsSync(uploadsRoot)) {
    console.error("No folder at", uploadsRoot);
    process.exit(1);
  }

  const files = walkFiles(uploadsRoot);
  if (files.length === 0) {
    console.log("No files under uploads/ — nothing to sync.");
    return;
  }

  const client = new S3Client({ region });
  let n = 0;
  for (const abs of files) {
    const rel = path.relative(uploadsRoot, abs).replace(/\\/g, "/");
    const buf = fs.readFileSync(abs);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: rel,
        Body: buf,
        ContentType: mimeForFile(abs),
      })
    );
    n += 1;
    if (n % 100 === 0) console.log(`Uploaded ${n} files...`);
  }
  console.log(`Done: ${n} files → s3://${bucket}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

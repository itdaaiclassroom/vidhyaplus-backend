import fs from "fs";
import path from "path";
import getPool from "../backend/server/config/db.js";
import "dotenv/config";

const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 72 >>
stream
BT
/F1 24 Tf
70 700 Td
(Learning Resource Placeholder) Tj
0 -30 Td
(This is a dummy file for development testing.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000222 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
343
%%EOF`;

async function main() {
  const db = getPool();
  const uploadsRoot = path.join(process.cwd(), "uploads");

  console.log("Scanning database for uploads...");

  // 1. Scan topic_pdf_materials
  const [pdfs] = await db.query("SELECT id, pdf_url, title FROM topic_pdf_materials");
  for (const row of pdfs) {
    if (row.pdf_url) {
      createDummyFile(uploadsRoot, row.pdf_url, "PDF", row.title);
    }
  }

  // 2. Scan topic_ppt_materials
  const [ppts] = await db.query("SELECT id, ppt_url, title FROM topic_ppt_materials");
  for (const row of ppts) {
    if (row.ppt_url) {
      createDummyFile(uploadsRoot, row.ppt_url, "PPT", row.title);
    }
  }

  // 3. Scan subject_materials
  const [subMats] = await db.query("SELECT id, file_path, title FROM subject_materials");
  for (const row of subMats) {
    if (row.file_path) {
      createDummyFile(uploadsRoot, row.file_path, "PDF", row.title);
    }
  }

  // 4. Scan chapters (textbookChunkPdfPath)
  const [chaps] = await db.query("SELECT id, chapter_name AS name, textbook_chunk_pdf_path FROM chapters");
  for (const row of chaps) {
    if (row.textbook_chunk_pdf_path) {
      createDummyFile(uploadsRoot, row.textbook_chunk_pdf_path, "PDF", row.name);
    }
  }

  console.log("Scanning completed successfully.");
  process.exit(0);
}

function createDummyFile(root, relPath, type, title) {
  // Normalize the path
  const normalized = relPath.replace(/\\/g, "/").replace(/^uploads\//i, "");
  const fullPath = path.join(root, normalized);

  if (fs.existsSync(fullPath)) {
    console.log(`[Exists] ${normalized}`);
    return;
  }

  // Create directory
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  // Write file
  if (type === "PDF") {
    // Write minimal pdf
    fs.writeFileSync(fullPath, minimalPdf);
    console.log(`[Created PDF] ${normalized} (${title})`);
  } else {
    // Write empty or simple dummy bytes
    fs.writeFileSync(fullPath, "Dummy PPT file placeholder");
    console.log(`[Created PPT] ${normalized} (${title})`);
  }
}

main().catch(err => {
  console.error("Error creating dummy files:", err);
  process.exit(1);
});

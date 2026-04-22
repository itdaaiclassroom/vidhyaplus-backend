import "dotenv/config";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const {
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;

const sqlFiles = [
  "lms.sql",
  "curriculum_grade10_curriculum_load.sql",
  "live_quiz_feb2026_full_seed.sql",
  "admin_dashboard_production_upgrade.sql"
];

async function migrate() {
  console.log(`Starting migration to ${MYSQL_HOST}...`);

  for (const file of sqlFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${file}, skipping...`);
      continue;
    }

    console.log(`Importing ${file}...`);
    
    // Construct command. Using MYSQL_PWD to avoid password in command line
    const cmd = `mysql -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} ${MYSQL_DATABASE} < "${filePath}"`;
    
    try {
      // Note: On Windows, we need to set the environment variable differently if using cmd/powershell
      // But execAsync handles it if we pass env
      await execAsync(cmd, {
        env: { ...process.env, MYSQL_PWD: MYSQL_PASSWORD }
      });
      console.log(`Successfully imported ${file}`);
    } catch (err) {
      console.error(`Error importing ${file}:`, err.message);
      if (err.message.includes("ENOTFOUND") || err.message.includes("ETIMEDOUT")) {
        console.error("\n[CRITICAL] Could not connect to the database.");
        console.error("The host 'mysql.railway.internal' is only accessible within Railway.");
        console.error("Please use the Public Networking host (e.g., junction.proxy.rlwy.net) to run this from your local machine.");
        process.exit(1);
      }
    }
  }

  console.log("\nMigration completed!");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

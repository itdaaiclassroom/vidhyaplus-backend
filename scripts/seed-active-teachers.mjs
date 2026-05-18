import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const db = await mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "lms",
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    console.log("Retrieving active schools...");
    const [schools] = await db.query("SELECT id, school_name FROM schools");
    if (!schools.length) {
      console.error("No schools found in the database. Please register a school first.");
      process.exit(1);
    }
    console.log(`Found active schools: ${schools.map(s => `${s.school_name} (ID: ${s.id})`).join(", ")}`);

    console.log("Retrieving active subjects...");
    const [subjects] = await db.query("SELECT id, subject_name FROM subjects");
    const subjectMap = new Map(subjects.map(s => [s.subject_name.toLowerCase(), s.id]));
    console.log(`Found active subjects: ${subjects.map(s => s.subject_name).join(", ")}`);

    // Let's seed for both school 5 and school 7 (or whatever school IDs are active)
    const targetSchools = schools.map(s => s.id);

    const standardTeachers = [
      { name: "Ravi Kumar", email: "ravi.telugu@zphs.edu", password: "teach123", subject: "Telugu" },
      { name: "Anita Sharma", email: "anita.hindi@zphs.edu", password: "teach123", subject: "Hindi" },
      { name: "John Peter", email: "john.english@zphs.edu", password: "teach123", subject: "English" },
      { name: "Suresh Babu", email: "suresh.math@zphs.edu", password: "teach123", subject: "Mathematics" },
      { name: "Farhan Ali", email: "farhan.physics@zphs.edu", password: "teach123", subject: "Physics" },
      { name: "Priyanka Rao", email: "priyanka.biology@zphs.edu", password: "teach123", subject: "Biology" },
      { name: "Meena Joshi", email: "meena.social@zphs.edu", password: "teach123", subject: "Social Studies" },
      // Bulk template teachers
      { name: "Sunil Reddy", email: "sunil.reddy@example.com", password: "teacher123", subject: "Mathematics" },
      { name: "Kavitha Rani", email: "kavitha.rani@example.com", password: "teacher123", subject: "English" }
    ];

    console.log("\nSeeding teachers...");
    let seededCount = 0;
    
    // Seed standard teachers for the first school (e.g. ID 5 which has all student data)
    const primarySchoolId = targetSchools[0];
    console.log(`Primary school selected for seeding: ID ${primarySchoolId}`);

    for (const t of standardTeachers) {
      const subjectId = subjectMap.get(t.subject.toLowerCase());
      if (!subjectId) {
        console.warn(`Subject '${t.subject}' not found in database. Skipping teacher ${t.name}.`);
        continue;
      }

      // Check if teacher already exists by email
      const [existing] = await db.query("SELECT id FROM teachers WHERE email = ? LIMIT 1", [t.email]);
      if (existing.length > 0) {
        console.log(`Teacher with email '${t.email}' already exists. Skipping.`);
        continue;
      }

      await db.query(
        "INSERT INTO teachers (full_name, email, password, role, school_id, subject_id) VALUES (?, ?, ?, 'teacher', ?, ?)",
        [t.name, t.email, t.password, primarySchoolId, subjectId]
      );
      console.log(`Successfully seeded teacher: ${t.name} (${t.email}) for subject ${t.subject}`);
      seededCount++;
    }

    console.log(`\nSeed Complete! Successfully added ${seededCount} teachers to the database.`);
  } catch (err) {
    console.error("Seeding failed:", err.message);
  } finally {
    await db.end();
  }
}

main().catch(console.error);

import fs from 'fs';
import path from 'path';
import getPool from '../backend/server/config/db.js';
import { generateStudentQRIds } from '../backend/server/controllers/student.controller.js';

// Simple CSV parser that handles quotes
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    results.push(obj);
  }
  return results;
}

async function seedData() {
  const db = getPool();
  console.log("Starting bulk registration seeder...");

  // Seed Students
  const studentFile = path.resolve('Advanced_Ashrama_Bulk_Data.csv');
  if (fs.existsSync(studentFile)) {
    console.log("Processing students...");
    const content = fs.readFileSync(studentFile, 'utf-8');
    const students = parseCSV(content);
    
    for (const s of students) {
      if (!s['First Name'] || !s['Grade'] || !s['Section']) continue;
      
      const firstName = s['First Name'];
      const lastName = s['Last Name'];
      const sectionCode = s['Section'];
      const grade = Number(s['Grade']);
      const password = s['Password'] || 'pass123';
      const category = s['Category'] || 'A';
      const schoolId = 1; // Default school ID
      
      const gender = s['Gender'];
      const dob = s['Date of Birth'];
      const fatherName = s['Father Name'];
      const motherName = s['Mother Name'];
      const phoneNumber = s['Phone'];
      const aadhaar = s['Aadhaar'];
      const address = s['Address'];
      const village = s['Village'];
      const mandal = s['Mandal'];
      const district = s['District'];
      const state = s['State'] || 'Telangana';
      const pincode = s['Pincode'];
      const hostelStatus = s['Hostel Status'];
      const disabilities = s['Disabilities'];
      
      try {
        // Resolve section
        let sectionId;
        const [secRows] = await db.query(
          "SELECT id FROM sections WHERE school_id = ? AND grade_id = ? AND section_code = ? LIMIT 1",
          [schoolId, grade, sectionCode]
        );
        
        if (secRows && secRows.length > 0) {
          sectionId = secRows[0].id;
        } else {
          const [insSec] = await db.query(
            "INSERT INTO sections (school_id, grade_id, section_code) VALUES (?, ?, ?)",
            [schoolId, grade, sectionCode]
          );
          sectionId = insSec.insertId;
        }

        const isHosteller = (hostelStatus === 'Yes' || hostelStatus === 'yes') ? 1 : 0;

        const [ins] = await db.query(
          `INSERT INTO students (
            school_id, section_id, first_name, last_name, password, joined_at, category,
            gender, dob, father_name, mother_name, phone_number, aadhaar, address, village, mandal, district, state, pincode, is_hosteller, disabilities
          ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            schoolId, sectionId, firstName, lastName, password, category,
            gender, dob, fatherName, motherName, phoneNumber, aadhaar, address, village, mandal, district, state, pincode, isHosteller, disabilities
          ]
        );
        
        await generateStudentQRIds(db, ins.insertId);
        console.log(`Registered Student: ${firstName} ${lastName}`);
      } catch (err) {
        console.error(`Failed to register student ${firstName} ${lastName}:`, err.message);
      }
    }
  }

  // Seed Teachers
  const teacherFile = path.resolve('uploads/Teacher_Bulk_Registration_Template.csv');
  if (fs.existsSync(teacherFile)) {
    console.log("\nProcessing teachers...");
    const content = fs.readFileSync(teacherFile, 'utf-8');
    const teachers = parseCSV(content);
    
    for (const t of teachers) {
      if (!t['Full Name'] || !t['Email']) continue;
      
      const fullName = t['Full Name'];
      const email = t['Email'];
      const password = t['Password'] || 'teacher123';
      const schoolId = 1; // Default school ID
      
      try {
        await db.query(
          "INSERT INTO teachers (full_name, email, school_id, password) VALUES (?, ?, ?, ?)",
          [fullName, email, schoolId, password]
        );
        console.log(`Registered Teacher: ${fullName} (${email})`);
      } catch (err) {
        console.error(`Failed to register teacher ${fullName}:`, err.message);
      }
    }
  }

  console.log("\nSeeding complete.");
  process.exit(0);
}

seedData().catch(console.error);

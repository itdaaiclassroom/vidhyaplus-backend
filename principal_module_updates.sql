-- Principal Module Updates
USE railway;

-- Supporting multiple subjects per teacher
CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (teacher_id, subject_id),
  CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ts_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Add category/option to students for QR generation
ALTER TABLE students ADD COLUMN category VARCHAR(50) NULL AFTER roll_no;

-- Seed Principal for ZPHS Adilabad (School ID 1)
-- Check if already exists to avoid duplicates during multiple runs
INSERT INTO teachers (full_name, email, password, role, school_id)
SELECT 'Dr. Maheshwar Rao', 'principal.zphs@zphs.edu', 'princ123', 'principal', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE email = 'principal.zphs@zphs.edu');

-- Migrate existing teacher-subject associations if any
INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id)
SELECT id, subject_id FROM teachers WHERE subject_id IS NOT NULL;

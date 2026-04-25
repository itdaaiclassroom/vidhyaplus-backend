-- Admin Dashboard Extension Migration
USE railway;

-- 1) Extend Students table with detailed profile fields
ALTER TABLE students 
ADD COLUMN village VARCHAR(100) NULL,
ADD COLUMN mandal VARCHAR(100) NULL,
ADD COLUMN district VARCHAR(100) NULL,
ADD COLUMN state VARCHAR(100) NULL DEFAULT 'Andhra Pradesh',
ADD COLUMN pincode VARCHAR(10) NULL,
ADD COLUMN address TEXT NULL,
ADD COLUMN is_hosteller TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN phone_number VARCHAR(20) NULL;

-- 2) Announcements table (Admin to Teacher)
CREATE TABLE IF NOT EXISTS announcements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sender_admin_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  target_role ENUM('teacher', 'student', 'all') NOT NULL DEFAULT 'teacher',
  target_school_id INT UNSIGNED NULL, -- NULL means all schools
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_announcements_admin FOREIGN KEY (sender_admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  CONSTRAINT fk_announcements_school FOREIGN KEY (target_school_id) REFERENCES schools(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3) Teacher Activity Logs
CREATE TABLE IF NOT EXISTS teacher_activity_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  action VARCHAR(255) NOT NULL, -- e.g., 'login', 'start_session', 'submit_attendance'
  details TEXT NULL, -- JSON or string details
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_teacher_logs_teacher (teacher_id),
  INDEX idx_teacher_logs_created (created_at),
  CONSTRAINT fk_teacher_logs_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4) Add village/mandal to schools if not present (supplementing production_upgrade.sql)
-- (Already handled by admin_dashboard_production_upgrade.sql, but adding village just in case)
SET @q := IF(
  EXISTS(
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schools' AND COLUMN_NAME = 'village'
  ),
  'SELECT 1',
  'ALTER TABLE schools ADD COLUMN village VARCHAR(120) NULL AFTER mandal'
);
PREPARE st FROM @q; EXECUTE st; DEALLOCATE PREPARE st;

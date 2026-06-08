-- Update existing material tables with is_mandatory flag
ALTER TABLE topic_ppt_materials
ADD COLUMN is_mandatory TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE topic_youtube_links
ADD COLUMN is_mandatory TINYINT(1) NOT NULL DEFAULT 0;

-- Create new topic_activity_materials table
CREATE TABLE IF NOT EXISTS topic_activity_materials (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NULL,
  description TEXT NULL,
  is_mandatory TINYINT(1) NOT NULL DEFAULT 0,
  created_by_teacher_id INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tam_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_tam_teacher FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Create new topic_pdf_materials table
CREATE TABLE IF NOT EXISTS topic_pdf_materials (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  topic_id INT UNSIGNED NOT NULL,
  pdf_url VARCHAR(1024) NOT NULL,
  title VARCHAR(255) NULL,
  is_mandatory TINYINT(1) NOT NULL DEFAULT 0,
  created_by_teacher_id INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tpdf_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_tpdf_teacher FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

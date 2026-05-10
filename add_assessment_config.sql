-- =====================================================
-- Assessment Configuration Migration
-- Adds admin-controlled assessment settings to gating_config
-- =====================================================

INSERT IGNORE INTO gating_config (config_key, config_value, description) VALUES
  ('assessment_question_count', '10', 'Number of questions for each chapter assessment'),
  ('assessment_total_marks', '100', 'Total marks for the teacher chapter assessment'),
  ('assessment_passing_marks', '70', 'Passing marks required to clear the chapter assessment');

ALTER TABLE unit_progress
ADD CONSTRAINT fk_unit_progress_unit
FOREIGN KEY (unit_id) REFERENCES course_units(id)
ON DELETE CASCADE;

ALTER TABLE course_units RENAME COLUMN unit_id TO unit_number;
ALTER TABLE course_lessons RENAME COLUMN lesson_id TO lesson_number;

---need to check this 

SELECT lesson_id 
FROM exercise_attempts 
WHERE lesson_id NOT IN (SELECT id FROM course_lessons);

SELECT unit_id 
FROM exercise_attempts 
WHERE unit_id NOT IN (SELECT id FROM course_units);

--- if above gives null then add below or else first remove the records from the db 
----if 0 rows then directly run

ALTER TABLE exercise_attempts
ADD CONSTRAINT fk_exercise_attempts_lesson
FOREIGN KEY (lesson_id)
REFERENCES course_lessons(id)
ON DELETE CASCADE;

ALTER TABLE exercise_attempts
ADD CONSTRAINT fk_exercise_attempts_unit
FOREIGN KEY (unit_id)
REFERENCES course_units(id)
ON DELETE CASCADE;

--make progress percentage between 0 to 100 in following tables
ALTER TABLE courses
ADD CONSTRAINT chk_courses_progress_percentage
CHECK (progress_percentage BETWEEN 0 AND 100);

ALTER TABLE course_units
ADD CONSTRAINT chk_course_units_progress_percentage
CHECK (progress_percentage BETWEEN 0 AND 100);

ALTER TABLE course_lessons
ADD CONSTRAINT chk_course_lessons_progress_percentage
CHECK (progress_percentage BETWEEN 0 AND 100);

ALTER TABLE unit_progress
ADD CONSTRAINT chk_unit_progress_progress_percentage
CHECK (progress_percentage BETWEEN 0 AND 100);

ALTER TABLE lesson_progress
ADD CONSTRAINT chk_lesson_progress_progress_percentage
CHECK (progress_percentage BETWEEN 0 AND 100);

--preventing duplicates
ALTER TABLE learners ALTER COLUMN email TYPE citext;
ALTER TABLE admins ALTER COLUMN email TYPE citext;

---used to imporve performance we are not removing any fields
CREATE OR REPLACE FUNCTION update_course_denormalized_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_units and estimated_total_time from course_units
    UPDATE courses
    SET total_units = (SELECT COUNT(*) FROM course_units WHERE course_id = NEW.course_id),
        estimated_total_time = (SELECT COALESCE(SUM(estimated_time),0) FROM course_units WHERE course_id = NEW.course_id)
    WHERE id = NEW.course_id;

    -- Update total_lessons from course_lessons
    UPDATE courses
    SET total_lessons = (SELECT COUNT(*) FROM course_lessons WHERE course_id = NEW.course_id)
    WHERE id = NEW.course_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


---- Trigger after INSERT, UPDATE, DELETE
CREATE TRIGGER trg_course_units_denormalized
AFTER INSERT OR UPDATE OR DELETE ON course_units
FOR EACH ROW
EXECUTE FUNCTION update_course_denormalized_fields();

-- Trigger after INSERT, UPDATE, DELETE
CREATE TRIGGER trg_course_lessons_denormalized
AFTER INSERT OR UPDATE OR DELETE ON course_lessons
FOR EACH ROW
EXECUTE FUNCTION update_course_denormalized_fields();


--created partial index for faster optimization
-- Lesson progress: only incomplete lessons
CREATE INDEX idx_lesson_progress_incomplete
ON lesson_progress(learner_id, course_id)
WHERE is_completed = false;

-- Unit progress: only incomplete units
CREATE INDEX idx_unit_progress_incomplete
ON unit_progress(learner_id, course_id)
WHERE is_completed = false;



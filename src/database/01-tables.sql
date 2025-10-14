-- PostgreSQL Database Schema for Fluentify
-- This file contains all necessary tables, indexes, functions, and triggers
-- Compatible with PostgreSQL 16+

-- Users and Authentication
CREATE TABLE IF NOT EXISTS learners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Preferences
CREATE TABLE IF NOT EXISTS learner_preferences (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  expected_duration VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Course Management
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    expected_duration VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_lessons INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    estimated_total_time INTEGER DEFAULT 0,
    course_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_completed BOOLEAN DEFAULT false,
    progress_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_units (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    unit_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty VARCHAR(50) NOT NULL,
    estimated_time INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    progress_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES course_units(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    lesson_type VARCHAR(50) NOT NULL,
    description TEXT,
    key_phrases TEXT[],
    vocabulary JSONB,
    grammar_points JSONB,
    exercises JSONB,
    estimated_duration INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    progress_percentage INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Progress Tracking
CREATE TABLE IF NOT EXISTS unit_progress (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    unit_id INTEGER NOT NULL,
    is_unlocked BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (learner_id, course_id, unit_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    unit_id INTEGER,
    lesson_id INTEGER REFERENCES course_lessons(id) ON DELETE CASCADE,
    lesson_number INTEGER,
    is_completed BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    exercises_completed INTEGER DEFAULT 0,
    total_exercises INTEGER DEFAULT 0,
    vocabulary_mastered INTEGER DEFAULT 0,
    total_vocabulary INTEGER DEFAULT 0,
    last_accessed TIMESTAMP,
    completion_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(learner_id, lesson_id)
);

-- User Statistics
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    units_completed INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (learner_id, course_id)
);

-- Exercise Attempts
CREATE TABLE IF NOT EXISTS exercise_attempts (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    unit_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    exercise_index INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    user_answer TEXT,
    attempted_at TIMESTAMP DEFAULT NOW()
);

-- Achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT '🏆',
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_courses_learner_id ON courses(learner_id);
CREATE INDEX IF NOT EXISTS idx_courses_language ON courses(language);
CREATE INDEX IF NOT EXISTS idx_course_units_course_id ON course_units(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id ON course_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_unit_id ON course_lessons(unit_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_learner_id ON lesson_progress(learner_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course ON lesson_progress(learner_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_completed ON lesson_progress(learner_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_unit_progress_learner_course ON unit_progress(learner_id, course_id);
CREATE INDEX IF NOT EXISTS idx_exercise_attempts_lesson ON exercise_attempts(learner_id, course_id, unit_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_learner ON user_stats(learner_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_learner_id ON user_achievements(learner_id);

-- Functions and Triggers

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update course progress
CREATE OR REPLACE FUNCTION update_course_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update unit progress when a lesson is completed
    IF TG_OP = 'UPDATE' AND NEW.is_completed = true AND OLD.is_completed = false THEN
        -- Update unit progress
        UPDATE course_units cu
        SET progress_percentage = (
            SELECT ROUND((COUNT(*) FILTER (WHERE cl.is_completed = true) * 100.0) / NULLIF(COUNT(*), 0))
            FROM course_lessons cl
            WHERE cl.unit_id = cu.id
        ),
        is_completed = (
            SELECT COUNT(*) = COUNT(*) FILTER (WHERE cl.is_completed = true)
            FROM course_lessons cl
            WHERE cl.unit_id = cu.id
        )
        WHERE cu.id = NEW.unit_id;

        -- Update course progress
        UPDATE courses c
        SET progress_percentage = (
            SELECT ROUND((COUNT(*) FILTER (WHERE cl.is_completed = true) * 100.0) / NULLIF(COUNT(*), 0))
            FROM course_lessons cl
            WHERE cl.course_id = c.id
        ),
        is_completed = (
            SELECT COUNT(*) = COUNT(*) FILTER (WHERE cl.is_completed = true)
            FROM course_lessons cl
            WHERE cl.course_id = c.id
        )
        WHERE c.id = NEW.course_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_units_updated_at BEFORE UPDATE ON course_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_lessons_updated_at BEFORE UPDATE ON course_lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at BEFORE UPDATE ON lesson_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unit_progress_updated_at BEFORE UPDATE ON unit_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_course_progress
AFTER UPDATE ON course_lessons
FOR EACH ROW
EXECUTE FUNCTION update_course_progress();


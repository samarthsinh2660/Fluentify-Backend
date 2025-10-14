ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_data JSONB;


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

CREATE INDEX IF NOT EXISTS idx_unit_progress_learner_course ON unit_progress(learner_id, course_id);


ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS unit_id INTEGER;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS lesson_number INTEGER;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS completed_time TIMESTAMP;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course ON lesson_progress(learner_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_completed ON lesson_progress(learner_id, is_completed);

-- Table to store exercise attempts
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

CREATE INDEX IF NOT EXISTS idx_exercise_attempts_lesson ON exercise_attempts(learner_id, course_id, unit_id, lesson_id);

-- Table to store user's total XP and stats
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

CREATE INDEX IF NOT EXISTS idx_user_stats_learner ON user_stats(learner_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_unit_progress_updated_at BEFORE UPDATE ON unit_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


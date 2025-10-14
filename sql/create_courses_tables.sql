-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    expected_duration VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_lessons INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    estimated_total_time INTEGER DEFAULT 0, -- in minutes
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
    unit_id INTEGER NOT NULL, -- The unit number within the course
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty VARCHAR(50) NOT NULL,
    estimated_time INTEGER DEFAULT 0, -- in minutes
    is_completed BOOLEAN DEFAULT false,
    progress_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create course_lessons table
CREATE TABLE IF NOT EXISTS course_lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    unit_id INTEGER REFERENCES course_units(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL, -- The lesson number within the unit
    title VARCHAR(255) NOT NULL,
    lesson_type VARCHAR(50) NOT NULL, -- vocabulary, grammar, conversation, review
    description TEXT,
    key_phrases TEXT[], -- Array of key phrases
    vocabulary JSONB, -- JSON array of vocabulary items
    grammar_points JSONB, -- JSON array of grammar points
    exercises JSONB, -- JSON array of exercises
    estimated_duration INTEGER DEFAULT 0, -- in minutes
    xp_reward INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    progress_percentage INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0, -- in minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create lesson_progress table to track detailed progress
CREATE TABLE IF NOT EXISTS lesson_progress (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES course_lessons(id) ON DELETE CASCADE,
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

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL, -- first_lesson, unit_complete, course_complete, streak_7, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT '🏆',
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_courses_learner_id ON courses(learner_id);
CREATE INDEX idx_courses_language ON courses(language);
CREATE INDEX idx_course_units_course_id ON course_units(course_id);
CREATE INDEX idx_course_lessons_course_id ON course_lessons(course_id);
CREATE INDEX idx_course_lessons_unit_id ON course_lessons(unit_id);
CREATE INDEX idx_lesson_progress_learner_id ON lesson_progress(learner_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX idx_user_achievements_learner_id ON user_achievements(learner_id);

-- Create function to update course progress
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

-- Create trigger for updating course progress
CREATE TRIGGER trigger_update_course_progress
AFTER UPDATE ON course_lessons
FOR EACH ROW
EXECUTE FUNCTION update_course_progress();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_units_updated_at BEFORE UPDATE ON course_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_lessons_updated_at BEFORE UPDATE ON course_lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at BEFORE UPDATE ON lesson_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

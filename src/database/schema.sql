-- ============================================================
-- Fluentify — Full Database Schema
-- Single source of truth. Run this on a fresh database.
-- Combines: 01-tables.sql, 02-tables.sql, 03-tables.sql
-- and incorporates all constraints from migration.sql.
-- ============================================================

-- Required extension for case-insensitive email uniqueness
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS learners (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         CITEXT       UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         CITEXT       UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learner_preferences (
    id                SERIAL PRIMARY KEY,
    learner_id        INTEGER      NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    language          VARCHAR(50)  NOT NULL,
    expected_duration VARCHAR(50)  NOT NULL,
    created_at        TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- COURSE MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
    id                   SERIAL PRIMARY KEY,
    learner_id           INTEGER      NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    language             VARCHAR(50)  NOT NULL,
    expected_duration    VARCHAR(100) NOT NULL,
    title                VARCHAR(255) NOT NULL,
    description          TEXT,
    total_lessons        INTEGER      DEFAULT 0,
    total_units          INTEGER      DEFAULT 0,
    estimated_total_time INTEGER      DEFAULT 0,
    course_data          JSONB        NOT NULL,
    is_active            BOOLEAN      DEFAULT TRUE,
    is_completed         BOOLEAN      DEFAULT FALSE,
    progress_percentage  INTEGER      DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_units (
    id                  SERIAL PRIMARY KEY,
    course_id           INTEGER      NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    unit_id             INTEGER      NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    difficulty          VARCHAR(50)  NOT NULL,
    estimated_time      INTEGER      DEFAULT 0,
    is_completed        BOOLEAN      DEFAULT FALSE,
    progress_percentage INTEGER      DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_lessons (
    id                       SERIAL PRIMARY KEY,
    course_id                INTEGER      NOT NULL REFERENCES courses(id)      ON DELETE CASCADE,
    unit_id                  INTEGER      NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    lesson_id                INTEGER      NOT NULL,
    title                    VARCHAR(255) NOT NULL,
    lesson_type              VARCHAR(50)  NOT NULL,
    description              TEXT,
    key_phrases              TEXT[],
    vocabulary               JSONB,
    grammar_points           JSONB,
    exercises                JSONB,
    estimated_duration       INTEGER      DEFAULT 0,
    xp_reward                INTEGER      DEFAULT 0,
    is_completed             BOOLEAN      DEFAULT FALSE,
    progress_percentage      INTEGER      DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    time_spent               INTEGER      DEFAULT 0,
    is_remedial              BOOLEAN      DEFAULT FALSE,
    remedial_for_concept_id  INTEGER,
    created_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PROGRESS TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS unit_progress (
    id           SERIAL PRIMARY KEY,
    learner_id   INTEGER   NOT NULL REFERENCES learners(id)     ON DELETE CASCADE,
    course_id    INTEGER   NOT NULL REFERENCES courses(id)      ON DELETE CASCADE,
    unit_id      INTEGER   NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    is_unlocked  BOOLEAN   DEFAULT FALSE,
    is_completed BOOLEAN   DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (learner_id, course_id, unit_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    id                  SERIAL PRIMARY KEY,
    learner_id          INTEGER   NOT NULL REFERENCES learners(id)      ON DELETE CASCADE,
    course_id           INTEGER   NOT NULL REFERENCES courses(id)       ON DELETE CASCADE,
    unit_id             INTEGER,
    lesson_id           INTEGER   NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    lesson_number       INTEGER,
    is_completed        BOOLEAN   DEFAULT FALSE,
    score               INTEGER   DEFAULT 0,
    xp_earned           INTEGER   DEFAULT 0,
    exercises_completed INTEGER   DEFAULT 0,
    total_exercises     INTEGER   DEFAULT 0,
    vocabulary_mastered INTEGER   DEFAULT 0,
    total_vocabulary    INTEGER   DEFAULT 0,
    last_accessed       TIMESTAMP,
    completion_time     TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (learner_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS user_stats (
    id                 SERIAL PRIMARY KEY,
    learner_id         INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    course_id          INTEGER NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
    total_xp           INTEGER DEFAULT 0,
    lessons_completed  INTEGER DEFAULT 0,
    units_completed    INTEGER DEFAULT 0,
    current_streak     INTEGER DEFAULT 0,
    longest_streak     INTEGER DEFAULT 0,
    last_activity_date DATE,
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW(),
    UNIQUE (learner_id, course_id)
);

CREATE TABLE IF NOT EXISTS exercise_attempts (
    id             SERIAL PRIMARY KEY,
    learner_id     INTEGER   NOT NULL REFERENCES learners(id)      ON DELETE CASCADE,
    course_id      INTEGER   NOT NULL REFERENCES courses(id)       ON DELETE CASCADE,
    unit_id        INTEGER   NOT NULL REFERENCES course_units(id)  ON DELETE CASCADE,
    lesson_id      INTEGER   NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    exercise_index INTEGER   NOT NULL,
    is_correct     BOOLEAN   NOT NULL,
    user_answer    TEXT,
    attempted_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id               SERIAL PRIMARY KEY,
    learner_id       INTEGER      NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50)  NOT NULL,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    icon             VARCHAR(50)  DEFAULT '🏆',
    earned_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- LANGUAGE MODULES (Admin-created shared courses)
-- ============================================================

CREATE TABLE IF NOT EXISTS language_modules (
    id                 SERIAL PRIMARY KEY,
    admin_id           INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
    language           VARCHAR(100) NOT NULL,
    level              VARCHAR(50),
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    thumbnail_url      TEXT,
    estimated_duration VARCHAR(100),
    total_units        INTEGER      DEFAULT 0,
    total_lessons      INTEGER      DEFAULT 0,
    is_published       BOOLEAN      DEFAULT FALSE,
    created_at         TIMESTAMP    DEFAULT NOW(),
    updated_at         TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_units (
    id             SERIAL PRIMARY KEY,
    module_id      INTEGER      NOT NULL REFERENCES language_modules(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    difficulty     VARCHAR(50),
    estimated_time INTEGER      DEFAULT 0,
    created_at     TIMESTAMP    DEFAULT NOW(),
    updated_at     TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_lessons (
    id            SERIAL PRIMARY KEY,
    unit_id       INTEGER      NOT NULL REFERENCES module_units(id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    content_type  VARCHAR(50)  NOT NULL,
    description   TEXT,
    media_url     TEXT,
    key_phrases   TEXT[],
    vocabulary    JSONB,
    grammar_points JSONB,
    exercises     JSONB,
    xp_reward     INTEGER      DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learner_enrollments (
    id                  SERIAL PRIMARY KEY,
    learner_id          INTEGER   NOT NULL REFERENCES learners(id)        ON DELETE CASCADE,
    module_id           INTEGER   NOT NULL REFERENCES language_modules(id) ON DELETE CASCADE,
    enrolled_at         TIMESTAMP DEFAULT NOW(),
    progress_percentage INTEGER   DEFAULT 0,
    is_completed        BOOLEAN   DEFAULT FALSE,
    UNIQUE (learner_id, module_id)
);

-- ============================================================
-- AI CHATBOT
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id            SERIAL PRIMARY KEY,
    learner_id    INTEGER      NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    language      VARCHAR(50),
    session_title VARCHAR(255) DEFAULT 'New Chat',
    session_token VARCHAR(100) UNIQUE NOT NULL,
    started_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    ended_at      TIMESTAMP,
    is_active     BOOLEAN      DEFAULT TRUE,
    message_count INTEGER      DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id         SERIAL PRIMARY KEY,
    session_id INTEGER  NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    sender     VARCHAR(20) CHECK (sender IN ('learner', 'ai')),
    message    TEXT     NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- GAMIFICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS leaderboards (
    id         SERIAL PRIMARY KEY,
    learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    total_xp   INTEGER DEFAULT 0,
    week_start DATE    NOT NULL,
    week_end   DATE    NOT NULL,
    rank       INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (learner_id, week_start)
);

CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    learner_id INTEGER      NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    title      VARCHAR(255),
    message    TEXT         NOT NULL,
    type       VARCHAR(50)  DEFAULT 'reminder',
    is_read    BOOLEAN      DEFAULT FALSE,
    created_at TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- CONTEST SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS contests (
    id               SERIAL PRIMARY KEY,
    admin_id         INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    language         VARCHAR(100) NOT NULL,
    difficulty_level VARCHAR(50)  NOT NULL,
    contest_type     VARCHAR(20)  NOT NULL CHECK (contest_type IN ('mcq', 'one-liner', 'mix')),
    questions        JSONB        NOT NULL,
    total_questions  INTEGER      NOT NULL,
    max_attempts     INTEGER      DEFAULT 1,
    time_limit       INTEGER,
    reward_points    INTEGER      DEFAULT 0,
    start_date       TIMESTAMP    NOT NULL,
    end_date         TIMESTAMP    NOT NULL,
    is_published     BOOLEAN      DEFAULT FALSE,
    is_ai_generated  BOOLEAN      DEFAULT FALSE,
    created_at       TIMESTAMP    DEFAULT NOW(),
    updated_at       TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_submissions (
    id               SERIAL PRIMARY KEY,
    contest_id       INTEGER      NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    learner_id       INTEGER      NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    answers          JSONB        NOT NULL,
    score            INTEGER      DEFAULT 0,
    total_correct    INTEGER      DEFAULT 0,
    total_questions  INTEGER      NOT NULL,
    percentage       DECIMAL(5,2) DEFAULT 0,
    time_taken       INTEGER,
    submitted_at     TIMESTAMP    DEFAULT NOW(),
    UNIQUE (contest_id, learner_id)
);

CREATE TABLE IF NOT EXISTS contest_leaderboard (
    id           SERIAL PRIMARY KEY,
    contest_id   INTEGER      NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    learner_id   INTEGER      NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    score        INTEGER      DEFAULT 0,
    percentage   DECIMAL(5,2) DEFAULT 0,
    time_taken   INTEGER,
    rank         INTEGER,
    submitted_at TIMESTAMP,
    UNIQUE (contest_id, learner_id)
);

-- ============================================================
-- KNOWLEDGE GRAPH + A* RECOMMENDATION ENGINE
-- ============================================================

-- Concept nodes extracted from course lessons by Gemini.
-- Each row represents one learnable concept (e.g. "Present Tense", "Greetings").
CREATE TABLE IF NOT EXISTS concept_nodes (
    id                     SERIAL PRIMARY KEY,
    course_id              INTEGER      NOT NULL REFERENCES courses(id)       ON DELETE CASCADE,
    lesson_db_id           INTEGER      NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    concept_key            VARCHAR(100) NOT NULL,
    concept_label          VARCHAR(255) NOT NULL,
    concept_type           VARCHAR(50)  NOT NULL,
    difficulty             FLOAT        NOT NULL DEFAULT 0.5,
    estimated_mastery_time INTEGER      NOT NULL DEFAULT 15,
    created_at             TIMESTAMP    DEFAULT NOW(),
    UNIQUE (course_id, concept_key)
);

-- Directed prerequisite edges between concept nodes.
-- from_concept_id must be understood before to_concept_id.
CREATE TABLE IF NOT EXISTS concept_edges (
    id              SERIAL PRIMARY KEY,
    course_id       INTEGER NOT NULL REFERENCES courses(id)       ON DELETE CASCADE,
    from_concept_id INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    to_concept_id   INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    edge_weight     FLOAT   NOT NULL DEFAULT 1.0,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (from_concept_id, to_concept_id)
);

-- Live mastery score per learner per concept node.
-- Recomputed after every lesson completion.
CREATE TABLE IF NOT EXISTS concept_mastery (
    id            SERIAL PRIMARY KEY,
    learner_id    INTEGER NOT NULL REFERENCES learners(id)      ON DELETE CASCADE,
    course_id     INTEGER NOT NULL REFERENCES courses(id)       ON DELETE CASCADE,
    concept_id    INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    mastery_score FLOAT   NOT NULL DEFAULT 0.0,
    attempts      INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    last_updated  TIMESTAMP DEFAULT NOW(),
    UNIQUE (learner_id, concept_id)
);

-- Full A* run results stored for analytics and follow-through tracking.
CREATE TABLE IF NOT EXISTS recommendation_history (
    id                       SERIAL PRIMARY KEY,
    learner_id               INTEGER     NOT NULL REFERENCES learners(id)  ON DELETE CASCADE,
    course_id                INTEGER     NOT NULL REFERENCES courses(id)   ON DELETE CASCADE,
    recommended_concept_id   INTEGER     REFERENCES concept_nodes(id)      ON DELETE SET NULL,
    recommended_lesson_db_id INTEGER     REFERENCES course_lessons(id)     ON DELETE SET NULL,
    f_score                  FLOAT,
    g_score                  FLOAT,
    h_score                  FLOAT,
    reason                   TEXT,
    urgency                  VARCHAR(20) DEFAULT 'normal',
    full_path_data           JSONB,
    mastery_snapshot         JSONB,
    was_followed             BOOLEAN     DEFAULT FALSE,
    created_at               TIMESTAMP   DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Courses
CREATE INDEX IF NOT EXISTS idx_courses_learner_id    ON courses(learner_id);
CREATE INDEX IF NOT EXISTS idx_courses_language      ON courses(language);

-- Course structure
CREATE INDEX IF NOT EXISTS idx_course_units_course_id   ON course_units(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id ON course_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_unit_id   ON course_lessons(unit_id);

-- Progress
CREATE INDEX IF NOT EXISTS idx_lesson_progress_learner_id  ON lesson_progress(learner_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course      ON lesson_progress(learner_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_completed   ON lesson_progress(learner_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_unit_progress_learner_course ON unit_progress(learner_id, course_id);
CREATE INDEX IF NOT EXISTS idx_exercise_attempts_lesson    ON exercise_attempts(learner_id, course_id, unit_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_learner          ON user_stats(learner_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_learner_id ON user_achievements(learner_id);

-- Partial indexes for faster incomplete-record lookups
CREATE INDEX IF NOT EXISTS idx_lesson_progress_incomplete
    ON lesson_progress(learner_id, course_id) WHERE is_completed = FALSE;

CREATE INDEX IF NOT EXISTS idx_unit_progress_incomplete
    ON unit_progress(learner_id, course_id) WHERE is_completed = FALSE;

-- Chat
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_learner ON ai_chat_sessions(learner_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_active  ON ai_chat_sessions(learner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id);

-- Contests
CREATE INDEX IF NOT EXISTS idx_contests_admin               ON contests(admin_id);
CREATE INDEX IF NOT EXISTS idx_contests_language            ON contests(language);
CREATE INDEX IF NOT EXISTS idx_contests_published           ON contests(is_published);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest  ON contest_submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_learner  ON contest_submissions(learner_id);
CREATE INDEX IF NOT EXISTS idx_contest_leaderboard_contest  ON contest_leaderboard(contest_id, rank);

-- Knowledge Graph
CREATE INDEX IF NOT EXISTS idx_concept_nodes_course_id    ON concept_nodes(course_id);
CREATE INDEX IF NOT EXISTS idx_concept_nodes_lesson_db_id ON concept_nodes(lesson_db_id);
CREATE INDEX IF NOT EXISTS idx_concept_edges_course_id    ON concept_edges(course_id);
CREATE INDEX IF NOT EXISTS idx_concept_edges_from         ON concept_edges(from_concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_edges_to           ON concept_edges(to_concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_mastery_learner_course ON concept_mastery(learner_id, course_id);
CREATE INDEX IF NOT EXISTS idx_concept_mastery_concept_id     ON concept_mastery(concept_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_learner_course
    ON recommendation_history(learner_id, course_id, created_at DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_course_progress()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
        UPDATE course_units cu
        SET progress_percentage = (
            SELECT ROUND((COUNT(*) FILTER (WHERE cl.is_completed = TRUE) * 100.0) / NULLIF(COUNT(*), 0))
            FROM course_lessons cl WHERE cl.unit_id = cu.id
        ),
        is_completed = (
            SELECT COUNT(*) = COUNT(*) FILTER (WHERE cl.is_completed = TRUE)
            FROM course_lessons cl WHERE cl.unit_id = cu.id
        )
        WHERE cu.id = NEW.unit_id;

        UPDATE courses c
        SET progress_percentage = (
            SELECT ROUND((COUNT(*) FILTER (WHERE cl.is_completed = TRUE) * 100.0) / NULLIF(COUNT(*), 0))
            FROM course_lessons cl WHERE cl.course_id = c.id
        ),
        is_completed = (
            SELECT COUNT(*) = COUNT(*) FILTER (WHERE cl.is_completed = TRUE)
            FROM course_lessons cl WHERE cl.course_id = c.id
        )
        WHERE c.id = NEW.course_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_course_denormalized_fields()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE courses
    SET total_units          = (SELECT COUNT(*)              FROM course_units   WHERE course_id = NEW.course_id),
        estimated_total_time = (SELECT COALESCE(SUM(estimated_time), 0) FROM course_units WHERE course_id = NEW.course_id),
        total_lessons        = (SELECT COUNT(*)              FROM course_lessons WHERE course_id = NEW.course_id)
    WHERE id = NEW.course_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_contest_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO contest_leaderboard (contest_id, learner_id, score, percentage, time_taken, submitted_at)
    VALUES (NEW.contest_id, NEW.learner_id, NEW.score, NEW.percentage, NEW.time_taken, NEW.submitted_at)
    ON CONFLICT (contest_id, learner_id) DO UPDATE SET
        score        = NEW.score,
        percentage   = NEW.percentage,
        time_taken   = NEW.time_taken,
        submitted_at = NEW.submitted_at;

    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC, time_taken ASC NULLS LAST) AS new_rank
        FROM contest_leaderboard WHERE contest_id = NEW.contest_id
    )
    UPDATE contest_leaderboard cl
    SET rank = rs.new_rank
    FROM ranked rs
    WHERE cl.id = rs.id AND cl.contest_id = NEW.contest_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_ai_sessions(p_learner_id INT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM ai_chat_messages WHERE session_id IN (
        SELECT id FROM ai_chat_sessions WHERE learner_id = p_learner_id
    );
    DELETE FROM ai_chat_sessions WHERE learner_id = p_learner_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_courses_updated_at      ON courses;
DROP TRIGGER IF EXISTS update_course_units_updated_at ON course_units;
DROP TRIGGER IF EXISTS update_course_lessons_updated_at ON course_lessons;
DROP TRIGGER IF EXISTS update_lesson_progress_updated_at ON lesson_progress;
DROP TRIGGER IF EXISTS update_unit_progress_updated_at ON unit_progress;
DROP TRIGGER IF EXISTS update_user_stats_updated_at   ON user_stats;
DROP TRIGGER IF EXISTS trigger_update_course_progress ON course_lessons;
DROP TRIGGER IF EXISTS trg_course_units_denormalized  ON course_units;
DROP TRIGGER IF EXISTS trg_course_lessons_denormalized ON course_lessons;
DROP TRIGGER IF EXISTS trigger_update_contest_leaderboard ON contest_submissions;

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_units_updated_at
    BEFORE UPDATE ON course_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_lessons_updated_at
    BEFORE UPDATE ON course_lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at
    BEFORE UPDATE ON lesson_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unit_progress_updated_at
    BEFORE UPDATE ON unit_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at
    BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_course_progress
    AFTER UPDATE ON course_lessons
    FOR EACH ROW EXECUTE FUNCTION update_course_progress();

CREATE TRIGGER trg_course_units_denormalized
    AFTER INSERT OR UPDATE OR DELETE ON course_units
    FOR EACH ROW EXECUTE FUNCTION update_course_denormalized_fields();

CREATE TRIGGER trg_course_lessons_denormalized
    AFTER INSERT OR UPDATE OR DELETE ON course_lessons
    FOR EACH ROW EXECUTE FUNCTION update_course_denormalized_fields();

CREATE TRIGGER trigger_update_contest_leaderboard
    AFTER INSERT OR UPDATE ON contest_submissions
    FOR EACH ROW EXECUTE FUNCTION update_contest_leaderboard();

-- ============================================================
-- Knowledge Graph + A* Recommendation Engine Tables
-- ============================================================

-- Concept nodes extracted from course lessons by Gemini.
-- Each row represents one learnable concept (e.g. "Present Tense", "Greetings").
CREATE TABLE IF NOT EXISTS concept_nodes (
    id                      SERIAL PRIMARY KEY,
    course_id               INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_db_id            INTEGER NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    concept_key             VARCHAR(100) NOT NULL,
    concept_label           VARCHAR(255) NOT NULL,
    concept_type            VARCHAR(50)  NOT NULL,
    difficulty              FLOAT        NOT NULL DEFAULT 0.5,
    estimated_mastery_time  INTEGER      NOT NULL DEFAULT 15,
    created_at              TIMESTAMP    DEFAULT NOW()
);

-- Directed prerequisite edges between concept nodes.
-- from_concept_id must be understood before to_concept_id can be learned effectively.
CREATE TABLE IF NOT EXISTS concept_edges (
    id                  SERIAL PRIMARY KEY,
    course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    from_concept_id     INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    to_concept_id       INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    edge_weight         FLOAT   NOT NULL DEFAULT 1.0,
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE (from_concept_id, to_concept_id)
);

-- Live mastery score per learner per concept node.
-- Recomputed after every lesson completion via progressController.
CREATE TABLE IF NOT EXISTS concept_mastery (
    id              SERIAL PRIMARY KEY,
    learner_id      INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    course_id       INTEGER NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
    concept_id      INTEGER NOT NULL REFERENCES concept_nodes(id) ON DELETE CASCADE,
    mastery_score   FLOAT   NOT NULL DEFAULT 0.0,
    attempts        INTEGER NOT NULL DEFAULT 0,
    correct_count   INTEGER NOT NULL DEFAULT 0,
    last_updated    TIMESTAMP DEFAULT NOW(),
    UNIQUE (learner_id, concept_id)
);

-- Full A* run results stored for analytics and follow-through tracking.
CREATE TABLE IF NOT EXISTS recommendation_history (
    id                      SERIAL PRIMARY KEY,
    learner_id              INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    course_id               INTEGER NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
    recommended_concept_id  INTEGER REFERENCES concept_nodes(id)     ON DELETE SET NULL,
    recommended_lesson_db_id INTEGER REFERENCES course_lessons(id)   ON DELETE SET NULL,
    f_score                 FLOAT,
    g_score                 FLOAT,
    h_score                 FLOAT,
    reason                  TEXT,
    urgency                 VARCHAR(20) DEFAULT 'normal',
    full_path_data          JSONB,
    mastery_snapshot        JSONB,
    was_followed            BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_concept_nodes_course_id
    ON concept_nodes (course_id);

CREATE INDEX IF NOT EXISTS idx_concept_nodes_lesson_db_id
    ON concept_nodes (lesson_db_id);

CREATE INDEX IF NOT EXISTS idx_concept_edges_course_id
    ON concept_edges (course_id);

CREATE INDEX IF NOT EXISTS idx_concept_edges_from
    ON concept_edges (from_concept_id);

CREATE INDEX IF NOT EXISTS idx_concept_edges_to
    ON concept_edges (to_concept_id);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_learner_course
    ON concept_mastery (learner_id, course_id);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_concept_id
    ON concept_mastery (concept_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_history_learner_course
    ON recommendation_history (learner_id, course_id, created_at DESC);

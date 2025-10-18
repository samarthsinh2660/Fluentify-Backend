CREATE TABLE IF NOT EXISTS language_modules (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  language VARCHAR(100) NOT NULL,
  level VARCHAR(50), -- e.g., Beginner, Intermediate, Advanced
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  estimated_duration VARCHAR(100),
  total_units INTEGER DEFAULT 0,
  total_lessons INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_units (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES language_modules(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty VARCHAR(50),
  estimated_time INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS module_lessons (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER REFERENCES module_units(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL,  -- e.g., reading, listening, quiz, conversation
  description TEXT,
  media_url TEXT,  -- video/audio
  key_phrases TEXT[],
  vocabulary JSONB,
  grammar_points JSONB,
  exercises JSONB,
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learner_enrollments (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES language_modules(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  progress_percentage INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  UNIQUE (learner_id, module_id)
);
-- AI Chatbot Tables
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  language VARCHAR(50),
  session_title VARCHAR(255) DEFAULT 'New Chat',
  session_token VARCHAR(100) UNIQUE NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  message_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(20) CHECK (sender IN ('learner', 'ai')),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for chat performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_learner ON ai_chat_sessions(learner_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_active ON ai_chat_sessions(learner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id);

CREATE OR REPLACE FUNCTION cleanup_ai_sessions(p_learner_id INT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM ai_chat_messages WHERE session_id IN (
    SELECT id FROM ai_chat_sessions WHERE learner_id = p_learner_id
  );
  DELETE FROM ai_chat_sessions WHERE learner_id = p_learner_id;
END;
$$ LANGUAGE plpgsql;

--gamification
CREATE TABLE IF NOT EXISTS leaderboards (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  total_xp INTEGER DEFAULT 0,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  rank INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (learner_id, week_start)
);
-- Contest System
CREATE TABLE IF NOT EXISTS contests (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  language VARCHAR(100) NOT NULL,
  difficulty_level VARCHAR(50) NOT NULL, -- Beginner, Intermediate, Advanced
  contest_type VARCHAR(20) CHECK (contest_type IN ('mcq', 'one-liner', 'mix')) NOT NULL,
  questions JSONB NOT NULL, -- Array of questions with options and answers
  total_questions INTEGER NOT NULL,
  max_attempts INTEGER DEFAULT 1,
  time_limit INTEGER, -- in minutes, NULL for no limit
  reward_points INTEGER DEFAULT 0,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_published BOOLEAN DEFAULT false,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_submissions (
  id SERIAL PRIMARY KEY,
  contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  answers JSONB NOT NULL, -- User's answers
  score INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_questions INTEGER NOT NULL,
  percentage DECIMAL(5,2) DEFAULT 0,
  time_taken INTEGER, -- in seconds
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (contest_id, learner_id) -- One submission per contest per learner
);

CREATE TABLE IF NOT EXISTS contest_leaderboard (
  id SERIAL PRIMARY KEY,
  contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0,
  time_taken INTEGER,
  rank INTEGER,
  submitted_at TIMESTAMP,
  UNIQUE (contest_id, learner_id)
);

-- Indexes for contests
CREATE INDEX IF NOT EXISTS idx_contests_admin ON contests(admin_id);
CREATE INDEX IF NOT EXISTS idx_contests_language ON contests(language);
CREATE INDEX IF NOT EXISTS idx_contests_published ON contests(is_published);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_contest ON contest_submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_submissions_learner ON contest_submissions(learner_id);
CREATE INDEX IF NOT EXISTS idx_contest_leaderboard_contest ON contest_leaderboard(contest_id, rank);

-- Function to update contest leaderboard
CREATE OR REPLACE FUNCTION update_contest_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update leaderboard entry
  INSERT INTO contest_leaderboard (contest_id, learner_id, score, percentage, time_taken, submitted_at)
  VALUES (NEW.contest_id, NEW.learner_id, NEW.score, NEW.percentage, NEW.time_taken, NEW.submitted_at)
  ON CONFLICT (contest_id, learner_id)
  DO UPDATE SET
    score = NEW.score,
    percentage = NEW.percentage,
    time_taken = NEW.time_taken,
    submitted_at = NEW.submitted_at;
  
  -- Update ranks for this contest
  WITH ranked_submissions AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY score DESC, time_taken ASC NULLS LAST) as new_rank
    FROM contest_leaderboard
    WHERE contest_id = NEW.contest_id
  )
  UPDATE contest_leaderboard cl
  SET rank = rs.new_rank
  FROM ranked_submissions rs
  WHERE cl.id = rs.id AND cl.contest_id = NEW.contest_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update leaderboard after submission
CREATE TRIGGER trigger_update_contest_leaderboard
AFTER INSERT OR UPDATE ON contest_submissions
FOR EACH ROW
EXECUTE FUNCTION update_contest_leaderboard();
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  title VARCHAR(255),
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'reminder',  -- e.g., 'reminder', 'milestone', 'warning'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

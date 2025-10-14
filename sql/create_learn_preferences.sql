-- Table for learner preferences after signup
CREATE TABLE IF NOT EXISTS learner_preferences (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  expected_duration VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

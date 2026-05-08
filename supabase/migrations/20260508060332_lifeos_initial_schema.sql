
/*
  # LifeOS Initial Schema

  ## Tables
  - `profiles` — user profile data (height, weight, gender, diet preferences)
  - `health_conditions` — user-reported conditions (diabetes, parkinson's, etc.)
  - `daily_checkins` — daily meal/sleep/water/exercise logs
  - `health_reports` — uploaded blood/health reports (stored as base64 or URL)
  - `health_scores` — AI-generated health scores per checkin
  - `chat_messages` — chatbot conversation history

  ## Security
  - RLS enabled on all tables
  - All policies restricted to authenticated users owning the row
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  age integer,
  gender text,
  height_cm numeric,
  weight_kg numeric,
  activity_level text DEFAULT 'moderate',
  diet_types text[] DEFAULT '{}',
  food_preferences text,
  allergies text,
  onboarding_step integer DEFAULT 1,
  onboarding_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- HEALTH CONDITIONS
CREATE TABLE IF NOT EXISTS health_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condition_name text NOT NULL,
  severity text DEFAULT 'mild',
  diagnosed_year integer,
  medications text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE health_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conditions"
  ON health_conditions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conditions"
  ON health_conditions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conditions"
  ON health_conditions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conditions"
  ON health_conditions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- DAILY CHECKINS
CREATE TABLE IF NOT EXISTS daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  breakfast text,
  lunch text,
  dinner text,
  snacks text,
  breakfast_analysis text,
  lunch_analysis text,
  dinner_analysis text,
  snacks_analysis text,
  sleep_hours numeric,
  water_intake_liters numeric,
  exercise_minutes integer,
  exercise_type text,
  mood text,
  stress_level integer,
  notes text,
  ai_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own checkins"
  ON daily_checkins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkins"
  ON daily_checkins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins"
  ON daily_checkins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- HEALTH REPORTS
CREATE TABLE IF NOT EXISTS health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_name text NOT NULL,
  report_type text DEFAULT 'blood_test',
  file_data text,
  file_name text,
  file_type text,
  ai_analysis text,
  key_findings text[],
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE health_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports"
  ON health_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON health_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON health_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- HEALTH SCORES
CREATE TABLE IF NOT EXISTS health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_id uuid REFERENCES daily_checkins(id) ON DELETE CASCADE,
  score integer NOT NULL,
  nutrition_score integer,
  sleep_score integer,
  hydration_score integer,
  exercise_score integer,
  overall_assessment text,
  recommendations text[],
  disease_management_tips text,
  scored_at timestamptz DEFAULT now()
);

ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scores"
  ON health_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON health_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_scores_user ON health_scores(user_id, scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_conditions_user ON health_conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_health_reports_user ON health_reports(user_id, uploaded_at DESC);

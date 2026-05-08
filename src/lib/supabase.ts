import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string;
  diet_types: string[];
  food_preferences: string | null;
  allergies: string | null;
  onboarding_step: number;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type HealthCondition = {
  id: string;
  user_id: string;
  condition_name: string;
  severity: string;
  diagnosed_year: number | null;
  medications: string | null;
  notes: string | null;
  created_at: string;
};

export type DailyCheckin = {
  id: string;
  user_id: string;
  checkin_date: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  snacks: string | null;
  breakfast_analysis: string | null;
  lunch_analysis: string | null;
  dinner_analysis: string | null;
  snacks_analysis: string | null;
  sleep_hours: number | null;
  water_intake_liters: number | null;
  exercise_minutes: number | null;
  exercise_type: string | null;
  mood: string | null;
  stress_level: number | null;
  notes: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthReport = {
  id: string;
  user_id: string;
  report_name: string;
  report_type: string;
  file_data: string | null;
  file_name: string | null;
  file_type: string | null;
  ai_analysis: string | null;
  key_findings: string[] | null;
  uploaded_at: string;
};

export type HealthScore = {
  id: string;
  user_id: string;
  checkin_id: string | null;
  score: number;
  nutrition_score: number | null;
  sleep_score: number | null;
  hydration_score: number | null;
  exercise_score: number | null;
  overall_assessment: string | null;
  recommendations: string[] | null;
  disease_management_tips: string | null;
  scored_at: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

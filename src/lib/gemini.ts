import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function askGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, systemPrompt }),
  });
  const data = await res.json();
  if (data.error) {
    const message = String(data.error);

    if (
      res.status === 429 ||
      message.includes('"code": 429') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.toLowerCase().includes('quota')
    ) {
      throw new Error('AI quota is currently exhausted. Please try the AI feature again later.');
    }

    throw new Error(message);
  }
  return data.text as string;
}

export async function analyzeMeal(meal: string, mealType: string, userConditions: string[]): Promise<string> {
  const conditionsText = userConditions.length > 0
    ? `The user has the following health conditions: ${userConditions.join(', ')}. Explain whether this food is suitable or risky for those conditions.`
    : '';
  const prompt = `Analyze this ${mealType}: "${meal}". ${conditionsText}
Rate it as Healthy, Moderately Good, or Unhealthy.
Give a brief 2-3 sentence analysis including nutritional highlights and any concerns. Be concise and helpful.`;
  return askGemini(prompt, 'You are a certified nutritionist AI. Give practical, friendly dietary advice.');
}

export async function analyzeCheckin(checkin: {
  breakfast?: string; lunch?: string; dinner?: string; snacks?: string;
  sleep_hours?: number; water_intake_liters?: number; exercise_minutes?: number;
  exercise_type?: string; mood?: string; stress_level?: number;
}, profile: { age?: number; gender?: string; conditions: string[] }): Promise<{
  score: number; nutrition_score: number; sleep_score: number;
  hydration_score: number; exercise_score: number;
  overall_assessment: string; recommendations: string[];
  disease_management_tips: string;
}> {
  const conditionGuidance = profile.conditions.length > 0
    ? `The user has these health conditions: ${profile.conditions.join(', ')}.
Personalize every recommendation around those conditions. Mention foods or habits to prefer, limit, or monitor for these conditions.`
    : 'The user has no reported health conditions. Give general wellness guidance.';

  const prompt = `
Analyze this health data and return JSON only (no markdown):
User: ${profile.age ? `${profile.age}yo` : ''} ${profile.gender || ''}, Conditions: ${profile.conditions.join(', ') || 'none'}
Meals: Breakfast="${checkin.breakfast || 'skipped'}", Lunch="${checkin.lunch || 'skipped'}", Dinner="${checkin.dinner || 'skipped'}", Snacks="${checkin.snacks || 'none'}"
Sleep: ${checkin.sleep_hours || 0}h, Water: ${checkin.water_intake_liters || 0}L, Exercise: ${checkin.exercise_minutes || 0}min ${checkin.exercise_type || ''}, Mood: ${checkin.mood || 'neutral'}, Stress: ${checkin.stress_level || 5}/10

${conditionGuidance}

Return this JSON structure:
{
  "score": <0-100>,
  "nutrition_score": <0-100>,
  "sleep_score": <0-100>,
  "hydration_score": <0-100>,
  "exercise_score": <0-100>,
  "overall_assessment": "<2-3 sentence summary>",
  "recommendations": ["<specific tip based on today and the user's conditions>", "<specific tip based on today and the user's conditions>", "<specific tip based on today and the user's conditions>"],
  "disease_management_tips": "<if conditions exist, give condition-specific feedback based on today's meals, sleep, hydration, exercise, mood, and stress. If none, give general wellness feedback>"
}`;

  const raw = await askGemini(prompt, 'You are a health analytics AI. Return only valid JSON.');
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      score: Number(parsed.score) || 70,
      nutrition_score: Number(parsed.nutrition_score) || 70,
      sleep_score: Number(parsed.sleep_score) || 70,
      hydration_score: Number(parsed.hydration_score) || 70,
      exercise_score: Number(parsed.exercise_score) || 70,
      overall_assessment: String(parsed.overall_assessment || 'Your daily check-in was analyzed successfully.'),
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String)
        : ['Maintain a balanced diet', 'Stay hydrated', 'Exercise regularly'],
      disease_management_tips: Array.isArray(parsed.disease_management_tips)
        ? parsed.disease_management_tips.map(String).join(' ')
        : String(parsed.disease_management_tips || 'Consult your healthcare provider for personalized advice.'),
    };
  } catch {
    return {
      score: 70, nutrition_score: 70, sleep_score: 70,
      hydration_score: 70, exercise_score: 70,
      overall_assessment: raw.substring(0, 300),
      recommendations: ['Maintain a balanced diet', 'Stay hydrated', 'Exercise regularly'],
      disease_management_tips: 'Consult your healthcare provider for personalized advice.',
    };
  }
}

export async function analyzeReport(_fileData: string, fileName: string, userConditions: string[]): Promise<{
  analysis: string; key_findings: string[];
}> {
  const conditionsText = userConditions.length > 0
    ? `Patient conditions: ${userConditions.join(', ')}.`
    : '';
  const prompt = `
${conditionsText}
The user uploaded a health report named "${fileName}". Based on the filename and context, provide:
1. A detailed analysis of what this type of report typically shows
2. Key health metrics to watch for
3. How results relate to their conditions
4. Recommendations

Return JSON only:
{
  "analysis": "<detailed analysis>",
  "key_findings": ["<finding1>", "<finding2>", "<finding3>", "<finding4>"]
}`;

  const raw = await askGemini(prompt, 'You are a medical report analyst AI. Be thorough but accessible. Return only valid JSON.');
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      analysis: raw.substring(0, 500),
      key_findings: ['Report uploaded successfully', 'Consult your doctor for interpretation'],
    };
  }
}

export async function analyzeOnboarding(profile: {
  age?: number; gender?: string; height_cm?: number; weight_kg?: number;
  activity_level?: string; diet_types?: string[]; conditions: string[];
}): Promise<string> {
  const bmi = profile.height_cm && profile.weight_kg
    ? (profile.weight_kg / ((profile.height_cm / 100) ** 2)).toFixed(1)
    : null;
  const prompt = `
New user health profile:
- Age: ${profile.age || 'unknown'}, Gender: ${profile.gender || 'unknown'}
- Height: ${profile.height_cm || 'unknown'}cm, Weight: ${profile.weight_kg || 'unknown'}kg${bmi ? `, BMI: ${bmi}` : ''}
- Activity: ${profile.activity_level || 'moderate'}
- Diet: ${profile.diet_types?.join(', ') || 'mixed'}
- Health Conditions: ${profile.conditions.join(', ') || 'none'}

Provide a warm, personalized welcome message with 3-4 key health insights specific to this profile. Keep it encouraging and actionable. 2-3 paragraphs.`;

  return askGemini(prompt, 'You are LifeOS, a caring personal health AI assistant. Be warm, encouraging and specific.');
}

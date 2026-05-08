import { useEffect, useRef, useState, type ElementType } from 'react';
import { supabase, DailyCheckin as DailyCheckinType, HealthCondition } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { analyzeCheckin, analyzeMeal } from '../lib/gemini';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Droplets,
  Dumbbell,
  FileText,
  Loader2,
  Moon,
  Smile,
  Sparkles,
  Utensils,
} from 'lucide-react';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
type MealKey = typeof MEAL_TYPES[number];
type MealRating = 'Healthy' | 'Moderately Good' | 'Unhealthy' | null;

type ScoreResult = {
  score: number;
  nutrition_score: number;
  sleep_score: number;
  hydration_score: number;
  exercise_score: number;
  overall_assessment: string;
  recommendations: string[];
  disease_management_tips: string;
};

function getMealRating(analysis: string | null): MealRating {
  if (!analysis) return null;

  const text = analysis.toLowerCase();
  if (text.includes('unhealthy')) return 'Unhealthy';
  if (text.includes('moderately')) return 'Moderately Good';
  if (text.includes('healthy')) return 'Healthy';

  return null;
}

function RatingBadge({ rating }: { rating: MealRating }) {
  if (!rating) return null;

  const styles = {
    Healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Moderately Good': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Unhealthy: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${styles[rating]}`}>
      {rating}
    </span>
  );
}

function MealInput({
  label,
  icon: Icon,
  value,
  analysis,
  analyzing,
  onChange,
}: {
  label: string;
  icon: ElementType;
  value: string;
  analysis: string | null;
  analyzing: boolean;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rating = getMealRating(analysis);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <Icon className="w-5 h-5 text-slate-400 flex-shrink-0 mt-8" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm font-medium text-slate-300">{label}</span>
            <div className="flex items-center gap-2">
              {rating && <RatingBadge rating={rating} />}
              {analysis && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="text-slate-500 hover:text-slate-300"
                  aria-label={expanded ? 'Hide analysis' : 'Show analysis'}
                >
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={event => onChange(event.target.value)}
              placeholder={`What did you have for ${label.toLowerCase()}?`}
              className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-lg px-3 py-2 pr-28 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {analyzing ? (
                <span className="flex items-center gap-1.5 text-xs text-cyan-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analysing
                </span>
              ) : analysis ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Sparkles className="w-3 h-3" />
                  Analysed
                </span>
              ) : null}
            </div>
          </div>

          {!analysis && value.trim().length >= 3 && !analyzing && (
            <p className="text-xs text-slate-600 mt-2">
              Food analysis starts automatically after you pause typing.
            </p>
          )}
        </div>
      </div>

      {expanded && analysis && (
        <div className="px-4 pb-4 pt-0 border-t border-white/5">
          <p className="text-slate-400 text-sm leading-relaxed">{analysis}</p>
        </div>
      )}
    </div>
  );
}

export default function DailyCheckin() {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const analysedMealValues = useRef<Record<MealKey, string>>({
    breakfast: '',
    lunch: '',
    dinner: '',
    snacks: '',
  });

  const [checkin, setCheckin] = useState<DailyCheckinType | null>(null);
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [view, setView] = useState<'form' | 'results'>('form');
  const [form, setForm] = useState({
    breakfast: '',
    lunch: '',
    dinner: '',
    snacks: '',
    sleep_hours: '',
    water_intake_liters: '',
    exercise_minutes: '',
    exercise_type: '',
    mood: 'good',
    stress_level: '5',
    notes: '',
  });
  const [analyses, setAnalyses] = useState<Record<MealKey, string | null>>({
    breakfast: null,
    lunch: null,
    dinner: null,
    snacks: null,
  });
  const [analyzingMeal, setAnalyzingMeal] = useState<MealKey | null>(null);
  const [scoring, setScoring] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const [checkinRes, conditionsRes] = await Promise.all([
        supabase
          .from('daily_checkins')
          .select('*')
          .eq('user_id', user.id)
          .eq('checkin_date', today)
          .maybeSingle(),
        supabase.from('health_conditions').select('*').eq('user_id', user.id),
      ]);

      if (checkinRes.data) {
        const currentCheckin = checkinRes.data;
        setCheckin(currentCheckin);
        setForm({
          breakfast: currentCheckin.breakfast ?? '',
          lunch: currentCheckin.lunch ?? '',
          dinner: currentCheckin.dinner ?? '',
          snacks: currentCheckin.snacks ?? '',
          sleep_hours: currentCheckin.sleep_hours?.toString() ?? '',
          water_intake_liters: currentCheckin.water_intake_liters?.toString() ?? '',
          exercise_minutes: currentCheckin.exercise_minutes?.toString() ?? '',
          exercise_type: currentCheckin.exercise_type ?? '',
          mood: currentCheckin.mood ?? 'good',
          stress_level: currentCheckin.stress_level?.toString() ?? '5',
          notes: currentCheckin.notes ?? '',
        });
        setAnalyses({
          breakfast: currentCheckin.breakfast_analysis,
          lunch: currentCheckin.lunch_analysis,
          dinner: currentCheckin.dinner_analysis,
          snacks: currentCheckin.snacks_analysis,
        });
        analysedMealValues.current = {
          breakfast: currentCheckin.breakfast_analysis ? currentCheckin.breakfast ?? '' : '',
          lunch: currentCheckin.lunch_analysis ? currentCheckin.lunch ?? '' : '',
          dinner: currentCheckin.dinner_analysis ? currentCheckin.dinner ?? '' : '',
          snacks: currentCheckin.snacks_analysis ? currentCheckin.snacks ?? '' : '',
        };
      }

      setConditions(conditionsRes.data ?? []);
    })();
  }, [user, today]);

  useEffect(() => {
    if (analyzingMeal) return;

    const timers = MEAL_TYPES.map(meal => {
      const mealValue = form[meal].trim();

      if (mealValue.length < 3 || analysedMealValues.current[meal] === mealValue) {
        return null;
      }

      return window.setTimeout(() => {
        analyzeMealItem(meal);
      }, 900);
    });

    return () => {
      timers.forEach(timer => {
        if (timer) window.clearTimeout(timer);
      });
    };
  }, [form.breakfast, form.lunch, form.dinner, form.snacks, conditions, analyzingMeal]);

  async function analyzeMealItem(mealType: MealKey) {
    const mealValue = form[mealType].trim();
    if (!mealValue) return null;
    if (analyzedRecently(mealType, mealValue)) return analyses[mealType];

    setAnalyzingMeal(mealType);
    setError('');

    try {
      const conditionDetails = conditions.map(formatConditionForAi);
      const result = await analyzeMeal(mealValue, mealType, conditionDetails);
      analysedMealValues.current[mealType] = mealValue;
      setAnalyses(current => ({ ...current, [mealType]: result }));
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyse this food right now.');
      return null;
    } finally {
      setAnalyzingMeal(null);
    }
  }

  function analyzedRecently(mealType: MealKey, mealValue: string) {
    return analysedMealValues.current[mealType] === mealValue;
  }

  function updateMeal(meal: MealKey, value: string) {
    setForm(current => ({ ...current, [meal]: value }));

    if (analysedMealValues.current[meal] !== value.trim()) {
      setAnalyses(current => ({ ...current, [meal]: null }));
    }
  }

  async function saveCheckin(analysesToSave = analyses) {
    if (!user) return null;

    const data = {
      user_id: user.id,
      checkin_date: today,
      breakfast: form.breakfast || null,
      lunch: form.lunch || null,
      dinner: form.dinner || null,
      snacks: form.snacks || null,
      breakfast_analysis: analysesToSave.breakfast,
      lunch_analysis: analysesToSave.lunch,
      dinner_analysis: analysesToSave.dinner,
      snacks_analysis: analysesToSave.snacks,
      sleep_hours: form.sleep_hours ? parseFloat(form.sleep_hours) : null,
      water_intake_liters: form.water_intake_liters ? parseFloat(form.water_intake_liters) : null,
      exercise_minutes: form.exercise_minutes ? parseInt(form.exercise_minutes) : null,
      exercise_type: form.exercise_type || null,
      mood: form.mood || null,
      stress_level: form.stress_level ? parseInt(form.stress_level) : null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    let checkinId = checkin?.id ?? null;

    if (checkin) {
      const { error: updateError } = await supabase
        .from('daily_checkins')
        .update(data)
        .eq('id', checkin.id);

      if (updateError) throw updateError;
    } else {
      const { data: newCheckin, error: insertError } = await supabase
        .from('daily_checkins')
        .insert(data)
        .select()
        .maybeSingle();

      if (insertError) throw insertError;

      checkinId = newCheckin?.id ?? null;
      setCheckin(newCheckin);
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
    return checkinId;
  }

  async function handleCheckScore() {
    if (!user) return;

    setScoring(true);
    setError('');

    try {
      const nextAnalyses = { ...analyses };

      for (const meal of MEAL_TYPES) {
        const mealValue = form[meal].trim();
        if (mealValue.length >= 3 && !analyzedRecently(meal, mealValue)) {
          const result = await analyzeMealItem(meal);
          nextAnalyses[meal] = result;
        }
      }

      setAnalyses(nextAnalyses);

      const checkinId = await saveCheckin(nextAnalyses);
      const conditionDetails = conditions.map(formatConditionForAi);
      const result = await analyzeCheckin(
        {
          breakfast: form.breakfast,
          lunch: form.lunch,
          dinner: form.dinner,
          snacks: form.snacks,
          sleep_hours: form.sleep_hours ? parseFloat(form.sleep_hours) : undefined,
          water_intake_liters: form.water_intake_liters ? parseFloat(form.water_intake_liters) : undefined,
          exercise_minutes: form.exercise_minutes ? parseInt(form.exercise_minutes) : undefined,
          exercise_type: form.exercise_type,
          mood: form.mood,
          stress_level: form.stress_level ? parseInt(form.stress_level) : undefined,
        },
        {
          age: profile?.age ?? undefined,
          gender: profile?.gender ?? undefined,
          conditions: conditionDetails,
        }
      );

      const { error: scoreError } = await supabase.from('health_scores').insert({
        user_id: user.id,
        checkin_id: checkinId,
        score: result.score,
        nutrition_score: result.nutrition_score,
        sleep_score: result.sleep_score,
        hydration_score: result.hydration_score,
        exercise_score: result.exercise_score,
        overall_assessment: result.overall_assessment,
        recommendations: result.recommendations,
        disease_management_tips: result.disease_management_tips,
      });

      if (scoreError) throw scoreError;

      setScoreResult(result);
      setView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate your score right now.');
    } finally {
      setScoring(false);
    }
  }

  const MOODS = [
    { value: 'great', label: 'Great' },
    { value: 'good', label: 'Good' },
    { value: 'okay', label: 'Okay' },
    { value: 'low', label: 'Low' },
    { value: 'bad', label: 'Bad' },
  ];

  const scoreLabel = scoreResult
    ? scoreResult.score >= 80
      ? 'Excellent Day!'
      : scoreResult.score >= 60
        ? 'Good Progress'
        : 'Room to Improve'
    : '';

  return (
    <div className="flex-1 overflow-y-auto bg-[#060b14] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            {view === 'results' ? 'Daily Score' : 'Daily Check-in'}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {view === 'results' && scoreResult ? (
          <ResultsView
            analyses={analyses}
            conditions={conditions}
            form={form}
            scoreLabel={scoreLabel}
            scoreResult={scoreResult}
            onBack={() => setView('form')}
          />
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Utensils className="w-5 h-5 text-cyan-400" />
                <h2 className="text-white font-semibold">Meals</h2>
              </div>
              <div className="space-y-3">
                {MEAL_TYPES.map(meal => (
                  <MealInput
                    key={meal}
                    label={meal.charAt(0).toUpperCase() + meal.slice(1)}
                    icon={Utensils}
                    value={form[meal]}
                    analysis={analyses[meal]}
                    analyzing={analyzingMeal === meal}
                    onChange={value => updateMeal(meal, value)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Moon className="w-5 h-5 text-blue-400" />
                  <h2 className="text-white font-semibold">Sleep</h2>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={form.sleep_hours}
                    onChange={event => setForm(current => ({ ...current, sleep_hours: event.target.value }))}
                    placeholder="7.5"
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                  <span className="text-slate-400 text-sm">hrs</span>
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {['6', '7', '7.5', '8', '9'].map(hours => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => setForm(current => ({ ...current, sleep_hours: hours }))}
                      className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                        form.sleep_hours === hours
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                          : 'bg-white/5 border-white/10 text-slate-500'
                      }`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Droplets className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-white font-semibold">Water</h2>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.25"
                    value={form.water_intake_liters}
                    onChange={event => setForm(current => ({ ...current, water_intake_liters: event.target.value }))}
                    placeholder="2.5"
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-cyan-500/50 transition-all"
                  />
                  <span className="text-slate-400 text-sm">L</span>
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  {['1', '1.5', '2', '2.5', '3'].map(liters => (
                    <button
                      key={liters}
                      type="button"
                      onClick={() => setForm(current => ({ ...current, water_intake_liters: liters }))}
                      className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                        form.water_intake_liters === liters
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                          : 'bg-white/5 border-white/10 text-slate-500'
                      }`}
                    >
                      {liters}L
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
                <h2 className="text-white font-semibold">Exercise</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.exercise_minutes}
                    onChange={event => setForm(current => ({ ...current, exercise_minutes: event.target.value }))}
                    placeholder="30"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-2">Type</label>
                  <input
                    type="text"
                    value={form.exercise_type}
                    onChange={event => setForm(current => ({ ...current, exercise_type: event.target.value }))}
                    placeholder="e.g. Running, Yoga, Gym"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Smile className="w-5 h-5 text-amber-400" />
                <h2 className="text-white font-semibold">Mood & Wellbeing</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs text-slate-500 mb-3">How are you feeling?</label>
                  <div className="flex flex-wrap gap-2">
                    {MOODS.map(mood => (
                      <button
                        key={mood.value}
                        type="button"
                        onClick={() => setForm(current => ({ ...current, mood: mood.value }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          form.mood === mood.value
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        {mood.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-3">
                    Stress Level: <span className="text-white font-medium">{form.stress_level}/10</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={form.stress_level}
                    onChange={event => setForm(current => ({ ...current, stress_level: event.target.value }))}
                    className="w-full accent-cyan-500"
                  />
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>Relaxed</span>
                    <span>Stressed</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-slate-400" />
                <h2 className="text-white font-semibold">Notes</h2>
              </div>
              <textarea
                value={form.notes}
                onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
                placeholder="Any additional notes about your day, symptoms, or observations..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => void saveCheckin()}
                className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {saved ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Saved!
                  </>
                ) : (
                  'Save Progress'
                )}
              </button>
              <button
                type="button"
                onClick={handleCheckScore}
                disabled={scoring || Boolean(analyzingMeal)}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analysing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Check Score
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatConditionForAi(condition: HealthCondition) {
  return [
    condition.condition_name,
    condition.severity ? `severity: ${condition.severity}` : '',
    condition.medications ? `medications: ${condition.medications}` : '',
    condition.notes ? `notes: ${condition.notes}` : '',
  ].filter(Boolean).join(' | ');
}

function ResultsView({
  analyses,
  conditions,
  form,
  onBack,
  scoreLabel,
  scoreResult,
}: {
  analyses: Record<MealKey, string | null>;
  conditions: HealthCondition[];
  form: Record<string, string>;
  onBack: () => void;
  scoreLabel: string;
  scoreResult: ScoreResult;
}) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to check-in
      </button>

      <div className="bg-gradient-to-r from-cyan-500/15 to-blue-600/15 border border-cyan-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-bold text-white">{scoreResult.score}</span>
          </div>
          <div>
            <p className="text-white font-semibold text-xl">Today's Health Score</p>
            <p
              className={`text-sm font-medium ${
                scoreResult.score >= 80
                  ? 'text-cyan-400'
                  : scoreResult.score >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {scoreLabel}
            </p>
          </div>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">{scoreResult.overall_assessment}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Nutrition', value: scoreResult.nutrition_score, color: 'text-cyan-400' },
          { label: 'Sleep', value: scoreResult.sleep_score, color: 'text-blue-400' },
          { label: 'Hydration', value: scoreResult.hydration_score, color: 'text-sky-400' },
          { label: 'Exercise', value: scoreResult.exercise_score, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-5">
            <BarChart3 className={`w-5 h-5 ${color} mb-3`} />
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">
              {value}<span className="text-sm text-slate-500">/100</span>
            </p>
          </div>
        ))}
      </div>

      <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Food Insights</h2>
        <div className="space-y-3">
          {MEAL_TYPES.some(meal => form[meal]?.trim()) ? (
            MEAL_TYPES.map(meal => (
              form[meal]?.trim() && (
                <div key={meal} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wider">{meal}</p>
                      <p className="text-white text-sm">{form[meal]}</p>
                    </div>
                    <RatingBadge rating={getMealRating(analyses[meal])} />
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {analyses[meal] ?? 'No food analysis available for this item.'}
                  </p>
                </div>
              )
            ))
          ) : (
            <p className="text-slate-500 text-sm">No meals were entered for this check-in.</p>
          )}
        </div>
      </div>

      <div className="bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">AI Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scoreResult.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
              <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <p className="text-slate-300 text-sm leading-relaxed">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {scoreResult.disease_management_tips && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
          <p className="text-amber-400 text-sm font-semibold mb-2">
            {conditions.length > 0 ? 'Disease Management' : 'Wellness Tips'}
          </p>
          <p className="text-slate-300 text-sm leading-relaxed">{scoreResult.disease_management_tips}</p>
        </div>
      )}
    </div>
  );
}

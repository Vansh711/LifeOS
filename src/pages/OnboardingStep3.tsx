import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { analyzeOnboarding } from '../lib/gemini';
import { Activity, ArrowLeft, CheckCircle, ChevronRight, Plus, Sparkles, X } from 'lucide-react';

const COMMON_CONDITIONS = [
  'Type 2 Diabetes', 'Type 1 Diabetes', "Parkinson's Disease", "Alzheimer's Disease",
  'Hypertension', 'Heart Disease', 'Asthma', 'COPD', 'Arthritis',
  'Osteoporosis', 'Thyroid Disorder', 'Depression', 'Anxiety',
  'IBS / Crohn\'s', 'Kidney Disease', 'Liver Disease', 'Celiac Disease',
  'PCOS', 'Anemia', 'High Cholesterol',
];

type ConditionEntry = {
  name: string;
  severity: string;
  medications: string;
  notes: string;
};

export default function OnboardingStep3() {
  const { user, profile, refreshProfile } = useAuth();

  const [conditions, setConditions] = useState<ConditionEntry[]>([]);
  const [customCondition, setCustomCondition] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [aiWelcome, setAiWelcome] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function addCondition(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName || conditions.find(c => c.name.toLowerCase() === trimmedName.toLowerCase())) return;

    setConditions(c => [
      ...c,
      {
        name: trimmedName,
        severity: 'mild',
        medications: '',
        notes: '',
      },
    ]);
  }

  function addCustomCondition() {
    addCondition(customCondition);
    setCustomCondition('');
  }

  function removeCondition(name: string) {
    setConditions(c => c.filter(x => x.name !== name));
  }

  function updateCondition(
    name: string,
    field: keyof ConditionEntry,
    value: string
  ) {
    setConditions(c =>
      c.map(x =>
        x.name === name
          ? { ...x, [field]: value }
          : x
      )
    );
  }

  async function handleFinish() {
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from('health_conditions')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      if (conditions.length > 0) {
        const { error: insertError } = await supabase
          .from('health_conditions')
          .insert(
            conditions.map(c => ({
              user_id: user.id,
              condition_name: c.name,
              severity: c.severity,
              medications: c.medications || null,
              notes: c.notes || null,
            }))
          );

        if (insertError) {
          throw insertError;
        }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_step: 3,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (profileError) {
        throw profileError;
      }

      await refreshProfile(user.id);

      try {
        setAnalyzing(true);

        const conditionNames = conditions.map(c => c.name);

        const welcome = await analyzeOnboarding({
          age: profile?.age ?? undefined,
          gender: profile?.gender ?? undefined,
          height_cm: profile?.height_cm ?? undefined,
          weight_kg: profile?.weight_kg ?? undefined,
          activity_level: profile?.activity_level,
          diet_types: profile?.diet_types,
          conditions: conditionNames,
        });

        setAiWelcome(welcome);
        setDone(true);
      } catch (aiError) {
        console.warn('AI welcome generation skipped:', aiError);
      }

    } catch (err: unknown) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred'
      );
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  }

  if (done && aiWelcome) {
    return (
      <div className="min-h-screen bg-[#060b14] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="bg-[#0d1f3c]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome to LifeOS!
            </h2>

            <p className="text-slate-400 text-sm mb-6">
              Your AI health profile is ready
            </p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-left mb-6">
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {aiWelcome}
              </p>
            </div>

            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 rounded-xl transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b14] flex items-center justify-center p-6">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>

          <span className="text-2xl font-bold text-white">
            LifeOS
          </span>
        </div>

        <div className="flex items-center gap-2 mb-8 justify-center">
          {[1, 2, 3].map(step => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === 3
                    ? 'bg-cyan-500 text-white'
                    : 'bg-cyan-500/30 text-cyan-400'
                }`}
              >
                {step}
              </div>

              {step < 3 && (
                <div className="w-12 h-0.5 bg-cyan-500/50" />
              )}
            </div>
          ))}
        </div>

        <div className="bg-[#0d1f3c]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8">

          {!showReview ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Health Conditions
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  Add any diseases or conditions you have. You can skip this if none apply.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Disease or condition name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customCondition}
                      onChange={e => setCustomCondition(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomCondition();
                        }
                      }}
                      placeholder="e.g. Diabetes, asthma, thyroid disorder"
                      className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={addCustomCondition}
                      disabled={!customCondition.trim()}
                      className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed px-4 rounded-xl transition-all"
                      aria-label="Add condition"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-400 mb-3">
                    Common conditions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_CONDITIONS.map(condition => {
                      const selected = conditions.some(c => c.name === condition);

                      return (
                        <button
                          key={condition}
                          type="button"
                          onClick={() => selected ? removeCondition(condition) : addCondition(condition)}
                          className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                            selected
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          {condition}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {conditions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-400">
                      Added conditions
                    </p>
                    {conditions.map(condition => (
                      <div key={condition.name} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="text-white font-medium">{condition.name}</p>
                            <p className="text-slate-500 text-xs mt-1">Add details if you want more personalized insights.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCondition(condition.name)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                            aria-label={`Remove ${condition.name}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1.5">Severity</label>
                            <select
                              value={condition.severity}
                              onChange={e => updateCondition(condition.name, 'severity', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                            >
                              <option value="mild" className="bg-[#0d1f3c]">Mild</option>
                              <option value="moderate" className="bg-[#0d1f3c]">Moderate</option>
                              <option value="severe" className="bg-[#0d1f3c]">Severe</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1.5">Medications</label>
                            <input
                              type="text"
                              value={condition.medications}
                              onChange={e => updateCondition(condition.name, 'medications', e.target.value)}
                              placeholder="Optional"
                              className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1.5">Notes</label>
                            <input
                              type="text"
                              value={condition.notes}
                              onChange={e => updateCondition(condition.name, 'notes', e.target.value)}
                              placeholder="Optional"
                              className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowReview(true)}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  Review Details
                  <ChevronRight className="w-4 h-4" />
                </button>

                <p className="text-center text-slate-600 text-xs">
                  No conditions? Leave this page empty and continue to review.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Edit conditions
                </button>

                <h2 className="text-2xl font-bold text-white">
                  Review Your Details
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  Check your profile before finishing setup.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                    <p className="text-white font-semibold">Basic profile</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <ReviewItem label="Age" value={profile?.age} />
                    <ReviewItem label="Gender" value={profile?.gender} />
                    <ReviewItem label="Height" value={profile?.height_cm ? `${profile.height_cm} cm` : null} />
                    <ReviewItem label="Weight" value={profile?.weight_kg ? `${profile.weight_kg} kg` : null} />
                    <ReviewItem label="Activity" value={profile?.activity_level} />
                    <ReviewItem label="Diet" value={profile?.diet_types?.length ? profile.diet_types.join(', ') : null} />
                    <ReviewItem label="Food preferences" value={profile?.food_preferences} />
                    <ReviewItem label="Allergies" value={profile?.allergies} />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                    <p className="text-white font-semibold">Health conditions</p>
                  </div>

                  {conditions.length === 0 ? (
                    <p className="text-slate-500 text-sm">No diseases or conditions added.</p>
                  ) : (
                    <div className="space-y-3">
                      {conditions.map(condition => (
                        <div key={condition.name} className="border border-white/10 rounded-lg p-3">
                          <p className="text-white text-sm font-medium">{condition.name}</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                            <ReviewItem label="Severity" value={condition.severity} />
                            <ReviewItem label="Medications" value={condition.medications} />
                            <ReviewItem label="Notes" value={condition.notes} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleFinish}
                disabled={loading || analyzing}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Analyzing your profile...
                  </>
                ) : loading ? (
                  'Saving...'
                ) : (
                  <>
                    Complete Setup
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-slate-300 text-sm capitalize">{value || 'Not added'}</p>
    </div>
  );
}

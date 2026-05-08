import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Activity, ChevronRight, User, Ruler, Scale } from 'lucide-react';

const DIET_OPTIONS = [
  'Omnivore',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Keto',
  'Paleo',
  'Mediterranean',
  'Gluten-Free',
  'Dairy-Free',
  'Low-Carb',
  'High-Protein',
  'Intermittent Fasting',
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { value: 'light', label: 'Light', desc: '1-3 days/week' },
  { value: 'moderate', label: 'Moderate', desc: '3-5 days/week' },
  { value: 'active', label: 'Active', desc: '6-7 days/week' },
  { value: 'very_active', label: 'Very Active', desc: 'Twice daily or intense' },
];

export default function OnboardingStep2() {
  const { user, refreshProfile } = useAuth();

  const [form, setForm] = useState({
    age: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    activity_level: 'moderate',
    diet_types: [] as string[],
    food_preferences: '',
    allergies: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleDiet(diet: string) {
    setForm((f) => ({
      ...f,
      diet_types: f.diet_types.includes(diet)
        ? f.diet_types.filter((d) => d !== diet)
        : [...f.diet_types, diet],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          age: form.age ? parseInt(form.age) : null,
          gender: form.gender || null,
          height_cm: form.height_cm
            ? parseFloat(form.height_cm)
            : null,
          weight_kg: form.weight_kg
            ? parseFloat(form.weight_kg)
            : null,
          activity_level: form.activity_level,
          diet_types: form.diet_types,
          food_preferences: form.food_preferences || null,
          allergies: form.allergies || null,
          onboarding_step: 3,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      await refreshProfile(user.id);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060b14] flex items-center justify-center p-6">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />

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
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === 2
                    ? 'bg-cyan-500 text-white'
                    : step < 2
                    ? 'bg-cyan-500/30 text-cyan-400'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                {step}
              </div>

              {step < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    step < 2
                      ? 'bg-cyan-500/50'
                      : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-[#0d1f3c]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">
              Tell us about yourself
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              This helps us personalize your health insights
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Age
                </label>

                <input
                  type="number"
                  min="1"
                  max="120"
                  value={form.age}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      age: e.target.value,
                    }))
                  }
                  placeholder="25"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Gender
                </label>

                <select
                  value={form.gender}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      gender: e.target.value,
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                >
                  <option
                    value=""
                    className="bg-[#0d1f3c]"
                  >
                    Select gender
                  </option>

                  <option
                    value="male"
                    className="bg-[#0d1f3c]"
                  >
                    Male
                  </option>

                  <option
                    value="female"
                    className="bg-[#0d1f3c]"
                  >
                    Female
                  </option>

                  <option
                    value="non-binary"
                    className="bg-[#0d1f3c]"
                  >
                    Non-binary
                  </option>

                  <option
                    value="prefer-not-to-say"
                    className="bg-[#0d1f3c]"
                  >
                    Prefer not to say
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Height (cm)
                </label>

                <input
                  type="number"
                  min="50"
                  max="250"
                  value={form.height_cm}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      height_cm: e.target.value,
                    }))
                  }
                  placeholder="170"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Weight (kg)
                </label>

                <input
                  type="number"
                  min="20"
                  max="300"
                  step="0.1"
                  value={form.weight_kg}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      weight_kg: e.target.value,
                    }))
                  }
                  placeholder="70"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">
                Activity Level
              </label>

              <div className="grid grid-cols-5 gap-2">
                {ACTIVITY_LEVELS.map(
                  ({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          activity_level: value,
                        }))
                      }
                      className={`p-3 rounded-xl border text-center transition-all ${
                        form.activity_level === value
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-sm font-medium">
                        {label}
                      </div>

                      <div className="text-xs mt-0.5 opacity-70">
                        {desc}
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">
                Diet Types (select all that apply)
              </label>

              <div className="flex flex-wrap gap-2">
                {DIET_OPTIONS.map((diet) => (
                  <button
                    key={diet}
                    type="button"
                    onClick={() => toggleDiet(diet)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      form.diet_types.includes(diet)
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {diet}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Food Preferences
                </label>

                <input
                  type="text"
                  value={form.food_preferences}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      food_preferences: e.target.value,
                    }))
                  }
                  placeholder="e.g. loves spicy food"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Allergies
                </label>

                <input
                  type="text"
                  value={form.allergies}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      allergies: e.target.value,
                    }))
                  }
                  placeholder="e.g. nuts, lactose"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

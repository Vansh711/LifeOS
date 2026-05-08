import { useEffect, useState } from 'react';
import { supabase, DailyCheckin, HealthScore, HealthCondition } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Activity, TrendingUp, Droplets, Moon, Dumbbell, Heart, AlertCircle, ChevronRight, Flame } from 'lucide-react';

type Props = { onNavigate: (page: 'checkin' | 'reports' | 'chat') => void };

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#22d3ee' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, unit, color }: {
  icon: React.ElementType; label: string; value: string | number | null; unit: string; color: string;
}) {
  return (
    <div className="bg-[#0d1f3c]/40 border border-white/5 rounded-2xl p-5">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">
        {value ?? '—'}<span className="text-sm font-normal text-slate-400 ml-1">{value ? unit : ''}</span>
      </p>
    </div>
  );
}

export default function Dashboard({ onNavigate }: Props) {
  const { user, profile } = useAuth();
  const [latestCheckin, setLatestCheckin] = useState<DailyCheckin | null>(null);
  const [latestScore, setLatestScore] = useState<HealthScore | null>(null);
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [recentScores, setRecentScores] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [checkinRes, conditionsRes, scoresRes] = await Promise.all([
        supabase.from('daily_checkins').select('*').eq('user_id', user.id).order('checkin_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('health_conditions').select('*').eq('user_id', user.id),
        supabase.from('health_scores').select('*').eq('user_id', user.id).order('scored_at', { ascending: false }).limit(7),
      ]);
      setLatestCheckin(checkinRes.data);
      setConditions(conditionsRes.data ?? []);
      const scores = scoresRes.data ?? [];
      setRecentScores(scores);
      setLatestScore(scores[0] ?? null);
      setLoading(false);
    })();
  }, [user]);

  const bmi = profile?.height_cm && profile?.weight_kg
    ? (profile.weight_kg / ((profile.height_cm / 100) ** 2)).toFixed(1)
    : null;

  const bmiCategory = bmi
    ? parseFloat(bmi) < 18.5 ? 'Underweight' : parseFloat(bmi) < 25 ? 'Normal' : parseFloat(bmi) < 30 ? 'Overweight' : 'Obese'
    : null;

  const today = new Date().toISOString().split('T')[0];
  const hasCheckinToday = latestCheckin?.checkin_date === today;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#060b14] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              {profile?.full_name?.split(' ')[0] || 'there'}
            </span>
          </h1>
          <p className="text-slate-400 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Check-in CTA */}
        {!hasCheckinToday && (
          <button
            onClick={() => onNavigate('checkin')}
            className="w-full mb-6 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 hover:border-cyan-400/50 rounded-2xl p-5 flex items-center gap-4 transition-all group"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-semibold">Complete Today's Check-in</p>
              <p className="text-slate-400 text-sm">Log your meals, sleep, and activity for your daily health score</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
          </button>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Health Score */}
          <div className="col-span-12 md:col-span-4 bg-[#0d1f3c]/60 border border-white/5 rounded-2xl p-6">
            <p className="text-slate-400 text-sm font-medium mb-4">Health Score</p>
            {latestScore ? (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ScoreRing score={latestScore.score} size={140} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-white">{latestScore.score}</span>
                    <span className="text-slate-400 text-xs">/100</span>
                  </div>
                </div>
                <p className={`mt-3 text-sm font-medium ${
                  latestScore.score >= 80 ? 'text-cyan-400' : latestScore.score >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {latestScore.score >= 80 ? 'Excellent' : latestScore.score >= 60 ? 'Good' : 'Needs Work'}
                </p>
                {latestScore.overall_assessment && (
                  <p className="text-slate-500 text-xs text-center mt-2 leading-relaxed line-clamp-3">
                    {latestScore.overall_assessment}
                  </p>
                )}
                {/* Sub scores */}
                <div className="mt-4 w-full space-y-2">
                  {[
                    { label: 'Nutrition', value: latestScore.nutrition_score },
                    { label: 'Sleep', value: latestScore.sleep_score },
                    { label: 'Hydration', value: latestScore.hydration_score },
                    { label: 'Exercise', value: latestScore.exercise_score },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16">{label}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                          style={{ width: `${value ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-6 text-right">{value ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <Activity className="w-10 h-10 text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm text-center">Complete a check-in to see your health score</p>
              </div>
            )}
          </div>

          {/* Recent trend */}
          <div className="col-span-12 md:col-span-8">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <MetricCard icon={Moon} label="Sleep" value={latestCheckin?.sleep_hours ?? null} unit="hrs" color="bg-blue-600/60" />
              <MetricCard icon={Droplets} label="Water" value={latestCheckin?.water_intake_liters ?? null} unit="L" color="bg-cyan-600/60" />
              <MetricCard icon={Dumbbell} label="Exercise" value={latestCheckin?.exercise_minutes ?? null} unit="min" color="bg-emerald-600/60" />
              <MetricCard icon={TrendingUp} label="BMI" value={bmi} unit={bmiCategory ?? ''} color="bg-amber-600/60" />
            </div>

            {/* Score Trend */}
            {recentScores.length > 1 && (
              <div className="bg-[#0d1f3c]/40 border border-white/5 rounded-2xl p-5">
                <p className="text-slate-400 text-sm font-medium mb-4">7-Day Score Trend</p>
                <div className="flex items-end gap-2 h-20">
                  {[...recentScores].reverse().map((s, i) => {
                    const h = (s.score / 100) * 80;
                    const color = s.score >= 80 ? 'bg-cyan-500' : s.score >= 60 ? 'bg-amber-500' : 'bg-red-500';
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full ${color} rounded-t-sm opacity-80 transition-all`} style={{ height: `${h}px` }} />
                        <span className="text-xs text-slate-600">{s.score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Health Conditions */}
          {conditions.length > 0 && (
            <div className="col-span-12 bg-[#0d1f3c]/40 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="w-5 h-5 text-rose-400" />
                <p className="text-white font-semibold">Health Conditions</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {conditions.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-white text-sm">{c.condition_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.severity === 'severe' ? 'bg-red-500/20 text-red-400' :
                      c.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>{c.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {latestScore?.recommendations && latestScore.recommendations.length > 0 && (
            <div className="col-span-12 bg-[#0d1f3c]/40 border border-white/5 rounded-2xl p-6">
              <p className="text-white font-semibold mb-4">AI Recommendations</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {latestScore.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                    <div className="w-6 h-6 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">{i + 1}</div>
                    <p className="text-slate-300 text-sm leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disease management */}
          {latestScore?.disease_management_tips && conditions.length > 0 && (
            <div className="col-span-12 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-5 h-5 text-cyan-400" />
                <p className="text-white font-semibold">Disease Management Tips</p>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{latestScore.disease_management_tips}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

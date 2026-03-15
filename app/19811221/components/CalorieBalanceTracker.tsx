"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/app/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, isAfter, parseISO, subMonths, subYears } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

type CalorieLog = {
  id: string;
  owner: string;
  date: string;
  calorie_target: number;
  calories_in: number;
  calories_out_extra: number;
  note: string | null;
};

type CalorieProfile = {
  id: string;
  owner: string;
  maintenance_calories: number;
  height_cm: number | null;
  age_years: number | null;
  sex: 'male' | 'female' | null;
  activity_level: ActivityLevel | null;
};

type WeightLog = {
  id: string;
  owner: string;
  weight: number;
  date: string;
};

type CaloriePreset = {
  id: string;
  owner: string;
  preset_type: 'meal' | 'exercise';
  label: string;
  estimated_calories: number;
  source_text: string | null;
  note: string | null;
  last_used_at: string;
};

type GeminiEstimate = {
  totalCalories: number;
  items: Array<{
    name: string;
    estimatedCalories: number;
    reason: string;
  }>;
  assumptions: string;
  confidence: number;
};

type EstimateMode = 'meal' | 'exercise';
type RangeValue = '1M' | '3M' | '6M' | '1Y' | 'ALL';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const RANGES: Array<{ label: string; value: RangeValue }> = [
  { label: '1H', value: '1M' },
  { label: '3H', value: '3M' },
  { label: '6H', value: '6M' },
  { label: '1É', value: '1Y' },
  { label: 'ALL', value: 'ALL' },
];

const ACTIVITY_LEVEL_OPTIONS: Array<{ value: ActivityLevel; label: string; multiplier: number }> = [
  { value: 'sedentary', label: 'Ülő életmód', multiplier: 1.2 },
  { value: 'light', label: 'Könnyen aktív', multiplier: 1.375 },
  { value: 'moderate', label: 'Közepesen aktív', multiplier: 1.55 },
  { value: 'active', label: 'Aktív', multiplier: 1.725 },
  { value: 'very_active', label: 'Nagyon aktív', multiplier: 1.9 },
];

function getBalance(log: Pick<CalorieLog, 'calorie_target' | 'calories_in' | 'calories_out_extra'>) {
  return log.calories_in - log.calories_out_extra - log.calorie_target;
}

function getStatus(balance: number) {
  if (balance <= -150) {
    return {
      label: 'Deficitben',
      tone: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20',
      icon: TrendingDown,
    };
  }

  if (balance >= 150) {
    return {
      label: 'Többletben',
      tone: 'text-rose-200 bg-rose-500/15 border-rose-500/20',
      icon: TrendingUp,
    };
  }

  return {
    label: 'Nagyjából szinten',
    tone: 'text-amber-200 bg-amber-500/15 border-amber-500/20',
    icon: Target,
  };
}

function formatBalance(balance: number) {
  return `${balance > 0 ? '+' : ''}${balance} kcal`;
}

function getActivityMultiplier(activityLevel?: ActivityLevel | null) {
  return ACTIVITY_LEVEL_OPTIONS.find((item) => item.value === activityLevel)?.multiplier ?? null;
}

function calculateMaintenance(weightKg: number | null, profile: CalorieProfile | null) {
  if (!profile || !weightKg || !profile.height_cm || !profile.age_years || !profile.sex || !profile.activity_level) {
    return profile?.maintenance_calories ?? 0;
  }

  const bmr =
    profile.sex === 'male'
      ? 10 * weightKg + 6.25 * profile.height_cm - 5 * profile.age_years + 5
      : 10 * weightKg + 6.25 * profile.height_cm - 5 * profile.age_years - 161;

  const multiplier = getActivityMultiplier(profile.activity_level) ?? 1.2;
  return Math.round(bmr * multiplier);
}

function buildPresetLabel(text: string) {
  return text.trim().replace(/\s+/g, ' ').slice(0, 80);
}

async function upsertPreset(owner: string, presetType: EstimateMode, sourceText: string, calories: number, note?: string) {
  const label = buildPresetLabel(sourceText);
  if (!label || !calories) {
    return;
  }

  await supabase.from('calorie_presets').upsert(
    {
      owner,
      preset_type: presetType,
      label,
      estimated_calories: calories,
      source_text: sourceText,
      note: note || null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'owner,preset_type,label' }
  );
}

export default function CalorieBalanceTracker({ owner }: { owner: string }) {
  const [logs, setLogs] = useState<CalorieLog[]>([]);
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [mealPresets, setMealPresets] = useState<CaloriePreset[]>([]);
  const [exercisePresets, setExercisePresets] = useState<CaloriePreset[]>([]);

  const [heightCm, setHeightCm] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [fallbackMaintenance, setFallbackMaintenance] = useState('');

  const [caloriesIn, setCaloriesIn] = useState('');
  const [caloriesOutExtra, setCaloriesOutExtra] = useState('0');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [range, setRange] = useState<RangeValue>('3M');

  const [quickMealText, setQuickMealText] = useState('');
  const [quickExerciseText, setQuickExerciseText] = useState('');
  const [mealEstimate, setMealEstimate] = useState<GeminiEstimate | null>(null);
  const [exerciseEstimate, setExerciseEstimate] = useState<GeminiEstimate | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [estimatingMeal, setEstimatingMeal] = useState(false);
  const [estimatingExercise, setEstimatingExercise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealEstimateError, setMealEstimateError] = useState<string | null>(null);
  const [exerciseEstimateError, setExerciseEstimateError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [logsResult, profileResult, weightResult, presetsResult] = await Promise.all([
      supabase.from('calorie_logs').select('*').eq('owner', owner).order('date', { ascending: true }),
      supabase.from('calorie_profiles').select('*').eq('owner', owner).maybeSingle(),
      supabase.from('weight_logs').select('*').eq('owner', owner).order('date', { ascending: false }).limit(1),
      supabase.from('calorie_presets').select('*').eq('owner', owner).order('last_used_at', { ascending: false }).limit(12),
    ]);

    if (logsResult.data) {
      setLogs(logsResult.data as CalorieLog[]);
    }

    if (profileResult.data) {
      const typedProfile = profileResult.data as CalorieProfile;
      setProfile(typedProfile);
      setHeightCm(typedProfile.height_cm ? String(typedProfile.height_cm) : '');
      setAgeYears(typedProfile.age_years ? String(typedProfile.age_years) : '');
      setSex(typedProfile.sex ?? 'male');
      setActivityLevel(typedProfile.activity_level ?? 'light');
      setFallbackMaintenance(typedProfile.maintenance_calories ? String(typedProfile.maintenance_calories) : '');
    } else {
      setProfile(null);
      setHeightCm('');
      setAgeYears('');
      setSex('male');
      setActivityLevel('light');
      setFallbackMaintenance('');
    }

    const weightLog = (weightResult.data?.[0] as WeightLog | undefined) ?? null;
    setLatestWeight(weightLog?.weight ?? null);

    const presets = (presetsResult.data ?? []) as CaloriePreset[];
    setMealPresets(presets.filter((preset) => preset.preset_type === 'meal'));
    setExercisePresets(presets.filter((preset) => preset.preset_type === 'exercise'));

    setLoading(false);
  }, [owner]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(initTimer);
  }, [fetchData]);

  const effectiveMaintenance = useMemo(() => calculateMaintenance(latestWeight, profile), [latestWeight, profile]);
  const isCalculatedMaintenance = Boolean(
    latestWeight && profile?.height_cm && profile?.age_years && profile?.sex && profile?.activity_level
  );

  const filteredData = useMemo(() => {
    if (range === 'ALL') return logs;

    const now = new Date();
    let cutOffDate = new Date();
    if (range === '1M') cutOffDate = subMonths(now, 1);
    if (range === '3M') cutOffDate = subMonths(now, 3);
    if (range === '6M') cutOffDate = subMonths(now, 6);
    if (range === '1Y') cutOffDate = subYears(now, 1);

    return logs.filter((log) => isAfter(parseISO(log.date), cutOffDate));
  }, [logs, range]);

  const chartData = useMemo(
    () =>
      filteredData.map((log) => ({
        ...log,
        balance: getBalance(log),
      })),
    [filteredData]
  );

  const latestLog = useMemo(() => {
    if (logs.length === 0) return null;
    return logs[logs.length - 1];
  }, [logs]);

  const latestBalance = latestLog ? getBalance(latestLog) : null;
  const status = latestBalance !== null ? getStatus(latestBalance) : null;

  const averages = useMemo(() => {
    if (filteredData.length === 0) {
      return null;
    }

    const totals = filteredData.reduce(
      (acc, log) => {
        acc.target += log.calorie_target;
        acc.in += log.calories_in;
        acc.out += log.calories_out_extra;
        acc.balance += getBalance(log);
        return acc;
      },
      { target: 0, in: 0, out: 0, balance: 0 }
    );

    const days = filteredData.length;
    return {
      target: Math.round(totals.target / days),
      in: Math.round(totals.in / days),
      out: Math.round(totals.out / days),
      balance: Math.round(totals.balance / days),
    };
  }, [filteredData]);

  const saveProfile = async () => {
    if (!fallbackMaintenance && (!heightCm || !ageYears)) {
      setError('Adj meg legalább egy tartalék alap kcal értéket, vagy töltsd ki a profilt.');
      return;
    }

    setSavingProfile(true);
    setError(null);

    const { data, error: profileError } = await supabase
      .from('calorie_profiles')
      .upsert(
        {
          owner,
          maintenance_calories: parseInt(fallbackMaintenance || '0', 10),
          height_cm: heightCm ? parseInt(heightCm, 10) : null,
          age_years: ageYears ? parseInt(ageYears, 10) : null,
          sex,
          activity_level: activityLevel,
        },
        { onConflict: 'owner' }
      )
      .select('*')
      .single();

    setSavingProfile(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    setProfile(data as CalorieProfile);
  };

  const estimateWithGemini = async (mode: EstimateMode) => {
    const sourceText = mode === 'meal' ? quickMealText.trim() : quickExerciseText.trim();
    if (!sourceText) {
      if (mode === 'meal') {
        setMealEstimateError('Írj be egy rövid étkezésleírást.');
      } else {
        setExerciseEstimateError('Írj be egy rövid mozgásleírást.');
      }
      return;
    }

    if (mode === 'meal') {
      setEstimatingMeal(true);
      setMealEstimateError(null);
    } else {
      setEstimatingExercise(true);
      setExerciseEstimateError(null);
    }

    try {
      const response = await fetch('/api/calorie/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          mode,
          text: sourceText,
          profile: {
            heightCm: profile?.height_cm ?? null,
            ageYears: profile?.age_years ?? null,
            sex: profile?.sex ?? null,
            activityLevel: profile?.activity_level ?? null,
            latestWeightKg: latestWeight,
            effectiveMaintenance,
          },
        }),
      });

      const payload = (await response.json()) as { estimate?: GeminiEstimate; error?: string };
      if (!response.ok || !payload.estimate) {
        throw new Error(payload.error || 'Nem sikerült Gemini becslést kérni.');
      }

      const nextEstimate = payload.estimate;
      if (mode === 'meal') {
        setMealEstimate(nextEstimate);
        setCaloriesIn(String(nextEstimate.totalCalories));
        setNote((current) => current || nextEstimate.assumptions || 'Gemini becslés alapján előtöltve.');
      } else {
        setExerciseEstimate(nextEstimate);
        setCaloriesOutExtra(String(nextEstimate.totalCalories));
        setNote((current) => current || nextEstimate.assumptions || 'Gemini becslés alapján előtöltve.');
      }
    } catch (estimateFailure) {
      const message =
        estimateFailure instanceof Error ? estimateFailure.message : 'Ismeretlen hiba történt a becslés közben.';
      if (mode === 'meal') {
        setMealEstimateError(message);
      } else {
        setExerciseEstimateError(message);
      }
    } finally {
      if (mode === 'meal') {
        setEstimatingMeal(false);
      } else {
        setEstimatingExercise(false);
      }
    }
  };

  const applyPreset = (preset: CaloriePreset) => {
    if (preset.preset_type === 'meal') {
      setQuickMealText(preset.source_text || preset.label);
      setCaloriesIn(String(preset.estimated_calories));
    } else {
      setQuickExerciseText(preset.source_text || preset.label);
      setCaloriesOutExtra(String(preset.estimated_calories));
    }

    setNote((current) => current || preset.note || `Korábbi sablon: ${preset.label}`);
  };

  const handleSaveLog = async () => {
    const normalizedCaloriesIn = parseInt(caloriesIn || '0', 10);
    const normalizedCaloriesOutExtra = parseInt(caloriesOutExtra || '0', 10);

    if (!effectiveMaintenance || !date || (normalizedCaloriesIn <= 0 && normalizedCaloriesOutExtra <= 0)) {
      setError('A mentéshez kell számolt vagy tartalék alap kalória, dátum, és legalább étkezés vagy mozgás adat.');
      return;
    }

    setError(null);

    await supabase.from('calorie_logs').upsert(
      {
        owner,
        date,
        calorie_target: effectiveMaintenance,
        calories_in: normalizedCaloriesIn,
        calories_out_extra: normalizedCaloriesOutExtra,
        note: note.trim() || null,
      },
      { onConflict: 'owner,date' }
    );

    if (quickMealText.trim() && normalizedCaloriesIn > 0) {
      await upsertPreset(owner, 'meal', quickMealText, normalizedCaloriesIn, note.trim() || undefined);
    }

    if (quickExerciseText.trim() && normalizedCaloriesOutExtra > 0) {
      await upsertPreset(owner, 'exercise', quickExerciseText, normalizedCaloriesOutExtra, note.trim() || undefined);
    }

    setCaloriesIn('');
    setCaloriesOutExtra('0');
    setNote('');
    setQuickMealText('');
    setQuickExerciseText('');
    setMealEstimate(null);
    setExerciseEstimate(null);
    await fetchData();
  };

  if (loading) return null;

  return (
    <div className="space-y-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-[#0a0c10] p-4 transition-colors group hover:bg-white/5"
      >
        <div className="flex items-center gap-4">
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
            {isOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
          </div>
          <h2 className="text-xl font-black italic uppercase tracking-wider text-white">KALÓRIA MÉRLEG</h2>
        </div>

        {status ? (
          <div className={`hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-widest sm:flex ${status.tone}`}>
            <status.icon size={14} />
            {status.label}
          </div>
        ) : (
          <Flame size={20} className="text-white/30" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="mx-1 -mt-2 overflow-hidden rounded-b-2xl border-x border-b border-white/5 bg-[#0a0c10]/50 px-4 pb-6 pt-4"
          >
            <div className="space-y-6">
              {error && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}

              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Személyes alapadatok</div>
                    <div className="mt-1 text-sm text-white/60">
                      A napi kalóriaigény a legutóbbi súlybejegyzésedből és ezekből az adatokból számolódik.
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <input type="number" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="Magasság cm" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-bold text-white outline-none placeholder:text-white/20" />
                    <input type="number" value={ageYears} onChange={(event) => setAgeYears(event.target.value)} placeholder="Életkor" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-bold text-white outline-none placeholder:text-white/20" />
                    <select value={sex} onChange={(event) => setSex(event.target.value as 'male' | 'female')} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-bold text-white outline-none">
                      <option value="male">Férfi</option>
                      <option value="female">Nő</option>
                    </select>
                    <select value={activityLevel} onChange={(event) => setActivityLevel(event.target.value as ActivityLevel)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-bold text-white outline-none">
                      {ACTIVITY_LEVEL_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                    <input type="number" value={fallbackMaintenance} onChange={(event) => setFallbackMaintenance(event.target.value)} placeholder="Tartalék alap kcal" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-bold text-white outline-none placeholder:text-white/20" />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-white/70">
                      <div>Legutóbbi súly: <span className="font-black text-white">{latestWeight ? `${latestWeight} kg` : 'nincs adat'}</span></div>
                      <div className="mt-1">Napi alap most: <span className="font-black text-emerald-300">{effectiveMaintenance || 0} kcal</span></div>
                      <div className="mt-1 text-xs text-white/45">
                        {isCalculatedMaintenance ? 'A számolás a legutóbbi súlybejegyzésből történik.' : 'Még nincs elég profil- vagy súlyadat, ezért a tartalék alap kcal értéket használjuk.'}
                      </div>
                    </div>

                    <button onClick={saveProfile} disabled={savingProfile} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-black uppercase tracking-widest text-black transition-colors hover:bg-emerald-400 disabled:opacity-50">
                      {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Profil mentése
                    </button>
                  </div>
                </div>
              </div>

              {latestLog && status ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Napi alap</div><div className="mt-2 text-2xl font-black text-white">{latestLog.calorie_target}</div><div className="text-xs text-white/40">kcal</div></div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Bevitt</div><div className="mt-2 text-2xl font-black text-white">{latestLog.calories_in}</div><div className="text-xs text-white/40">kcal</div></div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Extra mozgás</div><div className="mt-2 text-2xl font-black text-white">{latestLog.calories_out_extra}</div><div className="text-xs text-white/40">kcal</div></div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4"><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Egyenleg</div><div className={`mt-2 text-2xl font-black ${latestBalance !== null && latestBalance <= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>{latestBalance !== null ? formatBalance(latestBalance) : '—'}</div><div className={`mt-1 inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${status.tone}`}><status.icon size={12} />{status.label}</div></div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm italic text-white/40">Még nincs kalórianapló bejegyzés. Állíts be profilt, és rögzíts egy napot a pontosabb követéshez.</div>
              )}

              <div className="h-64 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs><linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff40" tick={{ fontSize: 10 }} tickFormatter={(value) => format(parseISO(value), 'MMM d', { locale: hu })} />
                      <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} unit=" kcal" width={52} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f1115', borderColor: '#ffffff20', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} labelFormatter={(label) => format(parseISO(String(label)), 'yyyy. MMM d.', { locale: hu })} formatter={(value) => [formatBalance(Number(value ?? 0)), 'Egyenleg']} />
                      <Area type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm italic text-white/30">Még nincs elég adat a diagramhoz.</div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-center gap-1.5">{RANGES.map((item) => (<button key={item.value} onClick={() => setRange(item.value)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black tracking-widest transition-all ${range === item.value ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{item.label}</button>))}</div>

                {averages && (
                  <div className="grid gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 sm:grid-cols-4">
                    <div><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag alap</div><div className="mt-1 text-sm font-bold text-white">{averages.target} kcal</div></div>
                    <div><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag bevitt</div><div className="mt-1 text-sm font-bold text-white">{averages.in} kcal</div></div>
                    <div><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag mozgás</div><div className="mt-1 text-sm font-bold text-white">{averages.out} kcal</div></div>
                    <div><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag egyenleg</div><div className={`mt-1 text-sm font-bold ${averages.balance <= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>{formatBalance(averages.balance)}</div></div>
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Gemini gyors étkezés</div>
                  <textarea rows={3} value={quickMealText} onChange={(event) => setQuickMealText(event.target.value)} placeholder="Példa: ettem 3 tojást, két szelet kenyeret és egy protein shake-et" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20" />
                  <div className="flex flex-wrap gap-2">{mealPresets.map((preset) => (<button key={preset.id} onClick={() => applyPreset(preset)} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/80 hover:bg-white/10">{preset.label}</button>))}</div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => void estimateWithGemini('meal')} disabled={estimatingMeal || !quickMealText.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10 disabled:opacity-50">{estimatingMeal ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Gemini becslés</button>
                    {mealEstimate && (<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">Becsült összesen: <span className="font-black">{mealEstimate.totalCalories} kcal</span></div>)}
                  </div>
                  {mealEstimateError && <div className="text-sm text-rose-200">{mealEstimateError}</div>}
                </div>

                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Gemini gyors mozgás</div>
                  <textarea rows={3} value={quickExerciseText} onChange={(event) => setQuickExerciseText(event.target.value)} placeholder="Példa: 45 perc gyors séta dombos terepen, vagy 50 perc közepes intenzitású súlyzós edzés" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20" />
                  <div className="flex flex-wrap gap-2">{exercisePresets.map((preset) => (<button key={preset.id} onClick={() => applyPreset(preset)} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/80 hover:bg-white/10">{preset.label}</button>))}</div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => void estimateWithGemini('exercise')} disabled={estimatingExercise || !quickExerciseText.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10 disabled:opacity-50">{estimatingExercise ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Gemini mozgásbecslés</button>
                    {exerciseEstimate && (<div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">Becsült extra égetés: <span className="font-black">{exerciseEstimate.totalCalories} kcal</span></div>)}
                  </div>
                  {exerciseEstimateError && <div className="text-sm text-rose-200">{exerciseEstimateError}</div>}
                </div>

                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
                    <input type="number" placeholder="Bevitt kcal" value={caloriesIn} onChange={(event) => setCaloriesIn(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 font-bold text-white outline-none placeholder:text-white/20" />
                    <input type="number" placeholder="Extra mozgás" value={caloriesOutExtra} onChange={(event) => setCaloriesOutExtra(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 font-bold text-white outline-none placeholder:text-white/20" />
                    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold uppercase tracking-wide text-white/80 outline-none" />
                  </div>
                  <div className="flex gap-2 rounded-2xl border border-white/5 bg-black/20 p-1.5">
                    <input type="text" placeholder="Megjegyzés opcionálisan, pl. étterem, futás, lábnap" value={note} onChange={(event) => setNote(event.target.value)} className="flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/20" />
                    <button onClick={handleSaveLog} disabled={!effectiveMaintenance || (parseInt(caloriesIn || '0', 10) <= 0 && parseInt(caloriesOutExtra || '0', 10) <= 0)} className="flex w-12 items-center justify-center rounded-xl bg-emerald-500 text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"><Plus size={20} /></button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

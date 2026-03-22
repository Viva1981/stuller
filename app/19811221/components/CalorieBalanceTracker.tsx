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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

type CalorieEntry = {
  id: string;
  owner: string;
  entry_date: string;
  entry_type: 'meal' | 'exercise';
  label: string | null;
  calories: number;
  maintenance_calories: number;
  note: string | null;
  source_type: 'manual' | 'ai' | 'preset';
  source_text: string | null;
  created_at: string;
  updated_at: string;
};

type DailyCalorieLog = {
  date: string;
  calorie_target: number;
  calories_in: number;
  calories_out_extra: number;
  balance: number;
  entries: CalorieEntry[];
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
type EntrySourceType = 'manual' | 'ai' | 'preset';
type StoredMetaPayload = {
  text?: string;
  time?: string;
  favorite?: boolean;
};

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
const META_PREFIX = '__stuller_meta__:';

function getBalance(log: Pick<DailyCalorieLog, 'calorie_target' | 'calories_in' | 'calories_out_extra'>) {
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

function getCurrentLocalTime() {
  return new Intl.DateTimeFormat('hu-HU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Budapest',
  }).format(new Date());
}

function parseStoredMeta(note: string | null) {
  if (!note) {
    return { text: '', time: null, favorite: false };
  }

  if (!note.startsWith(META_PREFIX)) {
    return { text: note, time: null, favorite: false };
  }

  try {
    const payload = JSON.parse(note.slice(META_PREFIX.length)) as StoredMetaPayload;
    return {
      text: typeof payload.text === 'string' ? payload.text : '',
      time: typeof payload.time === 'string' ? payload.time : null,
      favorite: Boolean(payload.favorite),
    };
  } catch {
    return { text: note, time: null, favorite: false };
  }
}

function buildStoredMetaNote(meta: StoredMetaPayload) {
  if (!meta.text && !meta.time && !meta.favorite) {
    return null;
  }

  return `${META_PREFIX}${JSON.stringify({
    ...(meta.text ? { text: meta.text } : {}),
    ...(meta.time ? { time: meta.time } : {}),
    ...(meta.favorite ? { favorite: true } : {}),
  })}`;
}

function getPresetFavorite(preset: CaloriePreset) {
  return parseStoredMeta(preset.note).favorite;
}

function getPresetNoteText(preset: CaloriePreset) {
  return parseStoredMeta(preset.note).text;
}

function getEntryNoteText(entry: CalorieEntry) {
  return parseStoredMeta(entry.note).text;
}

function getEntryTime(entry: CalorieEntry) {
  const storedTime = parseStoredMeta(entry.note).time;
  if (storedTime) {
    return storedTime;
  }

  return format(parseISO(entry.created_at), 'HH:mm');
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
  return text.trim().replace(/\s+/g, ' ');
}

function buildEntryLabel(sourceText: string, fallback: string) {
  const label = buildPresetLabel(sourceText);
  return label || fallback;
}

function aggregateEntries(entries: CalorieEntry[], effectiveMaintenance: number, todayDate: string) {
  const grouped = new Map<string, DailyCalorieLog>();

  for (const entry of entries) {
    const existing =
      grouped.get(entry.entry_date) ??
      ({
        date: entry.entry_date,
        calorie_target: entry.entry_date === todayDate && effectiveMaintenance > 0 ? effectiveMaintenance : entry.maintenance_calories,
        calories_in: 0,
        calories_out_extra: 0,
        balance: 0,
        entries: [],
      } satisfies DailyCalorieLog);

    existing.calorie_target =
      entry.entry_date === todayDate && effectiveMaintenance > 0 ? effectiveMaintenance : entry.maintenance_calories;
    existing.entries.push(entry);

    if (entry.entry_type === 'meal') {
      existing.calories_in += entry.calories;
    } else {
      existing.calories_out_extra += entry.calories;
    }

    existing.balance = getBalance(existing);
    grouped.set(entry.entry_date, existing);
  }

  return [...grouped.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function shiftDateByDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().split('T')[0];
}

export default function CalorieBalanceTracker({ owner }: { owner: string }) {
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [profile, setProfile] = useState<CalorieProfile | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [mealPresets, setMealPresets] = useState<CaloriePreset[]>([]);
  const [exercisePresets, setExercisePresets] = useState<CaloriePreset[]>([]);

  const [heightCm, setHeightCm] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');

  const [caloriesIn, setCaloriesIn] = useState('');
  const [caloriesOutExtra, setCaloriesOutExtra] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTime, setEntryTime] = useState(getCurrentLocalTime());
  const [range, setRange] = useState<RangeValue>('3M');

  const [quickMealText, setQuickMealText] = useState('');
  const [quickExerciseText, setQuickExerciseText] = useState('');
  const [mealEstimate, setMealEstimate] = useState<GeminiEstimate | null>(null);
  const [exerciseEstimate, setExerciseEstimate] = useState<GeminiEstimate | null>(null);
  const [mealSourceType, setMealSourceType] = useState<EntrySourceType>('manual');
  const [exerciseSourceType, setExerciseSourceType] = useState<EntrySourceType>('manual');

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEntries, setSavingEntries] = useState(false);
  const [estimatingMeal, setEstimatingMeal] = useState(false);
  const [estimatingExercise, setEstimatingExercise] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealEstimateError, setMealEstimateError] = useState<string | null>(null);
  const [exerciseEstimateError, setExerciseEstimateError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMealOpen, setIsMealOpen] = useState(false);
  const [isExerciseOpen, setIsExerciseOpen] = useState(false);
  const [isFavoriteMealsOpen, setIsFavoriteMealsOpen] = useState(false);
  const [isFavoriteExercisesOpen, setIsFavoriteExercisesOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [entriesResult, profileResult, weightResult, presetsResult] = await Promise.all([
      supabase
        .from('calorie_entries')
        .select('*')
        .eq('owner', owner)
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('calorie_profiles').select('*').eq('owner', owner).maybeSingle(),
      supabase.from('weight_logs').select('*').eq('owner', owner).order('date', { ascending: false }).limit(1),
      supabase.from('calorie_presets').select('*').eq('owner', owner).order('last_used_at', { ascending: false }).limit(12),
    ]);

    if (entriesResult.data) {
      setEntries(entriesResult.data as CalorieEntry[]);
    }

    if (profileResult.data) {
      const typedProfile = profileResult.data as CalorieProfile;
      setProfile(typedProfile);
      setHeightCm(typedProfile.height_cm ? String(typedProfile.height_cm) : '');
      setAgeYears(typedProfile.age_years ? String(typedProfile.age_years) : '');
      setSex(typedProfile.sex ?? 'male');
      setActivityLevel(typedProfile.activity_level ?? 'light');
    } else {
      setProfile(null);
      setHeightCm('');
      setAgeYears('');
      setSex('male');
      setActivityLevel('light');
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

  const dailyLogs = useMemo(
    () => aggregateEntries(entries, effectiveMaintenance, todayDate),
    [entries, effectiveMaintenance, todayDate]
  );

  const filteredData = useMemo(() => {
    if (range === 'ALL') return dailyLogs;

    const now = new Date();
    let cutOffDate = new Date();
    if (range === '1M') cutOffDate = subMonths(now, 1);
    if (range === '3M') cutOffDate = subMonths(now, 3);
    if (range === '6M') cutOffDate = subMonths(now, 6);
    if (range === '1Y') cutOffDate = subYears(now, 1);

    return dailyLogs.filter((log) => isAfter(parseISO(log.date), cutOffDate));
  }, [dailyLogs, range]);

  const chartData = useMemo(
    () =>
      filteredData.map((log) => ({
        ...log,
        balance: getBalance(log),
      })),
    [filteredData]
  );

  const latestLog = useMemo(() => {
    if (dailyLogs.length === 0) return null;
    return dailyLogs[dailyLogs.length - 1];
  }, [dailyLogs]);

  const selectedDateEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.entry_date === date)
        .sort((left, right) => {
          const timeDiff = getEntryTime(left).localeCompare(getEntryTime(right));
          if (timeDiff !== 0) {
            return timeDiff;
          }
          return left.created_at.localeCompare(right.created_at);
        }),
    [date, entries]
  );

  const selectedDateLog = useMemo(() => {
    const existing = dailyLogs.find((log) => log.date === date);
    if (existing) {
      return existing;
    }

    return {
      date,
      calorie_target: date === todayDate ? effectiveMaintenance : 0,
      calories_in: 0,
      calories_out_extra: 0,
      balance: (0 - 0) - (date === todayDate ? effectiveMaintenance : 0),
      entries: [],
    } satisfies DailyCalorieLog;
  }, [dailyLogs, date, effectiveMaintenance, todayDate]);

  const latestBalance = latestLog ? getBalance(latestLog) : null;
  const status = latestBalance !== null ? getStatus(latestBalance) : null;
  const selectedDateBalance = selectedDateLog ? getBalance(selectedDateLog) : 0;
  const selectedDateStatus = getStatus(selectedDateBalance);
  const sortedMealPresets = useMemo(() => {
    return [...mealPresets].sort((left, right) => {
      const leftFavorite = getPresetFavorite(left) ? 1 : 0;
      const rightFavorite = getPresetFavorite(right) ? 1 : 0;
      if (leftFavorite !== rightFavorite) {
        return rightFavorite - leftFavorite;
      }
      return right.last_used_at.localeCompare(left.last_used_at);
    });
  }, [mealPresets]);
  const sortedExercisePresets = useMemo(() => {
    return [...exercisePresets].sort((left, right) => {
      const leftFavorite = getPresetFavorite(left) ? 1 : 0;
      const rightFavorite = getPresetFavorite(right) ? 1 : 0;
      if (leftFavorite !== rightFavorite) {
        return rightFavorite - leftFavorite;
      }
      return right.last_used_at.localeCompare(left.last_used_at);
    });
  }, [exercisePresets]);
  const favoriteMealPresets = useMemo(
    () => sortedMealPresets.filter((preset) => getPresetFavorite(preset)),
    [sortedMealPresets]
  );
  const regularMealPresets = useMemo(
    () => sortedMealPresets.filter((preset) => !getPresetFavorite(preset)),
    [sortedMealPresets]
  );
  const favoriteExercisePresets = useMemo(
    () => sortedExercisePresets.filter((preset) => getPresetFavorite(preset)),
    [sortedExercisePresets]
  );
  const regularExercisePresets = useMemo(
    () => sortedExercisePresets.filter((preset) => !getPresetFavorite(preset)),
    [sortedExercisePresets]
  );
  const todayLog = useMemo(() => {
    return dailyLogs.find((log) => log.date === todayDate) ?? {
      date: todayDate,
      calorie_target: effectiveMaintenance,
      calories_in: 0,
      calories_out_extra: 0,
      balance: 0 - effectiveMaintenance,
      entries: [],
    };
  }, [dailyLogs, effectiveMaintenance, todayDate]);
  const todayBalance = getBalance(todayLog);
  const todayStatus = getStatus(todayBalance);
  const remainingToday = Math.max(0, -todayBalance);

  const upsertPreset = useCallback(
    async (presetType: EstimateMode, sourceText: string, calories: number, nextNote?: string) => {
      const label = buildPresetLabel(sourceText);
      if (!label || !calories) {
        return;
      }

      const currentPresets = presetType === 'meal' ? mealPresets : exercisePresets;
      const existingPreset = currentPresets.find((preset) => preset.label === label);
      const favorite = existingPreset ? getPresetFavorite(existingPreset) : false;

      await supabase.from('calorie_presets').upsert(
        {
          owner,
          preset_type: presetType,
          label,
          estimated_calories: calories,
          source_text: sourceText,
          note: buildStoredMetaNote({
            text: nextNote?.trim() || '',
            favorite,
          }),
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'owner,preset_type,label' }
      );
    },
    [exercisePresets, mealPresets, owner]
  );

  const saveProfile = async () => {
    if (!heightCm || !ageYears || !sex || !activityLevel) {
      setError('A számoláshoz add meg a magasságot, életkort, nemet és életmódot.');
      return;
    }

    setSavingProfile(true);
    setError(null);

    const draftProfile: CalorieProfile | null = {
      id: profile?.id ?? 'draft',
      owner,
      maintenance_calories: profile?.maintenance_calories ?? 0,
      height_cm: heightCm ? parseInt(heightCm, 10) : null,
      age_years: ageYears ? parseInt(ageYears, 10) : null,
      sex,
      activity_level: activityLevel,
    };
    const calculatedMaintenance = calculateMaintenance(latestWeight, draftProfile);

    const profilePayload = {
      owner,
      maintenance_calories: calculatedMaintenance,
      height_cm: heightCm ? parseInt(heightCm, 10) : null,
      age_years: ageYears ? parseInt(ageYears, 10) : null,
      sex,
      activity_level: activityLevel,
    };

    const { data, error: profileError } = await supabase
      .from('calorie_profiles')
      .upsert(profilePayload, { onConflict: 'owner' })
      .select('*')
      .single();

    setSavingProfile(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    const nextProfile = data as CalorieProfile;
    const nextMaintenance = calculateMaintenance(latestWeight, nextProfile);

    setProfile(nextProfile);

    if (nextMaintenance > 0) {
      await supabase
        .from('calorie_entries')
        .update({ maintenance_calories: nextMaintenance })
        .eq('owner', owner)
        .eq('entry_date', todayDate);
    }

    await fetchData();
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
        setMealSourceType('ai');
        setCaloriesIn(String(nextEstimate.totalCalories));
        setNote((current) => current || nextEstimate.assumptions || 'Gemini becslés alapján előtöltve.');
      } else {
        setExerciseEstimate(nextEstimate);
        setExerciseSourceType('ai');
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
    const presetNote = getPresetNoteText(preset);
    if (preset.preset_type === 'meal') {
      setMealSourceType('preset');
      setQuickMealText(preset.source_text || preset.label);
      setCaloriesIn(String(preset.estimated_calories));
    } else {
      setExerciseSourceType('preset');
      setQuickExerciseText(preset.source_text || preset.label);
      setCaloriesOutExtra(String(preset.estimated_calories));
    }

    setNote((current) => current || presetNote || `Korábbi sablon: ${preset.label}`);
  };

  const toggleFavoritePreset = async (preset: CaloriePreset) => {
    const parsed = parseStoredMeta(preset.note);
    const { error: presetError } = await supabase
      .from('calorie_presets')
      .update({
        note: buildStoredMetaNote({
          text: parsed.text,
          favorite: !parsed.favorite,
        }),
      })
      .eq('id', preset.id);

    if (presetError) {
      setError(presetError.message);
      return;
    }

    await fetchData();
  };

  const resetEntryForm = () => {
    setCaloriesIn('');
    setCaloriesOutExtra('');
    setNote('');
    setEntryTime(getCurrentLocalTime());
    setQuickMealText('');
    setQuickExerciseText('');
    setMealEstimate(null);
    setExerciseEstimate(null);
    setMealSourceType('manual');
    setExerciseSourceType('manual');
    setEditingEntryId(null);
  };

  const startEditingEntry = (entry: CalorieEntry) => {
    const parsedNote = parseStoredMeta(entry.note);
    setEditingEntryId(entry.id);
    setDate(entry.entry_date);
    setEntryTime(parsedNote.time ?? getEntryTime(entry));
    setNote(parsedNote.text);
    setError(null);

    if (entry.entry_type === 'meal') {
      setCaloriesIn(String(entry.calories));
      setCaloriesOutExtra('');
      setQuickMealText(entry.source_text ?? entry.label ?? '');
      setQuickExerciseText('');
      setMealEstimate(null);
      setExerciseEstimate(null);
      setMealSourceType(entry.source_type);
      setExerciseSourceType('manual');
    } else {
      setCaloriesIn('');
      setCaloriesOutExtra(String(entry.calories));
      setQuickMealText('');
      setQuickExerciseText(entry.source_text ?? entry.label ?? '');
      setMealEstimate(null);
      setExerciseEstimate(null);
      setMealSourceType('manual');
      setExerciseSourceType(entry.source_type);
    }
  };

  const deleteEntry = async (entryId: string) => {
    setDeletingEntryId(entryId);
    setError(null);

    const { error: deleteError } = await supabase.from('calorie_entries').delete().eq('id', entryId);
    setDeletingEntryId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingEntryId === entryId) {
      resetEntryForm();
    }

    await fetchData();
  };

  const handleSaveLog = async () => {
    const normalizedCaloriesIn = parseInt(caloriesIn || '0', 10);
    const normalizedCaloriesOutExtra = parseInt(caloriesOutExtra || '0', 10);

    if (!effectiveMaintenance || !date || (normalizedCaloriesIn <= 0 && normalizedCaloriesOutExtra <= 0)) {
      setError('A mentéshez kell számolt napi alap, dátum, és legalább étkezés vagy mozgás adat.');
      return;
    }

    setSavingEntries(true);
    setError(null);

    if (editingEntryId) {
      const payload =
        normalizedCaloriesIn > 0
          ? {
              entry_date: date,
              entry_type: 'meal' as const,
              label: buildEntryLabel(quickMealText, 'Kézi étkezés'),
              calories: normalizedCaloriesIn,
              maintenance_calories: effectiveMaintenance,
              note: buildStoredMetaNote({
                text: note.trim(),
                time: entryTime,
              }),
              source_type: mealSourceType,
              source_text: quickMealText.trim() || null,
            }
          : {
              entry_date: date,
              entry_type: 'exercise' as const,
              label: buildEntryLabel(quickExerciseText, 'Kézi mozgás'),
              calories: normalizedCaloriesOutExtra,
              maintenance_calories: effectiveMaintenance,
              note: buildStoredMetaNote({
                text: note.trim(),
                time: entryTime,
              }),
              source_type: exerciseSourceType,
              source_text: quickExerciseText.trim() || null,
            };

      const { error: updateError } = await supabase.from('calorie_entries').update(payload).eq('id', editingEntryId);
      setSavingEntries(false);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const inserts: Array<Omit<CalorieEntry, 'id' | 'created_at' | 'updated_at'>> = [];

      if (normalizedCaloriesIn > 0) {
        inserts.push({
          owner,
          entry_date: date,
          entry_type: 'meal',
          label: buildEntryLabel(quickMealText, 'Kézi étkezés'),
          calories: normalizedCaloriesIn,
          maintenance_calories: effectiveMaintenance,
          note: buildStoredMetaNote({
            text: note.trim(),
            time: entryTime,
          }),
          source_type: mealSourceType,
          source_text: quickMealText.trim() || null,
        });
      }

      if (normalizedCaloriesOutExtra > 0) {
        inserts.push({
          owner,
          entry_date: date,
          entry_type: 'exercise',
          label: buildEntryLabel(quickExerciseText, 'Kézi mozgás'),
          calories: normalizedCaloriesOutExtra,
          maintenance_calories: effectiveMaintenance,
          note: buildStoredMetaNote({
            text: note.trim(),
            time: entryTime,
          }),
          source_type: exerciseSourceType,
          source_text: quickExerciseText.trim() || null,
        });
      }

      const { error: insertError } = await supabase.from('calorie_entries').insert(inserts);
      setSavingEntries(false);

      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    if (quickMealText.trim() && normalizedCaloriesIn > 0) {
      await upsertPreset('meal', quickMealText, normalizedCaloriesIn, note.trim() || undefined);
    }

    if (quickExerciseText.trim() && normalizedCaloriesOutExtra > 0) {
      await upsertPreset('exercise', quickExerciseText, normalizedCaloriesOutExtra, note.trim() || undefined);
    }

    resetEntryForm();
    await fetchData();
  };

  if (loading) return null;

  return (
    <div className="space-y-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-[#0a0c10] p-4 transition-colors hover:bg-white/5"
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
                <button
                  onClick={() => setIsProfileOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Személyes alapadatok</div>
                    <div className="mt-1 text-sm text-white/60">
                      A napi kalóriaigény a legutóbbi súlybejegyzésedből és ezekből az adatokból számolódik.
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black tracking-widest text-emerald-300">
                      {effectiveMaintenance || 0} kcal
                    </div>
                    {isProfileOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 flex flex-col gap-4">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-white/70">
                            <div>Legutóbbi súly: <span className="font-black text-white">{latestWeight ? `${latestWeight} kg` : 'nincs adat'}</span></div>
                            <div className="mt-1">Napi alap most: <span className="font-black text-emerald-300">{effectiveMaintenance || 0} kcal</span></div>
                            <div className="mt-1 text-xs text-white/45">
                              {isCalculatedMaintenance ? 'A számolás a legutóbbi súlybejegyzésből történik.' : 'A pontos számoláshoz szükség van legalább egy súlybejegyzésre is a súlynaplóban.'}
                            </div>
                          </div>

                          <button onClick={saveProfile} disabled={savingProfile} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-black uppercase tracking-widest text-black transition-colors hover:bg-emerald-400 disabled:opacity-50">
                            {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Profil mentése
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-200/60">Mai fókusz</div>
                    <div className="mt-1 text-xl font-black text-white">
                      {todayBalance <= 0 ? 'Ma még ennyi fér bele' : 'Ma ennyivel lépted túl'}
                    </div>
                    <div className="mt-2 text-3xl font-black text-emerald-300">
                      {todayBalance <= 0 ? `${remainingToday} kcal` : `${todayBalance} kcal`}
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-2 self-start rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-widest ${todayStatus.tone}`}>
                    <todayStatus.icon size={14} />
                    {todayStatus.label}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-white/60 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">Napi alap: <span className="font-black text-white">{todayLog.calorie_target} kcal</span></div>
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">Bevitt: <span className="font-black text-white">{todayLog.calories_in} kcal</span></div>
                  <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">Mozgás: <span className="font-black text-white">{todayLog.calories_out_extra} kcal</span></div>
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
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm italic text-white/40">Még nincs kalórianapló bejegyzés. Állíts be profilt, és rögzíts egy étkezést vagy mozgást a pontosabb követéshez.</div>
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

                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <button onClick={() => setIsMealOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Gemini gyors étkezés</div>
                    {isMealOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isMealOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 overflow-hidden">
                        <textarea rows={3} value={quickMealText} onChange={(event) => { setQuickMealText(event.target.value); setMealSourceType('manual'); }} placeholder="Példa: ettem 3 tojást, két szelet kenyeret és egy protein shake-et" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20" />
                        {favoriteMealPresets.length > 0 && (
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <button onClick={() => setIsFavoriteMealsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Kedvencek</span>
                              {isFavoriteMealsOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                            </button>
                            <AnimatePresence initial={false}>
                              {isFavoriteMealsOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 overflow-hidden">
                                  <div className="flex flex-wrap gap-2">
                                    {favoriteMealPresets.map((preset) => (
                                      <div key={preset.id} className="flex max-w-full items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                                        <button onClick={() => applyPreset(preset)} className="max-w-[calc(100vw-11rem)] whitespace-normal break-words px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10 sm:max-w-none">
                                          {preset.source_text || preset.label}
                                        </button>
                                        <button onClick={() => void toggleFavoritePreset(preset)} className="border-l border-white/10 px-3 text-amber-300 hover:bg-white/10" aria-label="Kedvenc törlése">
                                          <Star size={14} className="fill-current" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {regularMealPresets.map((preset) => (
                            <div key={preset.id} className="flex max-w-full items-stretch overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                              <button onClick={() => applyPreset(preset)} className="max-w-[calc(100vw-11rem)] whitespace-normal break-words px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 sm:max-w-none">
                                {preset.source_text || preset.label}
                              </button>
                              <button onClick={() => void toggleFavoritePreset(preset)} className="border-l border-white/10 px-3 text-white/50 hover:bg-white/10 hover:text-amber-300" aria-label="Kedvenc jelölése">
                                <Star size={14} className={getPresetFavorite(preset) ? 'fill-current text-amber-300' : ''} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button onClick={() => void estimateWithGemini('meal')} disabled={estimatingMeal || !quickMealText.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10 disabled:opacity-50">{estimatingMeal ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Gemini becslés</button>
                          {mealEstimate && (<div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">Becsült összesen: <span className="font-black">{mealEstimate.totalCalories} kcal</span></div>)}
                        </div>
                        {mealEstimateError && <div className="text-sm text-rose-200">{mealEstimateError}</div>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <button onClick={() => setIsExerciseOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Gemini gyors mozgás</div>
                    {isExerciseOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isExerciseOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 overflow-hidden">
                        <textarea rows={3} value={quickExerciseText} onChange={(event) => { setQuickExerciseText(event.target.value); setExerciseSourceType('manual'); }} placeholder="Példa: 45 perc gyors séta dombos terepen, vagy 50 perc közepes intenzitású súlyzós edzés" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/20" />
                        {favoriteExercisePresets.length > 0 && (
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <button onClick={() => setIsFavoriteExercisesOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Kedvencek</span>
                              {isFavoriteExercisesOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                            </button>
                            <AnimatePresence initial={false}>
                              {isFavoriteExercisesOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 overflow-hidden">
                                  <div className="flex flex-wrap gap-2">
                                    {favoriteExercisePresets.map((preset) => (
                                      <div key={preset.id} className="flex max-w-full items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                                        <button onClick={() => applyPreset(preset)} className="max-w-[calc(100vw-11rem)] whitespace-normal break-words px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10 sm:max-w-none">
                                          {preset.source_text || preset.label}
                                        </button>
                                        <button onClick={() => void toggleFavoritePreset(preset)} className="border-l border-white/10 px-3 text-amber-300 hover:bg-white/10" aria-label="Kedvenc törlése">
                                          <Star size={14} className="fill-current" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {regularExercisePresets.map((preset) => (
                            <div key={preset.id} className="flex max-w-full items-stretch overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                              <button onClick={() => applyPreset(preset)} className="max-w-[calc(100vw-11rem)] whitespace-normal break-words px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10 sm:max-w-none">
                                {preset.source_text || preset.label}
                              </button>
                              <button onClick={() => void toggleFavoritePreset(preset)} className="border-l border-white/10 px-3 text-white/50 hover:bg-white/10 hover:text-amber-300" aria-label="Kedvenc jelölése">
                                <Star size={14} className={getPresetFavorite(preset) ? 'fill-current text-amber-300' : ''} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button onClick={() => void estimateWithGemini('exercise')} disabled={estimatingExercise || !quickExerciseText.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10 disabled:opacity-50">{estimatingExercise ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Gemini mozgásbecslés</button>
                          {exerciseEstimate && (<div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">Becsült extra égetés: <span className="font-black">{exerciseEstimate.totalCalories} kcal</span></div>)}
                        </div>
                        {exerciseEstimateError && <div className="text-sm text-rose-200">{exerciseEstimateError}</div>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_120px]">
                    <input type="number" placeholder="Bevitt kcal" value={caloriesIn} onChange={(event) => setCaloriesIn(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 font-bold text-white outline-none placeholder:text-white/20" />
                    <input type="number" placeholder="Extra mozgás" value={caloriesOutExtra} onChange={(event) => setCaloriesOutExtra(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 font-bold text-white outline-none placeholder:text-white/20" />
                    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold uppercase tracking-wide text-white/80 outline-none" />
                    <input type="time" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold uppercase tracking-wide text-white/80 outline-none" />
                  </div>
                  {editingEntryId && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                      <span>Szerkesztési mód: a mentés most a kiválasztott tételt frissíti.</span>
                      <button onClick={resetEntryForm} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-black uppercase tracking-widest text-white/80 hover:bg-white/10">
                        <X size={14} />
                        Mégse
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-black/20 p-1.5 sm:flex-row">
                    <input type="text" placeholder="Megjegyzés opcionálisan, pl. étterem, futás, lábnap" value={note} onChange={(event) => setNote(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/20" />
                    <button onClick={handleSaveLog} disabled={savingEntries || !effectiveMaintenance || (parseInt(caloriesIn || '0', 10) <= 0 && parseInt(caloriesOutExtra || '0', 10) <= 0)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 sm:min-w-[124px] sm:w-auto">{savingEntries ? <Loader2 size={18} className="animate-spin" /> : editingEntryId ? <Save size={18} /> : <Plus size={18} />}{editingEntryId ? 'Mentés' : 'Hozzáadás'}</button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="mb-3 flex items-start gap-2 sm:items-center">
                    <button onClick={() => setDate((current) => shiftDateByDays(current, -1))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                      <ChevronLeft size={16} />
                    </button>
                    <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Napi tételek</div>
                          <div className="mt-1 text-sm text-white/70">{format(parseISO(date), 'yyyy. MMMM d.', { locale: hu })}</div>
                        </div>
                        <div className={`inline-flex self-start rounded-xl border px-3 py-2 text-left text-[10px] font-black tracking-widest sm:text-right ${selectedDateStatus.tone}`}>
                          <div>
                            <div>{selectedDateStatus.label}</div>
                            <div className="mt-1 text-xs">{formatBalance(selectedDateBalance)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setDate((current) => shiftDateByDays(current, 1))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="mb-3 flex justify-end">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-white/70">
                      {selectedDateEntries.length} tétel
                    </div>
                  </div>

                  {selectedDateEntries.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDateEntries.map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="whitespace-pre-wrap break-words text-sm font-black text-white">{entry.source_text || entry.label || (entry.entry_type === 'meal' ? 'Étkezés' : 'Mozgás')}</div>
                            <div className="mt-1 text-xs text-white/45">
                              {entry.entry_type === 'meal' ? 'Étkezés' : 'Mozgás'} · {entry.source_type === 'ai' ? 'AI becslés' : entry.source_type === 'preset' ? 'Sablon' : 'Kézi'}
                              <span className="mx-1">·</span>
                              {getEntryTime(entry)}
                            </div>
                            {getEntryNoteText(entry) && <div className="mt-1 whitespace-pre-wrap break-words text-xs text-white/60">{getEntryNoteText(entry)}</div>}
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button onClick={() => startEditingEntry(entry)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Tétel szerkesztése">
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => void deleteEntry(entry.id)} disabled={deletingEntryId === entry.id} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 text-rose-200 transition-colors hover:bg-rose-500/10 disabled:opacity-50" aria-label="Tétel törlése">
                              {deletingEntryId === entry.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                            <div className={`rounded-xl px-3 py-2 text-sm font-black ${entry.entry_type === 'meal' ? 'bg-amber-500/15 text-amber-200' : 'bg-sky-500/15 text-sky-200'}`}>
                              {entry.entry_type === 'meal' ? '+' : '-'}{entry.calories} kcal
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm italic text-white/40">
                      A kiválasztott naphoz még nincs külön tétel. Itt fogod látni a több étkezést és több mozgást is ugyanarra a napra.
                    </div>
                  )}

                  <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Napi alap</div>
                      <div className="mt-1 text-sm font-black text-white">{selectedDateLog.calorie_target} kcal</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Bevitt</div>
                      <div className="mt-1 text-sm font-black text-white">{selectedDateLog.calories_in} kcal</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Mozgás</div>
                      <div className="mt-1 text-sm font-black text-white">{selectedDateLog.calories_out_extra} kcal</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Napi summa</div>
                      <div className={`mt-1 text-sm font-black ${selectedDateBalance <= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>{formatBalance(selectedDateBalance)}</div>
                    </div>
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

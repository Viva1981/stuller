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
import { Flame, ChevronDown, ChevronUp, Plus, Target, TrendingDown, TrendingUp } from 'lucide-react';

type CalorieLog = {
  id: string;
  owner: string;
  date: string;
  calorie_target: number;
  calories_in: number;
  calories_out_extra: number;
  note: string | null;
};

type RangeValue = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGES: Array<{ label: string; value: RangeValue }> = [
  { label: '1H', value: '1M' },
  { label: '3H', value: '3M' },
  { label: '6H', value: '6M' },
  { label: '1É', value: '1Y' },
  { label: 'ALL', value: 'ALL' },
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

export default function CalorieBalanceTracker({ owner }: { owner: string }) {
  const [logs, setLogs] = useState<CalorieLog[]>([]);
  const [calorieTarget, setCalorieTarget] = useState('');
  const [caloriesIn, setCaloriesIn] = useState('');
  const [caloriesOutExtra, setCaloriesOutExtra] = useState('0');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [range, setRange] = useState<RangeValue>('3M');
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('calorie_logs')
      .select('*')
      .eq('owner', owner)
      .order('date', { ascending: true });

    if (data) {
      const typedData = data as CalorieLog[];
      setLogs(typedData);
      if (typedData.length > 0) {
        const lastLog = typedData[typedData.length - 1];
        setCalorieTarget((current) => current || String(lastLog.calorie_target));
      }
    }

    setLoading(false);
  }, [owner]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchLogs();
    }, 0);
    return () => clearTimeout(initTimer);
  }, [fetchLogs]);

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

  const handleSaveLog = async () => {
    if (!calorieTarget || !caloriesIn || !date) {
      return;
    }

    await supabase.from('calorie_logs').upsert(
      {
        owner,
        date,
        calorie_target: parseInt(calorieTarget, 10),
        calories_in: parseInt(caloriesIn, 10),
        calories_out_extra: parseInt(caloriesOutExtra || '0', 10),
        note: note.trim() || null,
      },
      { onConflict: 'owner,date' }
    );

    setCaloriesIn('');
    setCaloriesOutExtra('0');
    setNote('');
    void fetchLogs();
  };

  if (loading) return null;

  return (
    <div className="space-y-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0a0c10] p-4 transition-colors group cursor-pointer hover:bg-white/5"
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
              {latestLog && status ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Napi cél</div>
                    <div className="mt-2 text-2xl font-black text-white">{latestLog.calorie_target}</div>
                    <div className="text-xs text-white/40">kcal</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Bevitt</div>
                    <div className="mt-2 text-2xl font-black text-white">{latestLog.calories_in}</div>
                    <div className="text-xs text-white/40">kcal</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Extra mozgás</div>
                    <div className="mt-2 text-2xl font-black text-white">{latestLog.calories_out_extra}</div>
                    <div className="text-xs text-white/40">kcal</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Egyenleg</div>
                    <div className={`mt-2 text-2xl font-black ${latestBalance !== null && latestBalance <= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>
                      {latestBalance !== null ? formatBalance(latestBalance) : '—'}
                    </div>
                    <div className={`mt-1 inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${status.tone}`}>
                      <status.icon size={12} />
                      {status.label}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm italic text-white/40">
                  Még nincs kalórianapló bejegyzés. Az első nap rögzítése után itt látod, deficitben vagy-e.
                </div>
              )}

              <div className="h-64 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#ffffff40"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => format(parseISO(value), 'MMM d', { locale: hu })}
                      />
                      <YAxis stroke="#ffffff40" tick={{ fontSize: 10 }} unit=" kcal" width={52} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f1115', borderColor: '#ffffff20', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        labelFormatter={(label) => format(parseISO(String(label)), 'yyyy. MMM d.', { locale: hu })}
                        formatter={(value) => [formatBalance(Number(value ?? 0)), 'Egyenleg']}
                      />
                      <Area type="monotone" dataKey="balance" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm italic text-white/30">
                    Még nincs elég adat a diagramhoz.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-center gap-1.5">
                  {RANGES.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setRange(item.value)}
                      className={`rounded-lg px-3 py-1.5 text-[10px] font-black tracking-widest transition-all ${
                        range === item.value ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {averages && (
                  <div className="grid gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag cél</div>
                      <div className="mt-1 text-sm font-bold text-white">{averages.target} kcal</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag bevitt</div>
                      <div className="mt-1 text-sm font-bold text-white">{averages.in} kcal</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag mozgás</div>
                      <div className="mt-1 text-sm font-bold text-white">{averages.out} kcal</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Átlag egyenleg</div>
                      <div className={`mt-1 text-sm font-bold ${averages.balance <= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>
                        {formatBalance(averages.balance)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr] lg:grid-cols-[110px_1fr_1fr_120px]">
                    <input
                      type="number"
                      placeholder="Cél"
                      value={calorieTarget}
                      onChange={(event) => setCalorieTarget(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 font-bold text-white outline-none placeholder-white/20"
                    />
                    <input
                      type="number"
                      placeholder="Bevitt kcal"
                      value={caloriesIn}
                      onChange={(event) => setCaloriesIn(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 font-bold text-white outline-none placeholder-white/20"
                    />
                    <input
                      type="number"
                      placeholder="Extra mozgás"
                      value={caloriesOutExtra}
                      onChange={(event) => setCaloriesOutExtra(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 font-bold text-white outline-none placeholder-white/20"
                    />
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-bold uppercase tracking-wide text-white/80 outline-none"
                    />
                  </div>

                  <div className="flex gap-2 rounded-2xl border border-white/5 bg-black/20 p-1.5">
                    <input
                      type="text"
                      placeholder="Megjegyzés opcionálisan, pl. csaló étkezés, edzésnap"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/20"
                    />
                    <button
                      onClick={handleSaveLog}
                      disabled={!calorieTarget || !caloriesIn}
                      className="flex w-12 items-center justify-center rounded-xl bg-emerald-500 text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <Plus size={20} />
                    </button>
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

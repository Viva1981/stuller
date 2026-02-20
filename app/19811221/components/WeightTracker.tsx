"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/app/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, subMonths, subYears, isAfter, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Scale, Plus, ChevronDown, ChevronUp } from 'lucide-react';

type WeightLog = {
  id: string;
  owner: string;
  weight: number;
  date: string;
};

const RANGES = [
  { label: '1H', value: '1M' },
  { label: '3H', value: '3M' },
  { label: '6H', value: '6M' },
  { label: '1É', value: '1Y' },
  { label: 'ALL', value: 'ALL' }
];

export default function WeightTracker({ owner }: { owner: string }) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [range, setRange] = useState('3M');
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchWeights = useCallback(async () => {
    const { data } = await supabase.from('weight_logs').select('*').eq('owner', owner).order('date', { ascending: true });

    if (data) setLogs(data as WeightLog[]);
    setLoading(false);
  }, [owner]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchWeights();
    }, 0);
    return () => clearTimeout(initTimer);
  }, [fetchWeights]);

  const handleAddWeight = async () => {
    if (!weight || !date) return;

    await supabase.from('weight_logs').insert({
      owner,
      weight: parseFloat(weight),
      date
    });

    setWeight('');
    fetchWeights();
  };

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

  const latestWeight = useMemo(() => {
    if (logs.length === 0) return null;
    return logs[logs.length - 1].weight;
  }, [logs]);

  if (loading) return null;

  return (
    <div className="space-y-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between bg-[#0a0c10] p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
            {isOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
          </div>
          <h2 className="text-xl font-black italic tracking-wider text-white uppercase">SÚLYNAPLÓ</h2>
        </div>

        {latestWeight ? (
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-sm bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">{latestWeight} kg</span>
          </div>
        ) : (
          <Scale size={20} className="text-white/30" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden bg-[#0a0c10]/50 border-x border-b border-white/5 rounded-b-2xl -mt-2 pt-4 px-4 pb-6 mx-1"
          >
            <div className="space-y-6">
              <div className="h-64 w-full">
                {filteredData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#ffffff40"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(str) => format(parseISO(str), 'MMM d', { locale: hu })}
                      />
                      <YAxis domain={['auto', 'auto']} stroke="#ffffff40" tick={{ fontSize: 10 }} unit=" kg" width={35} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f1115', borderColor: '#ffffff20', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        labelFormatter={(label) => format(parseISO(String(label)), 'yyyy. MMM d.', { locale: hu })}
                      />
                      <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-sm italic">Még nincs elég adat a diagramhoz.</div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-center gap-1.5">
                  {RANGES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRange(r.value)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                        range === r.value ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5">
                  <input
                    type="number"
                    placeholder="kg"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-20 bg-transparent text-center text-white font-bold outline-none placeholder-white/20 text-lg"
                  />
                  <div className="w-px bg-white/10 my-2"></div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-1 bg-transparent text-center text-white/80 text-xs font-bold outline-none uppercase tracking-wide cursor-pointer"
                  />
                  <button
                    onClick={handleAddWeight}
                    disabled={!weight}
                    className="bg-emerald-500 w-12 rounded-xl flex items-center justify-center text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

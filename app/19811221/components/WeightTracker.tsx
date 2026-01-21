"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/app/supabase';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { format, subMonths, subYears, isAfter, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Scale, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';

const RANGES = [
  { label: '1H', value: '1M' },
  { label: '3H', value: '3M' },
  { label: '6H', value: '6M' },
  { label: '1É', value: '1Y' },
  { label: 'ALL', value: 'ALL' },
];

export default function WeightTracker({ owner }: { owner: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [range, setRange] = useState('3M'); // Alapértelmezett: 3 hónap
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeights();
  }, [owner]);

  const fetchWeights = async () => {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('owner', owner)
      .order('date', { ascending: true });
    
    if (data) setLogs(data);
    setLoading(false);
  };

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

  const handleDelete = async (id: string) => {
    await supabase.from('weight_logs').delete().eq('id', id);
    fetchWeights();
  };

  // Adatok szűrése a választott időtávra
  const filteredData = useMemo(() => {
    if (range === 'ALL') return logs;

    const now = new Date();
    let cutOffDate = new Date();

    if (range === '1M') cutOffDate = subMonths(now, 1);
    if (range === '3M') cutOffDate = subMonths(now, 3);
    if (range === '6M') cutOffDate = subMonths(now, 6);
    if (range === '1Y') cutOffDate = subYears(now, 1);

    return logs.filter(log => isAfter(parseISO(log.date), cutOffDate));
  }, [logs, range]);

  // Statisztika számolása
  const stats = useMemo(() => {
    if (logs.length < 2) return null;
    const latest = logs[logs.length - 1].weight;
    const prev = logs[logs.length - 2].weight;
    const diff = latest - prev;
    return { latest, diff };
  }, [logs]);

  if (loading) return null;

  return (
    <div className="bg-[#0a0c10] border border-white/5 rounded-3xl p-6 space-y-6">
      
      {/* FEJLÉC */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/5 rounded-full text-emerald-500">
            <Scale size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Súlynapló</h2>
            {stats && (
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-white/60">Aktuális: {stats.latest} kg</span>
                <span className={`flex items-center ${stats.diff <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stats.diff > 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                  {Math.abs(stats.diff).toFixed(1)} kg
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DIAGRAMM */}
      <div className="h-64 w-full">
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#ffffff40" 
                tick={{fontSize: 10}} 
                tickFormatter={(str) => format(parseISO(str), 'MMM d', { locale: hu })}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                stroke="#ffffff40" 
                tick={{fontSize: 10}}
                unit=" kg"
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f1115', borderColor: '#ffffff20', borderRadius: '12px' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(label) => format(parseISO(label), 'yyyy. MMM d.', { locale: hu })}
              />
              <Area 
                type="monotone" 
                dataKey="weight" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorWeight)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-white/30 text-sm italic">
            Még nincs elég adat a diagramhoz.
          </div>
        )}
      </div>

      {/* IDŐTÁV VÁLASZTÓ */}
      <div className="flex justify-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest transition-all ${
              range === r.value 
                ? 'bg-emerald-500 text-black' 
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ÚJ BEJEGYZÉS */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
        <input 
          type="number" 
          placeholder="kg" 
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-20 bg-transparent text-center text-white font-bold outline-none placeholder-white/20"
        />
        <div className="w-px bg-white/10 my-2"></div>
        <input 
          type="date" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 bg-transparent text-center text-white/80 text-xs font-bold outline-none"
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
  );
}
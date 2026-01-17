"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Plus, X, Trash2, ChevronLeft, ChevronRight, Target, AlertCircle, Briefcase, Users } from 'lucide-react';

const MEMBERS = [
  { name: 'Andrea', color: 'bg-pink-500' },
  { name: 'Zsolt', color: 'bg-blue-500' },
  { name: 'Adél', color: 'bg-purple-500' },
  { name: 'Zsombor', color: 'bg-orange-500' }
];

export default function FamilyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [view, setView] = useState<'day' | 'month'>('day');
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pivotDate, setPivotDate] = useState(new Date());

  // Form állapotok
  const [title, setTitle] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['Zsolt']);
  const [time, setTime] = useState('12:00');
  const [priority, setPriority] = useState('normál');
  const [isDuty, setIsDuty] = useState(false);
  const [recurrence, setRecurrence] = useState('none');

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('events').select('*').order('event_time', { ascending: true });
    if (!error) setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    const { error } = await supabase.from('events').insert([{ 
      title, event_date: selectedDate, event_time: time, 
      member_names: selectedMembers, priority, is_duty: isDuty, recurrence 
    }]);
    if (!error) { 
      setTitle(''); setIsDuty(false); setRecurrence('none'); setShowAddForm(false); fetchEvents(); 
    }
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    fetchEvents();
  };

  const getVisibleDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(pivotDate);
      d.setDate(pivotDate.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const toggleMember = (m: string) => {
    setSelectedMembers(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const filteredEvents = events.filter(e => e.event_date === selectedDate);

  return (
    <div className="space-y-4">
      {/* 1. KOMPAKT NAVIGÁCIÓ */}
      <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
        <div className="flex gap-1">
          <button onClick={() => setPivotDate(new Date(pivotDate.setDate(pivotDate.getDate() - 7)))} className="p-2 hover:bg-slate-800 rounded-xl"><ChevronLeft size={18}/></button>
          <button onClick={() => { setPivotDate(new Date()); setSelectedDate(new Date().toISOString().split('T')[0]); }} className="px-3 py-1 text-xs font-black text-emerald-400">MA</button>
          <button onClick={() => setPivotDate(new Date(pivotDate.setDate(pivotDate.getDate() + 7)))} className="p-2 hover:bg-slate-800 rounded-xl"><ChevronRight size={18}/></button>
        </div>
        <h3 className="text-sm font-black uppercase tracking-tighter">
          {pivotDate.toLocaleDateString('hu-HU', { month: 'short', year: 'numeric' })}
        </h3>
        <button onClick={() => setView(view === 'day' ? 'month' : 'day')} className="text-[10px] font-black bg-slate-800 px-3 py-1 rounded-lg uppercase">
          {view === 'day' ? 'Havi nézet' : 'Beosztás'}
        </button>
      </div>

      {/* 2. SMART DAY STRIP (7 NAP) */}
      {view === 'day' && (
        <div className="flex justify-between gap-1">
          {getVisibleDays().map((date) => {
            const dStr = date.toISOString().split('T')[0];
            const active = dStr === selectedDate;
            const dayEvents = events.filter(e => e.event_date === dStr);
            const hasImportant = dayEvents.some(e => e.priority === 'fontos');
            const hasDuty = dayEvents.some(e => e.is_duty);
            const activeMemberColors = MEMBERS.filter(m => dayEvents.some(e => e.member_names?.includes(m.name)));

            return (
              <button key={dStr} onClick={() => setSelectedDate(dStr)}
                className={`flex-1 min-w-0 h-14 rounded-xl flex flex-col items-center justify-center relative transition-all ${active ? 'bg-emerald-500 text-white scale-105 shadow-lg' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}
              >
                <span className="text-[8px] font-black uppercase">{date.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
                <span className="text-sm font-black">{date.getDate()}</span>

                {/* BAL OLDAL: TAGOK PÖTTYÖK */}
                <div className="absolute left-1 top-1 flex flex-col gap-0.5">
                  {activeMemberColors.map(m => <div key={m.name} className={`w-1 h-1 rounded-full ${m.color}`} />)}
                </div>

                {/* JOBB FENT: FONTOS PULZÁLÓ */}
                {hasImportant && (
                  <div className="absolute top-1 right-1 h-1.5 w-1.5">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </div>
                )}

                {/* JOBB ALUL: ÜGYELET KÉK */}
                {hasDuty && <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full" />}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. HOZZÁADÁS FORM (Kompakt, minden funkcióval) */}
      <button onClick={() => setShowAddForm(!showAddForm)} className="w-full py-2 bg-slate-900 border border-dashed border-slate-700 rounded-xl text-xs font-bold text-slate-400 flex items-center justify-center gap-2">
        {showAddForm ? <X size={14}/> : <Plus size={14}/>} {showAddForm ? 'BEZÁRÁS' : 'ÚJ BEJEGYZÉS'}
      </button>

      <AnimatePresence>
        {showAddForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddEvent} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3"
          >
            <input type="text" placeholder="Esemény neve..." value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 text-white" />
            
            <div className="flex flex-wrap gap-2">
              {MEMBERS.map(m => (
                <button key={m.name} type="button" onClick={() => toggleMember(m.name)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all border ${selectedMembers.includes(m.name) ? `${m.color} text-white border-transparent` : 'bg-slate-950 text-slate-500 border-slate-800'}`}
                >
                  {m.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-white" />
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)} className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-white">
                <option value="none">Nincs ismétlés</option>
                <option value="daily">Naponta</option>
                <option value="weekly">Hetente</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setPriority(priority === 'fontos' ? 'normál' : 'fontos')}
                className={`flex-1 p-2 rounded-xl text-[10px] font-bold border transition-all ${priority === 'fontos' ? 'bg-red-500 text-white' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                ⚠️ FONTOS
              </button>
              <button type="button" onClick={() => setIsDuty(!isDuty)}
                className={`flex-1 p-2 rounded-xl text-[10px] font-bold border transition-all ${isDuty ? 'bg-blue-500 text-white' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                🛡️ ÜGYELET
              </button>
            </div>

            <button className="w-full bg-emerald-500 p-3 rounded-xl font-black text-xs uppercase tracking-widest text-white">MENTÉS</button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 4. ESEMÉNY LISTA */}
      <div className="space-y-2">
        {filteredEvents.map(e => (
          <div key={e.id} className={`p-3 rounded-xl border flex items-center justify-between ${e.is_duty ? 'bg-blue-500/10 border-blue-500/30' : e.priority === 'fontos' ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/40 border-slate-800/60'}`}>
            <div className="flex gap-3 items-center">
              <span className="text-[10px] font-black text-slate-500">{e.event_time.substring(0,5)}</span>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  {e.is_duty && <Briefcase size={12} className="text-blue-400"/>}
                  {e.title}
                </h4>
                <div className="flex gap-1 mt-1">
                  {e.member_names?.map((m: string) => (
                    <div key={m} className={`w-1.5 h-1.5 rounded-full ${MEMBERS.find(x => x.name === m)?.color}`} />
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => deleteEvent(e.id)} className="text-slate-600 p-1"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}
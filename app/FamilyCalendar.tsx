"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Target, Briefcase, Calendar as CalendarIcon } from 'lucide-react';

const MEMBERS = [
  { name: 'Andrea', color: 'bg-pink-500 shadow-pink-500/50' },
  { name: 'Zsolt', color: 'bg-blue-500 shadow-blue-500/50' },
  { name: 'Adél', color: 'bg-purple-500 shadow-purple-500/50' },
  { name: 'Zsombor', color: 'bg-orange-500 shadow-orange-500/50' }
];

export default function FamilyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [view, setView] = useState<'day' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pivotDate, setPivotDate] = useState(new Date());

  // Form states
  const [title, setTitle] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['Zsolt']);
  const [time, setTime] = useState('08:00');
  const [priority, setPriority] = useState('normál');

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('events').select('*').order('event_time', { ascending: true });
    if (!error) setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const jumpToToday = () => {
    const today = new Date();
    setPivotDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  const handleAddEvent = async (customTitle?: string, isDutyEvent: boolean = false) => {
    const finalTitle = isDutyEvent ? "Ügyelet" : title;
    if (!finalTitle && !isDutyEvent) return;

    const { error } = await supabase.from('events').insert([{ 
      title: finalTitle, 
      event_date: selectedDate, 
      event_time: isDutyEvent ? "00:00" : time, 
      member_names: isDutyEvent ? [] : selectedMembers, 
      priority: isDutyEvent ? 'normál' : priority, 
      is_duty: isDutyEvent 
    }]);

    if (!error) { 
      setTitle(''); 
      setShowAddForm(false); 
      fetchEvents(); 
    }
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    fetchEvents();
  };

  const getDaysForMonth = () => {
    const days = [];
    const start = new Date(pivotDate.getFullYear(), pivotDate.getMonth(), 1);
    const startDay = start.getDay() === 0 ? 6 : start.getDay() - 1;
    start.setDate(start.getDate() - startDay);

    for (let i = 0; i < 28; i++) { 
      days.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
    }
    return days;
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

  const filteredEvents = events.filter(e => e.event_date === selectedDate);

  const renderDayCard = (date: Date, isCompact: boolean = false) => {
    const dStr = date.toISOString().split('T')[0];
    const active = dStr === selectedDate;
    const isToday = new Date().toISOString().split('T')[0] === dStr;
    const dayEvents = events.filter(e => e.event_date === dStr);
    const hasImportant = dayEvents.some(e => e.priority === 'fontos');
    const hasDuty = dayEvents.some(e => e.is_duty);
    const activeMemberColors = MEMBERS.filter(m => dayEvents.some(e => e.member_names?.includes(m.name)));

    return (
      <button key={dStr} onClick={() => setSelectedDate(dStr)}
        className={`relative flex-1 min-w-0 ${isCompact ? 'h-16' : 'h-20'} rounded-2xl flex flex-col items-center justify-center transition-all border shadow-sm ${
          active 
          ? 'bg-white text-black border-white scale-105 z-10 shadow-xl' 
          : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
        }`}
      >
        <span className={`text-[9px] font-black uppercase ${active ? 'text-black/60' : 'text-slate-500'}`}>
          {date.toLocaleDateString('hu-HU', { weekday: 'short' })}
        </span>
        <span className="text-lg font-black">{date.getDate()}</span>

        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          {activeMemberColors.map(m => (
            <div key={m.name} className={`w-2.5 h-2.5 rounded-full shadow-lg ${m.color}`} />
          ))}
        </div>

        {hasImportant && (
          <div className="absolute top-1.5 right-1.5 h-3 w-3">
            <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 shadow-md shadow-red-500/50"></span>
          </div>
        )}

        {hasDuty && (
          <div className="absolute bottom-1.5 right-1.5 w-3 h-3 bg-blue-500 rounded-full shadow-md shadow-blue-500/50" />
        )}
        
        {isToday && !active && <div className="absolute bottom-1 w-5 h-0.5 bg-emerald-500 rounded-full" />}
      </button>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={() => setShowAddForm(!showAddForm)} 
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs py-4 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {showAddForm ? <X size={18}/> : <Plus size={18}/>}
          {showAddForm ? 'BEZÁRÁS' : 'ÚJ BEJEGYZÉS'}
        </button>
        
        <button onClick={() => handleAddEvent("Ügyelet", true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
        >
          <Briefcase size={18}/>
          ÜGYELET
        </button>

        <button onClick={() => { supabase.auth.signOut(); window.location.href='/'; }} 
          className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-slate-500 hover:text-red-400 transition-colors"
        >
          <X size={18}/>
        </button>
      </div>

      <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-2xl border border-slate-800/50 backdrop-blur-md">
        <div className="flex gap-1">
          <button onClick={() => setPivotDate(new Date(pivotDate.setDate(pivotDate.getDate() - 7)))} className="p-2 hover:bg-slate-800 rounded-xl"><ChevronLeft size={20}/></button>
          <button onClick={jumpToToday} className="px-4 py-1 text-xs font-black text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors">MA</button>
          <button onClick={() => setPivotDate(new Date(pivotDate.setDate(pivotDate.getDate() + 7)))} className="p-2 hover:bg-slate-800 rounded-xl"><ChevronRight size={20}/></button>
        </div>
        <div className="text-center">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">
            {pivotDate.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        <button onClick={() => setView(view === 'day' ? 'month' : 'day')} 
          className="flex items-center gap-2 text-[10px] font-black bg-white text-black px-4 py-2 rounded-xl uppercase hover:bg-slate-200 transition-colors shadow-sm"
        >
          <CalendarIcon size={14}/>
          {view === 'day' ? 'Havi' : 'Heti'}
        </button>
      </div>

      <div className="min-h-[160px]">
        {view === 'day' ? (
          <div className="flex justify-between gap-2">
            {getVisibleDays().map(d => renderDayCard(d))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {getDaysForMonth().map(d => renderDayCard(d, true))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onSubmit={(e) => { e.preventDefault(); handleAddEvent(); }} 
            className="bg-white p-6 rounded-[2.5rem] space-y-4 shadow-2xl text-black"
          >
            <input type="text" placeholder="Mi a program?" value={title} onChange={e => setTitle(e.target.value)} autoFocus
              className="w-full bg-slate-100 border-none p-4 rounded-2xl text-lg font-bold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500" />
            
            <div className="flex flex-wrap gap-2">
              {MEMBERS.map(m => (
                <button key={m.name} type="button" onClick={() => setSelectedMembers(prev => prev.includes(m.name) ? prev.filter(x => x !== m.name) : [...prev, m.name])}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${selectedMembers.includes(m.name) ? `bg-black text-white border-black` : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  {m.name.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-slate-100 border-none p-4 rounded-2xl font-bold outline-none" />
              <button type="button" onClick={() => setPriority(priority === 'fontos' ? 'normál' : 'fontos')}
                className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${priority === 'fontos' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30' : 'bg-white text-slate-400 border-slate-100'}`}>
                ⚠️ FONTOS
              </button>
            </div>

            <button className="w-full bg-black text-white p-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-transform">
              MENTÉS A NAPLÓBA
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <p className="text-slate-600 italic text-sm px-2 py-4">Nincs bejegyzés erre a napra.</p>
        ) : (
          filteredEvents.map(e => (
            <div key={e.id} className={`group p-4 rounded-3xl border transition-all flex items-center justify-between ${e.is_duty ? 'bg-blue-600/10 border-blue-500/20 shadow-inner' : e.priority === 'fontos' ? 'bg-red-600/10 border-red-500/20' : 'bg-slate-900/40 border-slate-800/50'}`}>
              <div className="flex gap-4 items-center">
                <span className="text-xs font-black text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{e.event_time.substring(0,5)}</span>
                <div>
                  <h4 className="text-md font-bold text-white flex items-center gap-2">
                    {e.is_duty && <Briefcase size={16} className="text-blue-400"/>}
                    {e.title}
                  </h4>
                  <div className="flex gap-1.5 mt-2">
                    {e.member_names?.map((m: string) => (
                      <div key={m} className={`w-3 h-3 rounded-full shadow-md ${MEMBERS.find(x => x.name === m)?.color}`} />
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => deleteEvent(e.id)} className="text-slate-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
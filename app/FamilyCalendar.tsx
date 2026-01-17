"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Target, Briefcase, Calendar as CalendarIcon, Edit2, RefreshCw } from 'lucide-react';

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
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [pivotDate, setPivotDate] = useState(new Date());

  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['Zsolt']);
  const [time, setTime] = useState('08:00');
  const [priority, setPriority] = useState('normál');
  const [recurrence, setRecurrence] = useState('none');

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('events').select('*').order('event_time', { ascending: true });
    if (!error) setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  // Intelligens szűrő, ami kezeli az ismétlődő eseményeket is
  const getEventsForDate = (dateStr: string) => {
    const targetDate = new Date(dateStr);
    return events.filter(e => {
      const eventStartDate = new Date(e.event_date);
      // Csak azokat mutatjuk, amik nem a jövőben kezdődnek az adott naphoz képest
      if (formatDate(eventStartDate) > dateStr) return false;

      // 1. Pontos egyezés
      if (e.event_date === dateStr) return true;
      
      // 2. Napi ismétlődés
      if (e.recurrence === 'daily') return true;
      
      // 3. Heti ismétlődés (ugyanaz a nap a héten)
      if (e.recurrence === 'weekly') {
        return eventStartDate.getDay() === targetDate.getDay();
      }
      
      // 4. Munkanapok (H-P)
      if (e.recurrence === 'workdays') {
        const day = targetDate.getDay();
        return day >= 1 && day <= 5;
      }

      return false;
    });
  };

  const handleEditClick = (event: any) => {
    setEditId(event.id);
    setTitle(event.title);
    setSelectedMembers(event.member_names || []);
    setTime(event.event_time.substring(0, 5));
    setPriority(event.priority);
    setRecurrence(event.recurrence || 'none');
    setShowAddForm(true);
  };

  const handleAddEvent = async (customTitle?: string, isDutyEvent: boolean = false) => {
    const finalTitle = isDutyEvent ? "Ügyelet" : title;
    if (!finalTitle && !isDutyEvent) return;

    let finalTime = time;
    if (isDutyEvent) {
      const d = new Date(selectedDate);
      const day = d.getDay();
      finalTime = (day === 0 || day === 6) ? "08:00" : "17:00";
    }

    const eventData = { 
      title: finalTitle, 
      event_date: selectedDate, 
      event_time: finalTime, 
      member_names: isDutyEvent ? [] : selectedMembers, 
      priority: isDutyEvent ? 'normál' : priority, 
      is_duty: isDutyEvent,
      recurrence: isDutyEvent ? 'none' : recurrence
    };

    let error;
    if (editId) {
      const { error: err } = await supabase.from('events').update(eventData).eq('id', editId);
      error = err;
    } else {
      const { error: err } = await supabase.from('events').insert([eventData]);
      error = err;
    }

    if (!error) { 
      setTitle(''); setEditId(null); setRecurrence('none'); setShowAddForm(false); fetchEvents(); 
    }
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    fetchEvents();
  };

  const renderDayCard = (date: Date, isCompact: boolean = false) => {
    const dStr = formatDate(date);
    const active = dStr === selectedDate;
    const isToday = formatDate(new Date()) === dStr;
    const dayEvents = getEventsForDate(dStr);
    const hasImportant = dayEvents.some(e => e.priority === 'fontos');
    const hasDuty = dayEvents.some(e => e.is_duty);
    const activeMemberColors = MEMBERS.filter(m => dayEvents.some(e => e.member_names?.includes(m.name)));

    return (
      <button key={dStr} onClick={() => setSelectedDate(dStr)}
        className={`relative flex-1 min-w-0 ${isCompact ? 'h-16' : 'h-20'} rounded-2xl flex flex-col items-center justify-center transition-all border shadow-sm ${
          active ? 'bg-white text-black border-white scale-105 z-10 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
        }`}
      >
        <span className={`text-[9px] font-black uppercase ${active ? 'text-black/60' : 'text-slate-500'}`}>{date.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
        <span className="text-lg font-black">{date.getDate()}</span>

        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          {activeMemberColors.map(m => <div key={m.name} className={`w-2.5 h-2.5 rounded-full shadow-lg ${m.color}`} />)}
        </div>

        {hasImportant && (
          <div className="absolute -top-1 -right-1 h-3.5 w-3.5 z-20">
            <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600 shadow-md shadow-red-500/50 border border-slate-950"></span>
          </div>
        )}

        {hasDuty && <div className="absolute bottom-1.5 right-1.5 w-3 h-3 bg-blue-500 rounded-full shadow-md shadow-blue-500/50" />}
        {isToday && !active && <div className="absolute bottom-1 w-5 h-0.5 bg-emerald-500 rounded-full" />}
      </button>
    );
  };

  const currentDayEvents = getEventsForDate(selectedDate);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* FEJLÉC GOMBOK */}
      <div className="flex items-center gap-2">
        <button onClick={() => { setEditId(null); setTitle(''); setRecurrence('none'); setShowAddForm(!showAddForm); }} 
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {showAddForm ? <X size={18}/> : <Plus size={18}/>} {showAddForm ? 'BEZÁRÁS' : 'ÚJ BEJEGYZÉS'}
        </button>
        <button onClick={() => handleAddEvent("Ügyelet", true)} className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg flex items-center gap-2 transition-all active:scale-95">
          <Briefcase size={18}/> ÜGYELET
        </button>
        <button onClick={() => { supabase.auth.signOut(); window.location.href='/'; }} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-slate-500 hover:text-red-400 transition-colors">
          <X size={18}/>
        </button>
      </div>

      {/* NAVIGÁCIÓ */}
      <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-2xl border border-slate-800/50 backdrop-blur-md">
        <div className="flex gap-1">
          <button onClick={() => { const d = new Date(pivotDate); view === 'month' ? d.setMonth(d.getMonth()-1) : d.setDate(d.getDate()-7); setPivotDate(d); }} className="p-2 hover:bg-slate-800 rounded-xl"><ChevronLeft size={20}/></button>
          <button onClick={() => { const t = new Date(); setPivotDate(t); setSelectedDate(formatDate(t)); }} className="px-4 py-1 text-xs font-black text-emerald-400">MA</button>
          <button onClick={() => { const d = new Date(pivotDate); view === 'month' ? d.setMonth(d.getMonth()+1) : d.setDate(d.getDate()+7); setPivotDate(d); }} className="p-2 hover:bg-slate-800 rounded-xl"><ChevronRight size={20}/></button>
        </div>
        <h3 className="text-sm font-black uppercase text-white">{pivotDate.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => setView(view === 'day' ? 'month' : 'day')} className="flex items-center gap-2 text-[10px] font-black bg-white text-black px-4 py-2 rounded-xl uppercase">
          <CalendarIcon size={14}/> {view === 'day' ? 'Havi' : 'Heti'}
        </button>
      </div>

      {/* KÁRTYÁK */}
      <div className="min-h-[160px]">
        {view === 'day' ? (
          <div className="flex justify-between gap-2">
            {[...Array(7)].map((_, i) => { const d = new Date(pivotDate); d.setDate(d.getDate() + i); return renderDayCard(d); })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {[...Array(28)].map((_, i) => {
              const d = new Date(pivotDate.getFullYear(), pivotDate.getMonth(), 1);
              const startDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
              d.setDate(d.getDate() - startDay + i);
              return renderDayCard(d, true);
            })}
          </div>
        )}
      </div>

      {/* FORM ISMÉTLŐDÉSSEL */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onSubmit={(e) => { e.preventDefault(); handleAddEvent(); }} className="bg-white p-6 rounded-[2.5rem] space-y-4 shadow-2xl text-black"
          >
            <input type="text" placeholder="Mi a program?" value={title} onChange={e => setTitle(e.target.value)} autoFocus className="w-full bg-slate-100 border-none p-4 rounded-2xl text-lg font-bold outline-none" />
            
            <div className="flex flex-wrap gap-2">
              {MEMBERS.map(m => (
                <button key={m.name} type="button" onClick={() => setSelectedMembers(prev => prev.includes(m.name) ? prev.filter(x => x !== m.name) : [...prev, m.name])}
                  className={`px-4 py-2 rounded-xl text-xs font-black border-2 ${selectedMembers.includes(m.name) ? `bg-black text-white border-black` : 'bg-white text-slate-400 border-slate-100'}`}
                >{m.name.toUpperCase()}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="bg-slate-100 p-4 rounded-2xl font-bold outline-none" />
              <select value={recurrence} onChange={e => setRecurrence(e.target.value)} className="bg-slate-100 p-4 rounded-2xl font-bold outline-none border-none">
                <option value="none">Nincs ismétlés</option>
                <option value="daily">Minden nap</option>
                <option value="weekly">Minden héten</option>
                <option value="workdays">Munkanapokon (H-P)</option>
              </select>
            </div>

            <button type="button" onClick={() => setPriority(priority === 'fontos' ? 'normál' : 'fontos')} className={`w-full p-4 rounded-2xl text-xs font-black border-2 ${priority === 'fontos' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30' : 'bg-white text-slate-400 border-slate-100'}`}>
              {priority === 'fontos' ? '⚠️ KIEMELTEN FONTOS' : 'NORMÁL PRIORITÁS'}
            </button>

            <button className="w-full bg-black text-white p-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl">
              {editId ? 'MÓDOSÍTÁS MENTÉSE' : 'MENTÉS A NAPLÓBA'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* LISTA */}
      <div className="space-y-3">
        {currentDayEvents.length === 0 ? (
          <p className="text-slate-600 italic text-sm text-center py-4">Nincs bejegyzés erre a napra.</p>
        ) : (
          currentDayEvents.map(e => (
            <div key={e.id} className={`group p-4 rounded-3xl border flex items-center justify-between ${e.is_duty ? 'bg-blue-600/10 border-blue-500/20 shadow-inner' : e.priority === 'fontos' ? 'bg-red-600/10 border-red-500/20' : 'bg-slate-900/40 border-slate-800/50'}`}>
              <div className="flex gap-4 items-center flex-1 cursor-pointer" onClick={() => handleEditClick(e)}>
                <span className="text-xs font-black text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{e.event_time.substring(0,5)}</span>
                <div>
                  <h4 className="text-md font-bold text-white flex items-center gap-2">
                    {e.is_duty && <Briefcase size={16} className="text-blue-400"/>}
                    {e.title} {e.recurrence !== 'none' && <RefreshCw size={12} className="text-emerald-500" />}
                  </h4>
                  <div className="flex gap-1.5 mt-2">
                    {e.member_names?.map((m: string) => <div key={m} className={`w-3 h-3 rounded-full shadow-md ${MEMBERS.find(x => x.name === m)?.color}`} />)}
                  </div>
                </div>
              </div>
              <button onClick={() => deleteEvent(e.id)} className="text-slate-600 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
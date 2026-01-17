"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Plus, X, Trash2, ChevronLeft, ChevronRight, Target, AlertCircle } from 'lucide-react';

export default function FamilyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pivotDate, setPivotDate] = useState(new Date());

  const [title, setTitle] = useState('');
  const [member, setMember] = useState('Zsolt');
  const [time, setTime] = useState('12:00');
  const [priority, setPriority] = useState('normál');

  // 7 nap generálása: a pivotDate az első nap
  const getVisibleDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(pivotDate);
      d.setDate(pivotDate.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const shiftWeek = (direction: number) => {
    const newPivot = new Date(pivotDate);
    newPivot.setDate(pivotDate.getDate() + (direction * 7));
    setPivotDate(newPivot);
  };

  const jumpToToday = () => {
    const today = new Date();
    setPivotDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_time', { ascending: true });
    if (!error) setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    const { error } = await supabase.from('events').insert([{ 
      title, event_date: selectedDate, event_time: time, member_name: member, priority, category: 'általános' 
    }]);
    if (!error) { setTitle(''); setPriority('normál'); setShowAddForm(false); fetchEvents(); }
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    fetchEvents();
  };

  const filteredEvents = events.filter(e => e.event_date === selectedDate);
  const getMemberColor = (name: string) => {
    const colors: any = { 'Andrea': 'bg-pink-500', 'Zsolt': 'bg-blue-500', 'Adél': 'bg-purple-500', 'Zsombor': 'bg-orange-500' };
    return colors[name] || 'bg-slate-500';
  };

  // Megnézzük, van-e fontos esemény az adott napon
  const hasImportantEvent = (dateStr: string) => {
    return events.some(e => e.event_date === dateStr && e.priority === 'fontos');
  };

  return (
    <div className="space-y-6">
      {/* NAPTÁR NAVIGÁCIÓ & HÓNAP KIJELZÉS */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-white capitalize">
              {pivotDate.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => shiftWeek(-1)} className="p-2 bg-slate-900 rounded-lg border border-slate-800"><ChevronLeft size={18} /></button>
            <button onClick={jumpToToday} className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20"><Target size={18} /></button>
            <button onClick={() => shiftWeek(1)} className="p-2 bg-slate-900 rounded-lg border border-slate-800"><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* 7 NAPOS KOMPAKT CSÚSZKA (Mobilon is 7 nap) */}
        <div className="flex justify-between gap-1">
          {getVisibleDays().map((date) => {
            const dateStr = date.toISOString().split('T')[0];
            const isActive = dateStr === selectedDate;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const important = hasImportantEvent(dateStr);

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-1 min-w-0 h-16 rounded-xl flex flex-col items-center justify-center transition-all relative ${
                  isActive ? 'bg-emerald-500 text-white shadow-lg scale-105 z-10' : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                <span className="text-[9px] uppercase font-black truncate w-full text-center">{date.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
                <span className="text-base font-black">{date.getDate()}</span>
                
                {/* Fontos esemény jelző */}
                {important && (
                  <div className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-slate-950"></span>
                  </div>
                )}
                {isToday && !isActive && <div className="absolute bottom-1 w-1 h-1 bg-emerald-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* FEJLÉC */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-300">
          {new Date(selectedDate).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })}
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-500 text-white p-2 rounded-full shadow-lg"
        >
          {showAddForm ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {/* ÚJ ESEMÉNY FORM PRIORITÁSSAL */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            onSubmit={handleAddEvent}
            className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-2xl"
          >
            <input 
              type="text" placeholder="Mi a program?" value={title} autoFocus
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none focus:border-emerald-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" />
              <select value={member} onChange={(e) => setMember(e.target.value)} className="bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none">
                {['Andrea', 'Zsolt', 'Adél', 'Zsombor'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            {/* Prioritás választó */}
            <div className="flex gap-2">
              <button 
                type="button" onClick={() => setPriority('normál')}
                className={`flex-1 p-2 rounded-xl text-xs font-bold transition-all ${priority === 'normál' ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}
              >
                NORMÁL
              </button>
              <button 
                type="button" onClick={() => setPriority('fontos')}
                className={`flex-1 p-2 rounded-xl text-xs font-bold transition-all ${priority === 'fontos' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-950 text-slate-600 border border-slate-800'}`}
              >
                ⚠️ FONTOS
              </button>
            </div>

            <button className="w-full bg-emerald-500 text-white p-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20">
              Mentés
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* IDŐVONAL */}
      <div className="space-y-3 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
        <AnimatePresence mode='popLayout'>
          {filteredEvents.map((event) => (
            <motion.div
              key={event.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="relative pl-12"
            >
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-4 border-slate-950 flex items-center justify-center text-[10px] font-black z-10 ${getMemberColor(event.member_name)} text-white`}>
                {event.event_time.substring(0, 5)}
              </div>
              
              <div className={`p-4 rounded-2xl flex items-center justify-between border ${event.priority === 'fontos' ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/5' : 'bg-slate-900/40 border-slate-800/50'}`}>
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      {event.title}
                      {event.priority === 'fontos' && <AlertCircle size={14} className="text-red-500" />}
                    </h3>
                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{event.member_name}</span>
                  </div>
                </div>
                <button onClick={() => deleteEvent(event.id)} className="text-slate-600 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
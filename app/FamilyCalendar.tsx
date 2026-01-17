"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Plus, X, Trash2, ChevronLeft, ChevronRight, Target } from 'lucide-react';

export default function FamilyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Naptár navigációs állapotok
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pivotDate, setPivotDate] = useState(new Date()); // Ekkörül mutatjuk a hetet

  // Form állapotok
  const [title, setTitle] = useState('');
  const [member, setMember] = useState('Zsolt');
  const [time, setTime] = useState('12:00');

  // Dinamikus hét generálása a pivotDate alapján
  const getVisibleDays = () => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
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
      title, event_date: selectedDate, event_time: time, member_name: member, category: 'általános' 
    }]);
    if (!error) { setTitle(''); setShowAddForm(false); fetchEvents(); }
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

  return (
    <div className="space-y-8">
      {/* NAPTÁR NAVIGÁCIÓ */}
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center px-2">
          <div className="flex gap-2">
            <button onClick={() => shiftWeek(-1)} className="p-2 bg-slate-900 rounded-full border border-slate-800 hover:bg-slate-800 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => shiftWeek(1)} className="p-2 bg-slate-900 rounded-full border border-slate-800 hover:bg-slate-800 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <button 
            onClick={jumpToToday}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full border border-emerald-400/20"
          >
            <Target size={14} /> Ma
          </button>
        </div>

        {/* HETI CSÚSZKA ANIMÁCIÓVAL */}
        <div className="flex justify-between items-center gap-2 overflow-x-hidden py-2">
          <AnimatePresence mode="wait">
            <motion.div 
              key={pivotDate.toISOString()}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex justify-between w-full gap-2"
            >
              {getVisibleDays().map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const isActive = dateStr === selectedDate;
                const isToday = new Date().toISOString().split('T')[0] === dateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex-1 min-w-[50px] h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${
                      isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 scale-105' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">{date.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
                    <span className="text-xl font-black">{date.getDate()}</span>
                    {isToday && !isActive && <div className="absolute bottom-2 w-1 h-1 bg-emerald-500 rounded-full" />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* FEJLÉC */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tight">
            {new Date(selectedDate).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' })}
          </h2>
          <p className="text-slate-500 text-sm font-medium">{filteredEvents.length} esemény bejegyezve</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className={`p-4 rounded-full transition-all shadow-xl ${showAddForm ? 'bg-slate-800 text-white rotate-0' : 'bg-emerald-500 text-white hover:scale-110'}`}
        >
          {showAddForm ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      {/* ÚJ ESEMÉNY FORM (Változatlan kényelmi funkciókkal) */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleAddEvent}
            className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] space-y-4 shadow-2xl border-t-emerald-500/50"
          >
            <input 
              type="text" placeholder="Mi a program?" value={title} autoFocus
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-4 rounded-2xl focus:border-emerald-500 focus:ring-0 text-lg outline-none transition-all"
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none"
              />
              <select 
                value={member} onChange={(e) => setMember(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none"
              >
                {['Andrea', 'Zsolt', 'Adél', 'Zsombor'].map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
              </select>
            </div>
            <button className="w-full bg-emerald-500 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
              Rögzítés a naptárba
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* IDŐVONAL */}
      <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
        <AnimatePresence mode='popLayout'>
          {filteredEvents.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
              <div className="inline-flex p-4 rounded-full bg-slate-900/50 mb-4 text-slate-700">
                <CalendarIcon size={32} />
              </div>
              <p className="text-slate-600 font-medium italic">Erre a napra még nem írtatok semmit.</p>
            </motion.div>
          ) : (
            filteredEvents.map((event) => (
              <motion.div
                key={event.id} layout
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                className="relative pl-12 group"
              >
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-4 border-slate-950 flex items-center justify-center text-[11px] font-black z-10 shadow-xl ${getMemberColor(event.member_name)} text-white`}>
                  {event.event_time.substring(0, 5)}
                </div>
                
                <div className="bg-slate-900/40 border border-slate-800/50 p-5 rounded-3xl flex items-center justify-between group-hover:bg-slate-900 transition-all group-hover:border-slate-700">
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg leading-tight">{event.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`w-2 h-2 rounded-full ${getMemberColor(event.member_name)}`} />
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{event.member_name}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteEvent(event.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-500 transition-all transform hover:scale-110">
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
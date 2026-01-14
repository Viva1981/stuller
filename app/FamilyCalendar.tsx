"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Plus, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function FamilyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Form állapotok
  const [title, setTitle] = useState('');
  const [member, setMember] = useState('Zsolt');
  const [time, setTime] = useState('12:00');

  // Hét napjainak generálása
  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    for (let i = -2; i < 5; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
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

    const { error } = await supabase
      .from('events')
      .insert([{ 
        title, 
        event_date: selectedDate, 
        event_time: time,
        member_name: member, 
        category: 'általános' 
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

  const filteredEvents = events.filter(e => e.event_date === selectedDate);

  const getMemberColor = (name: string) => {
    const colors: any = {
      'Andrea': 'bg-pink-500', 'Zsolt': 'bg-blue-500',
      'Adél': 'bg-purple-500', 'Zsombor': 'bg-orange-500'
    };
    return colors[name] || 'bg-slate-500';
  };

  return (
    <div className="space-y-8">
      {/* 1. HETI CSÚSZKA */}
      <div className="flex justify-between items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
        {getWeekDays().map((date) => {
          const dateStr = date.toISOString().split('T')[0];
          const isActive = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
                isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 scale-110' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              <span className="text-[10px] uppercase font-bold">{date.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
              <span className="text-xl font-black">{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* 2. FEJLÉC ÉS HOZZÁADÁS GOMB */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {new Date(selectedDate).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-slate-500 text-sm">{filteredEvents.length} esemény mára</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-white text-black p-3 rounded-full hover:scale-110 transition-transform shadow-xl"
        >
          {showAddForm ? <X size={20} /> : <Plus size={20} />}
        </button>
      </div>

      {/* 3. ÚJ ESEMÉNY FORM */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            onSubmit={handleAddEvent}
            className="bg-emerald-500 p-6 rounded-[2rem] space-y-4 shadow-2xl text-white"
          >
            <input 
              type="text" placeholder="Mi a program?" value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-emerald-400/50 border-none placeholder:text-white/70 p-4 rounded-xl focus:ring-0 text-lg font-bold"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase opacity-70 ml-2">Időpont</label>
                <input 
                  type="time" value={time} onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-emerald-400/50 border-none p-3 rounded-xl focus:ring-0 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase opacity-70 ml-2">Kié?</label>
                <select 
                  value={member} onChange={(e) => setMember(e.target.value)}
                  className="w-full bg-emerald-400/50 border-none p-3 rounded-xl focus:ring-0 font-bold"
                >
                  {['Andrea', 'Zsolt', 'Adél', 'Zsombor'].map(m => <option key={m} value={m} className="text-black">{m}</option>)}
                </select>
              </div>
            </div>
            <button className="w-full bg-black text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-900 transition-colors">Mentés a naptárba</button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 4. IDŐVONAL LISTA */}
      <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
        <AnimatePresence mode='popLayout'>
          {filteredEvents.length === 0 ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-600 italic text-center py-10">Mára nincs semmi terved. Élvezd a nyugalmat!</motion.p>
          ) : (
            filteredEvents.map((event) => (
              <motion.div
                key={event.id} layout
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                className="relative pl-12 group"
              >
                {/* Időpont kör az idővonalon */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-4 border-slate-950 flex items-center justify-center text-[10px] font-bold z-10 ${getMemberColor(event.member_name)}`}>
                  {event.event_time.substring(0, 5)}
                </div>
                
                <div className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between group-hover:bg-slate-900 transition-colors">
                  <div>
                    <h3 className="font-bold text-white">{event.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter flex items-center gap-1">
                        <User size={10} /> {event.member_name}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteEvent(event.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-400 transition-all">
                    <Trash2 size={16} />
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
"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Tag, Plus, X, Trash2 } from 'lucide-react';

export default function FamilyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [title, setTitle] = useState('');
  const [member, setMember] = useState('Zsolt');
  const [date, setDate] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });
    
    if (error) {
      console.error("Hiba az adatok lekérésekor:", error.message);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) {
      alert("Kérlek töltsd ki a címet és a dátumot!");
      return;
    }

    const { error } = await supabase
      .from('events')
      .insert([{ 
        title: title, 
        event_date: date, 
        member_name: member, 
        category: 'általános' 
      }]);

    if (error) {
      alert("Hiba a mentés során: " + error.message);
    } else {
      setTitle('');
      setDate('');
      setShowAddForm(false);
      fetchEvents();
    }
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) {
      alert("Hiba a törlésnél: " + error.message);
    } else {
      fetchEvents();
    }
  };

  const getMemberColor = (name: string) => {
    const colors: any = {
      'Andrea': 'bg-pink-500',
      'Zsolt': 'bg-blue-500',
      'Adél': 'bg-purple-500',
      'Zsombor': 'bg-orange-500'
    };
    return colors[name] || 'bg-slate-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="text-emerald-400" /> Közelgő Események
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-emerald-900/20"
        >
          {showAddForm ? <X size={18} /> : <Plus size={18} />}
          {showAddForm ? 'Bezár' : 'Új Esemény'}
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleAddEvent}
            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-black">
              <input 
                type="text" placeholder="Mi történik?" 
                value={title} onChange={(e) => setTitle(e.target.value)}
                className="bg-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select 
                value={member} onChange={(e) => setMember(e.target.value)}
                className="bg-white p-3 rounded-xl focus:outline-none"
              >
                {['Andrea', 'Zsolt', 'Adél', 'Zsombor'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input 
                type="date" 
                value={date} onChange={(e) => setDate(e.target.value)}
                className="bg-white p-3 rounded-xl focus:outline-none"
              />
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-500 transition-colors shadow-lg">
              MENTÉS MOST
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Adatok frissítése...</div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl text-slate-500 italic">
            Még nincs esemény a naptárban.
          </div>
        ) : (
          <AnimatePresence mode='popLayout'>
            {events.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md relative group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-12 rounded-full ${getMemberColor(event.member_name)}`} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      <Clock size={14} /> {new Date(event.event_date).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-4 py-1 rounded-full text-xs font-bold text-white shadow-lg ${getMemberColor(event.member_name)}`}>
                    {event.member_name}
                  </span>
                  <button 
                    onClick={() => deleteEvent(event.id)}
                    className="p-2 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, User, Tag } from 'lucide-react';

export default function FamilyCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
      
      if (!error) setEvents(data || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const getMemberColor = (name: string) => {
    const colors: any = {
      'Andrea': 'bg-pink-500',
      'Zsolt': 'bg-blue-500',
      'Adél': 'bg-purple-500',
      'Zsombor': 'bg-orange-500'
    };
    return colors[name] || 'bg-slate-500';
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Naptár töltése...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="text-emerald-400" /> Közelgő Események
        </h2>
      </div>

      <div className="grid gap-4">
        <AnimatePresence>
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.01 }}
              className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md"
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
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Tag size={12} /> {event.category}
                </span>
                <span className={`px-4 py-1 rounded-full text-xs font-bold text-white shadow-lg flex items-center gap-1 ${getMemberColor(event.member_name)}`}>
                  <User size={12} /> {event.member_name}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
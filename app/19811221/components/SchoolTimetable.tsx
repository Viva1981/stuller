"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/app/supabase';
import { Edit2, Save, X, ChevronDown, ChevronUp, Calendar as CalendarIcon, Clock, AlertCircle } from 'lucide-react';

const BELL_SCHEDULE = [
  { id: 0, start: '07:10', end: '07:55' },
  { id: 1, start: '08:00', end: '08:45' },
  { id: 2, start: '08:55', end: '09:40' },
  { id: 3, start: '09:55', end: '10:40' },
  { id: 4, start: '10:55', end: '11:40' },
  { id: 5, start: '11:50', end: '12:35' },
  { id: 6, start: '12:45', end: '13:30' },
  { id: 7, start: '13:35', end: '14:20' },
  { id: 8, start: '14:25', end: '15:10' },
];

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'];

interface TimetableItem {
  id?: string;
  day_index: number;
  period_index: number;
  subject: string;
  owner: string;
}

export default function SchoolTimetable({ owner }: { owner: string }) {
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false); 
  const [activeDay, setActiveDay] = useState(0); // Mobilon melyik nap aktív (0=Hétfő)
  
  // Modal állapota
  const [selectedSlot, setSelectedSlot] = useState<TimetableItem | null>(null);
  const [examDate, setExamDate] = useState('');
  const [examType, setExamType] = useState('Témazáró');
  const [examPriority, setExamPriority] = useState<'normál' | 'fontos'>('normál');
  const [isSavingExam, setIsSavingExam] = useState(false);

  // Az aktuális nap beállítása alapértelmezettnek
  useEffect(() => {
    const today = new Date().getDay(); // 0=Vasárnap, 1=Hétfő...
    if (today >= 1 && today <= 5) {
        setActiveDay(today - 1);
    } else {
        setActiveDay(0); // Hétvégén Hétfő
    }
  }, []);

  useEffect(() => {
    fetchTimetable();
  }, [owner]);

  const fetchTimetable = async () => {
    const { data } = await supabase.from('school_timetable').select('*').eq('owner', owner);
    if (data) setTimetable(data);
    setLoading(false);
  };

  const handleSaveCell = async (dayIdx: number, periodIdx: number, value: string) => {
    if (!value.trim()) return;
    const existing = timetable.find(t => t.day_index === dayIdx && t.period_index === periodIdx);
    if (existing) {
        await supabase.from('school_timetable').update({ subject: value }).eq('id', existing.id);
    } else {
        await supabase.from('school_timetable').insert({
            owner, day_index: dayIdx, period_index: periodIdx, subject: value
        });
    }
    fetchTimetable();
  };

  const handleExamSync = async () => {
    if (!selectedSlot || !examDate) return;
    setIsSavingExam(true);
    const scheduleTime = BELL_SCHEDULE.find(b => b.id === selectedSlot.period_index)?.start || '08:00';
    try {
        const title = `${examType}: ${selectedSlot.subject}`;
        const { error } = await supabase.from('events').insert({
                title: title, event_date: examDate, event_time: scheduleTime, 
                member_names: [owner], priority: examPriority, category: 'iskola', 
                recurrence: 'none', is_duty: false
            });
        if (error) throw error;
        setSelectedSlot(null); setExamDate(''); setExamPriority('normál');
    } catch (e) {
        console.error(e); alert('Hiba történt a mentéskor.');
    } finally {
        setIsSavingExam(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-2">
        {/* FEJLÉC */}
        <div 
            className="flex items-center justify-between bg-[#0a0c10] p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
        >
            <div className="flex items-center gap-4 flex-1" onClick={() => setIsOpen(!isOpen)}>
                <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                    {isOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
                </div>
                <h2 className="text-xl font-black italic tracking-wider text-white uppercase">
                    {owner} Órarendje
                </h2>
            </div>
            
            {isOpen && (
                 <button onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
                 className={`p-3 rounded-xl transition-all ${isEditing ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}
             >
                 {isEditing ? <Save size={20} /> : <Edit2 size={20} />}
             </button>
            )}
        </div>

        {/* LENYÍLÓ TARTALOM */}
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                >
                    <div className="pb-4 pt-2">
                        
                        {/* MOBIL NÉZET: NAP VÁLASZTÓ TABOK (Csak mobilon látszik) */}
                        <div className="md:hidden flex gap-1 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                            {DAYS.map((day, idx) => (
                                <button
                                    key={day}
                                    onClick={() => setActiveDay(idx)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                        activeDay === idx 
                                            ? 'bg-amber-500 text-black shadow-lg' 
                                            : 'bg-white/5 text-white/40'
                                    }`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>

                        {/* GRID RENDSZER (Reszponzív) */}
                        {/* Desktop: 6 oszlop | Mobil: 2 oszlop (Idő + Aktuális nap) */}
                        <div className="grid gap-2 md:grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] grid-cols-[auto_1fr]">
                            
                            {/* Fejléc sor */}
                            <div className="bg-white/5 rounded-xl p-3 flex items-center justify-center border border-white/5">
                                <Clock size={20} className="text-amber-500" />
                            </div>

                            {/* Desktopon minden nap látszik, mobilon csak az aktív */}
                            {DAYS.map((day, idx) => (
                                <div key={day} className={`bg-black/40 rounded-xl p-3 text-center border border-white/5 ${
                                    // Mobilon elrejtjük, ha nem az aktív nap
                                    activeDay !== idx ? 'hidden md:block' : ''
                                }`}>
                                    <span className="text-sm font-black text-white/70 uppercase tracking-wider">{day}</span>
                                </div>
                            ))}

                            {/* Sorok (Órák) */}
                            {BELL_SCHEDULE.map((bell) => (
                                <>
                                    {/* Idő oszlop */}
                                    <div className="bg-white/5 rounded-xl p-2 flex flex-col items-center justify-center text-xs text-white/50 border border-white/5 w-20 md:w-24">
                                        <span className="font-bold text-lg text-white/80">{bell.id}.</span>
                                        <span className="opacity-50">{bell.start}</span>
                                    </div>

                                    {/* Napok oszlopai */}
                                    {DAYS.map((_, dayIdx) => {
                                        const subject = timetable.find(t => t.day_index === dayIdx && t.period_index === bell.id)?.subject || '';
                                        const isVisible = activeDay === dayIdx;

                                        return (
                                            <motion.div
                                                key={`${dayIdx}-${bell.id}`}
                                                layout
                                                onClick={() => {
                                                    if (!isEditing && subject) setSelectedSlot({ day_index: dayIdx, period_index: bell.id, subject, owner });
                                                }}
                                                className={`relative min-h-[60px] rounded-xl border border-white/5 p-2 flex items-center justify-center text-center transition-colors ${
                                                    // Láthatóság kezelése
                                                    !isVisible ? 'hidden md:flex' : 'flex'
                                                } ${
                                                    isEditing 
                                                        ? 'bg-white/5 hover:bg-white/10 cursor-text' 
                                                        : subject 
                                                            ? 'bg-gradient-to-br from-white/10 to-transparent hover:border-amber-500/50 cursor-pointer group' 
                                                            : 'bg-transparent'
                                                }`}
                                            >
                                                {isEditing ? (
                                                    <input 
                                                        type="text" 
                                                        defaultValue={subject}
                                                        className="w-full h-full bg-transparent text-center text-sm focus:outline-none text-white placeholder-white/20 font-bold"
                                                        placeholder="-"
                                                        onBlur={(e) => handleSaveCell(dayIdx, bell.id, e.target.value)}
                                                    />
                                                ) : (
                                                    <span className="font-bold text-sm text-white/90 group-hover:scale-105 transition-transform">
                                                        {subject}
                                                    </span>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* MODAL: VIZSGA HOZZÁADÁSA (Ugyanaz maradt) */}
        <AnimatePresence>
            {selectedSlot && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#0f1115] w-full max-w-md rounded-[2rem] border border-white/10 p-8 shadow-2xl relative">
                        <button onClick={() => setSelectedSlot(null)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/50 hover:text-white"><X size={20} /></button>
                        <h3 className="text-2xl font-black text-white italic tracking-wide mb-1">MI LESZ?</h3>
                        <p className="text-amber-500 font-bold text-lg mb-6">{selectedSlot.subject} <span className="text-white/30 text-sm ml-2">({BELL_SCHEDULE.find(b => b.id === selectedSlot.period_index)?.start})</span></p>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] block mb-3 font-bold">Esemény típusa</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Témazáró', 'Dolgozat', 'Felelés', 'Házi feladat'].map(type => (
                                        <button key={type} onClick={() => setExamType(type)} className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all uppercase ${examType === type ? 'bg-amber-500 border-amber-500 text-black' : 'bg-transparent border-white/10 text-white/60'}`}>{type}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] block mb-3 font-bold">Mikor?</label>
                                <div className="relative">
                                    <input type="date" value={examDate} onClick={(e) => { try { (e.target as HTMLInputElement).showPicker(); } catch (err) {} }} onChange={(e) => setExamDate(e.target.value)} className="w-full bg-[#050608] border-2 border-white/10 rounded-xl p-4 text-white font-bold focus:border-amber-500 focus:outline-none transition-colors cursor-pointer" />
                                    <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" size={20} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] block mb-3 font-bold">Prioritás</label>
                                <button onClick={() => setExamPriority(examPriority === 'fontos' ? 'normál' : 'fontos')} className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl font-black text-xs border-2 transition-all uppercase tracking-widest ${examPriority === 'fontos' ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/10 text-white/50'}`}><AlertCircle size={18} /> {examPriority === 'fontos' ? 'Kiemelt fontosságú' : 'Normál esemény'}</button>
                            </div>
                            <button onClick={handleExamSync} disabled={isSavingExam || !examDate} className="w-full h-14 bg-emerald-500 rounded-2xl font-black text-black hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95">{isSavingExam ? 'Mentés...' : 'Rögzítés a Naptárba'} {!isSavingExam && <CalendarIcon size={18} />}</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/app/supabase'; // Figyelj az importra, lehet ../../supabase kell
import { Edit2, Save, X, Plus, Calendar as CalendarIcon, Clock, Bell } from 'lucide-react';

// Csengetési rend (A fotó alapján)
const BELL_SCHEDULE = [
  { id: 1, start: '08:00', end: '08:45' },
  { id: 2, start: '08:55', end: '09:40' },
  { id: 3, start: '09:55', end: '10:40' },
  { id: 4, start: '10:55', end: '11:40' },
  { id: 5, start: '11:50', end: '12:35' },
  { id: 6, start: '12:45', end: '13:30' },
  { id: 7, start: '13:35', end: '14:20' }, // Saccolt 7. óra
  { id: 8, start: '14:25', end: '15:10' }, // Saccolt 8. óra
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
  
  // Modal állapota (Vizsga rögzítése)
  const [selectedSlot, setSelectedSlot] = useState<TimetableItem | null>(null);
  const [examDate, setExamDate] = useState('');
  const [examType, setExamType] = useState('Témazáró');
  const [isSavingExam, setIsSavingExam] = useState(false);

  useEffect(() => {
    fetchTimetable();
  }, [owner]);

  const fetchTimetable = async () => {
    const { data, error } = await supabase
      .from('school_timetable')
      .select('*')
      .eq('owner', owner);
    
    if (data) setTimetable(data);
    setLoading(false);
  };

  const handleSaveCell = async (dayIdx: number, periodIdx: number, value: string) => {
    if (!value.trim()) return; // Üreset nem mentünk (vagy törlés logika kéne)

    // Megnézzük van-e már ilyen
    const existing = timetable.find(t => t.day_index === dayIdx && t.period_index === periodIdx);

    if (existing) {
        // Update
        await supabase
            .from('school_timetable')
            .update({ subject: value })
            .eq('id', existing.id);
    } else {
        // Insert
        await supabase
            .from('school_timetable')
            .insert({
                owner,
                day_index: dayIdx,
                period_index: periodIdx,
                subject: value
            });
    }
    fetchTimetable(); // Frissítés
  };

  const handleExamSync = async () => {
    if (!selectedSlot || !examDate) return;
    setIsSavingExam(true);

    try {
        const title = `${examType}: ${selectedSlot.subject} (${owner})`;
        
        // Beszúrás a fő naptárba
        const { error } = await supabase
            .from('calendar_events')
            .insert({
                title: title,
                start_time: `${examDate}T08:00:00`, // Default reggel 8
                end_time: `${examDate}T09:00:00`,
                is_important: true, // Fontos, mert TZ!
                family_members: [owner], // Csak az adott gyerekhez rendeljük
                color: owner === 'Adél' ? 'purple' : 'teal' // Színkód
            });

        if (error) throw error;
        
        alert('Sikeresen rögzítve a naptárba!');
        setSelectedSlot(null);
        setExamDate('');
    } catch (e) {
        console.error(e);
        alert('Hiba történt a mentéskor.');
    } finally {
        setIsSavingExam(false);
    }
  };

  if (loading) return <div className="text-white/50 text-center p-10">Órarend betöltése...</div>;

  return (
    <div className="space-y-6">
        {/* FEJLÉC */}
        <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl backdrop-blur-md border border-white/10">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full ${owner === 'Adél' ? 'bg-purple-500/20 text-purple-400' : 'bg-teal-500/20 text-teal-400'}`}>
                    <CalendarIcon size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">{owner} Órarendje</h2>
                    <p className="text-xs text-white/50 uppercase tracking-widest">2025/2026 Tanév</p>
                </div>
            </div>
            
            <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isEditing ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
            >
                {isEditing ? <Save size={18} /> : <Edit2 size={18} />}
                {isEditing ? 'Kész' : 'Szerkesztés'}
            </button>
        </div>

        {/* ÓRAREND GRID */}
        <div className="overflow-x-auto pb-4">
            <div className="min-w-[800px] grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2">
                
                {/* Fejléc sor */}
                <div className="bg-white/5 rounded-xl p-3 flex items-center justify-center border border-white/5">
                    <Clock size={20} className="text-amber-500" />
                </div>
                {DAYS.map((day, i) => (
                    <div key={day} className="bg-black/40 rounded-xl p-3 text-center border border-white/5">
                        <span className="text-sm font-black text-white/70 uppercase tracking-wider">{day}</span>
                    </div>
                ))}

                {/* Sorok (Órák) */}
                {BELL_SCHEDULE.map((bell) => (
                    <>
                        {/* Idő oszlop */}
                        <div className="bg-white/5 rounded-xl p-2 flex flex-col items-center justify-center text-xs text-white/50 border border-white/5 w-24">
                            <span className="font-bold text-lg text-white/80">{bell.id}.</span>
                            <span>{bell.start}</span>
                            <span className="w-full h-px bg-white/10 my-1"></span>
                            <span>{bell.end}</span>
                        </div>

                        {/* Napok oszlopai */}
                        {DAYS.map((_, dayIdx) => {
                            const subject = timetable.find(t => t.day_index === dayIdx && t.period_index === bell.id)?.subject || '';
                            
                            return (
                                <motion.div
                                    key={`${dayIdx}-${bell.id}`}
                                    layout
                                    onClick={() => {
                                        if (!isEditing && subject) setSelectedSlot({ day_index: dayIdx, period_index: bell.id, subject, owner });
                                    }}
                                    className={`relative min-h-[80px] rounded-xl border border-white/5 p-2 flex items-center justify-center text-center transition-colors ${
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
                                            className="w-full h-full bg-transparent text-center text-sm focus:outline-none text-white placeholder-white/20"
                                            placeholder="..."
                                            onBlur={(e) => handleSaveCell(dayIdx, bell.id, e.target.value)}
                                        />
                                    ) : (
                                        <>
                                            <span className="font-medium text-sm text-white/90 group-hover:scale-105 transition-transform">
                                                {subject}
                                            </span>
                                            {/* Hover effekt ha van tárgy */}
                                            {subject && (
                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </motion.div>
                            );
                        })}
                    </>
                ))}
            </div>
        </div>

        {/* MODAL: VIZSGA HOZZÁADÁSA */}
        <AnimatePresence>
            {selectedSlot && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                >
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-[#0f1115] w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-white">Esemény rögzítése</h3>
                                <p className="text-amber-500 font-medium">{selectedSlot.subject}</p>
                            </div>
                            <button onClick={() => setSelectedSlot(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Esemény típusa</label>
                                <div className="flex gap-2">
                                    {['Témazáró', 'Dolgozat', 'Felelés', 'Házi feladat'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setExamType(type)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                examType === type 
                                                    ? 'bg-amber-500 border-amber-500 text-black' 
                                                    : 'bg-transparent border-white/20 text-white/60'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-white/50 uppercase tracking-wider block mb-2">Dátum</label>
                                <input 
                                    type="date" 
                                    value={examDate}
                                    onChange={(e) => setExamDate(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <button 
                                onClick={handleExamSync}
                                disabled={isSavingExam || !examDate}
                                className="w-full h-12 bg-emerald-500 rounded-xl font-bold text-black hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSavingExam ? 'Mentés...' : 'Rögzítés a Naptárba'}
                                {!isSavingExam && <CalendarIcon size={18} />}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}
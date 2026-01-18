"use client";

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Eye, EyeOff, AlertCircle } from 'lucide-react';
import PushManager from './19811221/PushManager';

const MEMBERS = [
  { name: 'Andrea', email: 'demya1981@gmail.com', color: 'bg-pink-500 shadow-pink-500/50' },
  { name: 'Zsolt', email: 'stuller.zsolt@gmail.com', color: 'bg-blue-500 shadow-blue-500/50' },
  { name: 'Adél', email: 'stuller.adel@gmail.com', color: 'bg-purple-500 shadow-purple-500/50' },
  { name: 'Zsombor', email: 'stuller.zsombor@gmail.com', color: 'bg-orange-500 shadow-orange-500/50' }
];

export default function FamilyCalendar({ currentUser }: { currentUser: any }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showList, setShowList] = useState(false); // Új: csak kattintásra mutatjuk a listát
  const [view, setView] = useState<'day' | 'month'>('day');
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  
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
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [time, setTime] = useState('08:00');
  const [priority, setPriority] = useState('normál');
  const [recurrence, setRecurrence] = useState('none');

  const currentMemberName = MEMBERS.find(m => m.email === currentUser.email)?.name || '';

  useEffect(() => {
    setSelectedMembers([currentMemberName]);
    fetchEvents();
  }, [currentUser]);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase.from('events').select('*').order('event_time', { ascending: true });
    if (data) setEvents(data);
    setLoading(false);
  };

  const sendPushNotifications = async (eventTitle: string, eventTime: string, members: string[]) => {
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription_json');
    if (!subs || subs.length === 0) return;

    try {
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: subs,
          payload: {
            title: '🚨 FONTOS PROGRAM',
            body: `${members.join(', ')}: ${eventTitle} - ${eventTime}`,
            url: `/19811221`
          }
        })
      });
    } catch (err) {
      console.error('Push hiba:', err);
    }
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
      member_names: isDutyEvent ? ['Zsolt'] : selectedMembers, 
      priority: isDutyEvent ? 'normál' : priority, 
      is_duty: isDutyEvent,
      recurrence: isDutyEvent ? 'none' : recurrence
    };

    if (editId) {
      await supabase.from('events').update(eventData).eq('id', editId);
    } else {
      const { error } = await supabase.from('events').insert([eventData]);
      if (!error && priority === 'fontos' && !isDutyEvent) {
        await sendPushNotifications(finalTitle, finalTime, eventData.member_names);
      }
    }

    setTitle(''); setEditId(null); setRecurrence('none'); setPriority('normál'); setShowAddForm(false); 
    setShowList(true); // Hozzáadás után mutassuk a listát
    fetchEvents();
  };

  const jumpToToday = () => { 
    setPivotDate(new Date()); 
    setSelectedDate(formatDate(new Date()));
    setShowList(false); // Reseteljük a listát ugráskor
  };

  const shiftView = (direction: number) => {
    const newDate = new Date(pivotDate);
    view === 'month' ? newDate.setMonth(pivotDate.getMonth() + direction) : newDate.setDate(pivotDate.getDate() + (direction * 7));
    setPivotDate(newDate);
    setShowList(false); // Reseteljük a listát lapozáskor
  };

  const getEventsForDate = (dateStr: string) => {
    const targetDate = new Date(dateStr);
    let filtered = events.filter(e => {
      const eventStartDate = new Date(e.event_date);
      if (formatDate(eventStartDate) > dateStr) return false;
      if (e.event_date === dateStr) return true;
      if (e.recurrence === 'daily') return true;
      if (e.recurrence === 'weekly') return eventStartDate.getDay() === targetDate.getDay();
      if (e.recurrence === 'workdays') { const day = targetDate.getDay(); return day >= 1 && day <= 5; }
      return false;
    });
    if (filterMode === 'mine') filtered = filtered.filter(e => e.member_names?.includes(currentMemberName) || (e.is_duty && currentMemberName === 'Zsolt'));
    return filtered;
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

  const renderDayCard = (date: Date, isCompact: boolean = false) => {
    const dStr = formatDate(date);
    const active = dStr === selectedDate;
    const isToday = formatDate(new Date()) === dStr;
    const dayEvents = getEventsForDate(dStr);
    
    const hasImportant = dayEvents.some(e => e.priority === 'fontos');
    const hasDuty = dayEvents.some(e => e.is_duty);
    const memberEvents = dayEvents.filter(e => !e.is_duty);
    const activeMemberColors = MEMBERS.filter(m => memberEvents.some(e => e.member_names?.includes(m.name)));

    return (
      <button key={dStr} 
        onClick={() => {
          setSelectedDate(dStr);
          setShowList(true); // Csak itt aktiváljuk a listát!
        }}
        className={`relative flex-1 min-w-0 ${isCompact ? 'h-14' : 'h-20'} rounded-2xl flex flex-col items-center justify-center transition-all border shadow-sm ${
          active ? 'bg-white text-black border-white scale-105 z-10 shadow-xl' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-slate-700'
        }`}
      >
        <span className={`text-[8px] font-black uppercase ${active ? 'text-black/60' : 'text-slate-600'}`}>{date.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
        <span className="text-md font-black">{date.getDate()}</span>
        
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-0.5">
          {activeMemberColors.map(m => <div key={m.name} className={`w-1.5 h-1.5 rounded-full shadow-lg ${m.color}`} />)}
        </div>

        {hasImportant && (
          <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 z-20">
            <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 border border-slate-950"></span>
          </div>
        )}

        {hasDuty && <div className="absolute bottom-1 right-1 w-2 h-2 bg-blue-500 rounded-full shadow-md shadow-blue-500/50" />}
        {isToday && !active && <div className="absolute bottom-1 w-3 h-0.5 bg-emerald-500 rounded-full" />}
      </button>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      <div className="flex justify-end gap-2">
        <PushManager userId={currentUser.id} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => { setEditId(null); setTitle(''); setShowAddForm(!showAddForm); }} 
          className="flex-[2] bg-emerald-500 text-white font-black text-[10px] py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all uppercase"
        >
          {showAddForm ? <X size={16}/> : <Plus size={16}/>} {showAddForm ? 'Bezárás' : 'Új program'}
        </button>

        <button onClick={() => handleAddEvent("Ügyelet", true)} 
          className="flex-1 bg-blue-600 text-white font-black text-[10px] py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase"
        >
          Ügyelet
        </button>

        <button onClick={() => setFilterMode(filterMode === 'all' ? 'mine' : 'all')} 
          className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl border font-black text-[9px] transition-all uppercase ${filterMode === 'mine' ? 'bg-white text-black border-white' : 'bg-slate-900 text-slate-500 border-slate-800'}`}
        >
          {filterMode === 'mine' ? <EyeOff size={14}/> : <Eye size={14}/>}
          <span className="mt-0.5">{filterMode === 'mine' ? 'Saját' : 'Összes'}</span>
        </button>

        <button 
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
          className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-slate-500 hover:text-red-400 transition-colors"
        >
          <X size={16}/>
        </button>
      </div>

      <div className="flex justify-between items-center bg-slate-900/40 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="flex gap-1">
          <button onClick={() => shiftView(-1)} className="p-2 hover:bg-slate-800 rounded-xl text-white"><ChevronLeft size={18}/></button>
          <button onClick={jumpToToday} className="px-3 py-1 text-[10px] font-black text-emerald-400">MA</button>
          <button onClick={() => shiftView(1)} className="p-2 hover:bg-slate-800 rounded-xl text-white"><ChevronRight size={18}/></button>
        </div>
        <h3 className="text-[11px] font-black uppercase text-white tracking-[0.2em]">{pivotDate.toLocaleDateString('hu-HU', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => setView(view === 'day' ? 'month' : 'day')} className="flex items-center gap-2 text-[9px] font-black bg-white text-black px-3 py-2 rounded-xl uppercase">
          <CalendarIcon size={12}/> {view === 'day' ? 'Havi' : 'Heti'}
        </button>
      </div>

      <div className="min-h-[140px]">
        {view === 'day' ? (
          <div className="flex justify-between gap-1.5">
            {[...Array(7)].map((_, i) => { 
              const d = new Date(pivotDate); 
              const currentDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
              d.setDate(d.getDate() - currentDay + i); 
              return renderDayCard(d); 
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(35)].map((_, i) => { // 28-ról 35-re növelve
              const d = new Date(pivotDate.getFullYear(), pivotDate.getMonth(), 1);
              const startDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
              d.setDate(d.getDate() - startDay + i);
              return renderDayCard(d, true);
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={(e) => { e.preventDefault(); handleAddEvent(); }} className="bg-white p-6 rounded-[2.5rem] shadow-2xl text-black space-y-4"
          >
            <input type="text" placeholder="Mi a program?" value={title} onChange={e => setTitle(e.target.value)} autoFocus className="w-full bg-slate-100 p-4 rounded-2xl text-lg font-bold outline-none border-none focus:ring-2 focus:ring-emerald-500 transition-all" />
            <div className="flex flex-wrap gap-2">
              {MEMBERS.map(m => (
                <button key={m.name} type="button" onClick={() => setSelectedMembers(prev => prev.includes(m.name) ? prev.filter(x => x !== m.name) : [...prev, m.name])}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 transition-all ${selectedMembers.includes(m.name) ? `bg-black text-white border-black` : 'bg-white text-slate-300 border-slate-100'}`}
                >{m.name.toUpperCase()}</button>
              ))}
            </div>
            <div className="flex items-center gap-4">
               <button type="button" onClick={() => setPriority(priority === 'fontos' ? 'normál' : 'fontos')}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${priority === 'fontos' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}
               ><AlertCircle size={16} /> FONTOS</button>
               <input type="time" value={time} onChange={e => setTime(e.target.value)} className="flex-1 bg-slate-100 p-4 rounded-2xl font-bold outline-none" />
            </div>
            <select value={recurrence} onChange={e => setRecurrence(e.target.value)} className="w-full bg-slate-100 p-4 rounded-2xl font-bold outline-none border-none text-[10px] uppercase tracking-widest">
                <option value="none">Nincs ismétlés</option>
                <option value="daily">Minden nap</option>
                <option value="weekly">Minden héten</option>
                <option value="workdays">Munkanapokon</option>
            </select>
            <button className="w-full bg-black text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Mentés</button>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showList && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3 px-2 mb-2">
               <div className="h-px flex-1 bg-white/5" />
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Programok: {selectedDate}</span>
               <div className="h-px flex-1 bg-white/5" />
            </div>

            {getEventsForDate(selectedDate).length === 0 ? (
              <p className="text-slate-600 italic text-[11px] text-center py-6 tracking-wide uppercase font-bold">Nincs rögzített program erre a napra.</p>
            ) : (
              getEventsForDate(selectedDate).map(e => (
                <motion.div layout key={e.id} className={`group p-4 rounded-3xl border flex items-center justify-between transition-all ${e.is_duty ? 'bg-blue-600/10 border-blue-500/20 shadow-inner' : e.priority === 'fontos' ? 'bg-red-600/10 border-red-500/20 shadow-lg' : 'bg-slate-900/40 border-white/5'}`}>
                  <div className="flex gap-4 items-center flex-1 cursor-pointer" onClick={() => handleEditClick(e)}>
                    <span className="text-[9px] font-black text-slate-400 bg-white/5 px-2 py-1 rounded-lg tabular-nums">{e.event_time.substring(0,5)}</span>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
                        {e.is_duty ? '🛡️ ' : ''}{e.title} {e.recurrence !== 'none' && <RefreshCw size={10} className="text-emerald-500" />}
                        {e.priority === 'fontos' && <AlertCircle size={12} className="text-red-500" />}
                      </h4>
                      <div className="flex gap-1.5 mt-2">
                        {e.member_names?.map((m: string) => <div key={m} className={`w-2.5 h-2.5 rounded-full shadow-md ${MEMBERS.find(x => x.name === m)?.color}`} />)}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => supabase.from('events').delete().eq('id', e.id).then(() => fetchEvents())} className="text-slate-600 hover:text-red-500 p-2 transition-colors active:scale-90"><Trash2 size={16}/></button>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
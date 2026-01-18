'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Utensils, ChefHat, Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import { supabase } from '../supabase'

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
const MEMBERS = [
  { name: 'Andrea', color: 'bg-pink-500 shadow-pink-500/50' },
  { name: 'Zsolt', color: 'bg-blue-500 shadow-blue-500/50' },
  { name: 'Adél', color: 'bg-purple-500 shadow-purple-500/50' },
  { name: 'Zsombor', color: 'bg-orange-500 shadow-orange-500/50' }
]

export default function SundayChef({ userName }: { userName: string }) {
  const [meals, setMeals] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newMeal, setNewMeal] = useState({ day: 'Hétfő', meal_type: 'Vacsora', dish_name: '' })
  const [weekOffset, setWeekOffset] = useState(0) // 0 = ezen a héten, -1 = múlt héten

  // Aktuális hét hétfőjének kiszámítása
  const getMonday = (offset: number) => {
    const d = new Date()
    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7)
    return new Date(d.setDate(diff)).toISOString().split('T')[0]
  }

  const currentWeekStart = getMonday(weekOffset)

  useEffect(() => {
    fetchData()
  }, [weekOffset])

  async function fetchData() {
    const { data: mealData } = await supabase
      .from('meal_planner')
      .select('*')
      .eq('week_date', currentWeekStart)
      .order('id', { ascending: true })

    const { data: ratingData } = await supabase
      .from('meal_ratings')
      .select('*')

    if (mealData) setMeals(mealData)
    if (ratingData) setRatings(ratingData)
  }

  async function addMeal() {
    if (!newMeal.dish_name) return
    await supabase.from('meal_planner').insert([{ 
      ...newMeal, 
      chef_name: userName, 
      week_date: currentWeekStart 
    }])
    setNewMeal({ ...newMeal, dish_name: '' })
    setIsAdding(false)
    fetchData()
  }

  async function toggleRating(mealId: string, isLiked: boolean) {
    const existing = ratings.find(r => r.meal_id === mealId && r.member_name === userName)
    
    if (existing) {
      if (existing.is_liked === isLiked) {
        await supabase.from('meal_ratings').delete().eq('id', existing.id)
      } else {
        await supabase.from('meal_ratings').update({ is_liked: isLiked }).eq('id', existing.id)
      }
    } else {
      await supabase.from('meal_ratings').insert([{ meal_id: mealId, member_name: userName, is_liked: isLiked }])
    }
    fetchData()
  }

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 backdrop-blur-xl shadow-2xl overflow-hidden">
      
      {/* HEADER & HÉT VÁLTÓ */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 p-3 rounded-2xl">
            <ChefHat className="text-amber-500" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Sunday Chef</h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              <button onClick={() => setWeekOffset(prev => prev - 1)} className="hover:text-white"><ChevronLeft size={12}/></button>
              <span>{weekOffset === 0 ? 'Ezen a héten' : `${Math.abs(weekOffset)} héttel ezelőtt`}</span>
              <button onClick={() => setWeekOffset(prev => prev + 1)} className="hover:text-white"><ChevronRight size={12}/></button>
            </div>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAdding(!isAdding)}
          className={`p-4 rounded-2xl transition-all ${isAdding ? 'bg-slate-800 text-white' : 'bg-amber-500 text-black font-black'}`}
        >
          <Plus className={isAdding ? 'rotate-45 transition-transform' : ''} />
        </motion.button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8 space-y-4 bg-white/5 p-6 rounded-[2rem] border border-white/10"
          >
            <div className="grid grid-cols-2 gap-3">
              <select value={newMeal.day} onChange={(e) => setNewMeal({...newMeal, day: e.target.value})} className="bg-slate-800 border-none p-4 rounded-2xl text-white font-bold text-sm outline-none">
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={newMeal.meal_type} onChange={(e) => setNewMeal({...newMeal, meal_type: e.target.value})} className="bg-slate-800 border-none p-4 rounded-2xl text-white font-bold text-sm outline-none">
                <option value="Vacsora">Vacsora</option>
                <option value="Ebéd">Ebéd</option>
                <option value="Reggeli">Reggeli</option>
              </select>
            </div>
            <input type="text" placeholder="Mit főzzek vasárnap?" value={newMeal.dish_name} onChange={(e) => setNewMeal({...newMeal, dish_name: e.target.value})} className="w-full bg-slate-800 border-none p-4 rounded-2xl text-white font-bold outline-none placeholder:text-slate-600" />
            <button onClick={addMeal} className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all">HOZZÁADÁS</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MENÜ LISTA */}
      <div className="grid gap-6">
        {DAYS.map((day) => {
          const dayMeals = meals.filter(m => m.day === day)
          return (
            <div key={day} className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{day}</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              
              <AnimatePresence mode="popLayout">
                {dayMeals.map((m) => (
                  <motion.div key={m.id} layout initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="group bg-slate-800/30 border border-white/5 p-5 rounded-[2rem] transition-all hover:border-white/10"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-amber-500/10 p-3 rounded-2xl">
                          <Utensils size={18} className="text-amber-500" />
                        </div>
                        <div>
                          <p className="text-md font-bold text-white leading-tight">{m.dish_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{m.meal_type} • {m.chef_name} séf</p>
                        </div>
                      </div>
                      <button onClick={async () => { await supabase.from('meal_planner').delete().eq('id', m.id); fetchData() }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-500 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* ÉRTÉKELÉS SZEKCIÓ */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex gap-1.5">
                        {MEMBERS.map(member => {
                          const rating = ratings.find(r => r.meal_id === m.id && r.member_name === member.name)
                          if (!rating) return null
                          return (
                            <motion.div key={member.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                              className={`w-4 h-4 rounded-full ${member.color} flex items-center justify-center`}
                            >
                              {!rating.is_liked && <div className="w-full h-0.5 bg-black/50 rotate-45" />}
                            </motion.div>
                          )
                        })}
                      </div>
                      
                      <div className="flex gap-2">
                        <button onClick={() => toggleRating(m.id, true)} className={`p-2 rounded-xl transition-all ${ratings.find(r => r.meal_id === m.id && r.member_name === userName && r.is_liked) ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
                          <ThumbsUp size={14} />
                        </button>
                        <button onClick={() => toggleRating(m.id, false)} className={`p-2 rounded-xl transition-all ${ratings.find(r => r.meal_id === m.id && r.member_name === userName && !r.is_liked) ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
                          <ThumbsDown size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import { supabase } from '../supabase'

const MEMBERS = [
  { name: 'Andrea', color: 'bg-pink-500 shadow-pink-500/50' },
  { name: 'Zsolt', color: 'bg-blue-500 shadow-blue-500/50' },
  { name: 'Adél', color: 'bg-purple-500 shadow-purple-500/50' },
  { name: 'Zsombor', color: 'bg-orange-500 shadow-orange-500/50' }
]

export default function SundayChef({ userName }: { userName: string }) {
  const [meals, setMeals] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [newDish, setNewDish] = useState('')

  // Kiszámolja az aktuális vagy eltolt hét vasárnapját
  const getSundayDate = (offset: number) => {
    const d = new Date()
    const day = d.getDay() 
    const diffToSunday = (day === 0) ? 0 : (7 - day)
    const sunday = new Date(d.setDate(d.getDate() + diffToSunday + (offset * 7)))
    return sunday
  }

  const sundayDate = getSundayDate(weekOffset)
  const formattedSunday = sundayDate.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')
  const dbDateKey = sundayDate.toISOString().split('T')[0]

  useEffect(() => { fetchData() }, [weekOffset])

  async function fetchData() {
    const { data: mealData } = await supabase.from('meal_planner').select('*').eq('week_date', dbDateKey)
    const { data: ratingData } = await supabase.from('meal_ratings').select('*')
    if (mealData) setMeals(mealData)
    if (ratingData) setRatings(ratingData)
  }

  async function saveMeal(slotIndex: number) {
    if (!newDish) return
    await supabase.from('meal_planner').insert([{ 
      dish_name: newDish, 
      week_date: dbDateKey,
      chef_name: userName,
      day: slotIndex.toString(), // Slot azonosítóként használjuk a kötelező mezőt
      meal_type: 'Slot'
    }])
    setNewDish('')
    setEditingSlot(null)
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
    <div className="bg-[#0a0c10] border border-white/5 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col items-center mb-12">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">Sunday Chef</h2>
        <div className="flex items-center gap-6 bg-white/5 px-6 py-2 rounded-full border border-white/10">
          <button onClick={() => setWeekOffset(prev => prev - 1)} className="text-slate-500 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-xs font-black tracking-[0.3em] text-amber-500 uppercase">{formattedSunday}</span>
          <button onClick={() => setWeekOffset(prev => prev + 1)} className="text-slate-500 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* 8-AS RÁCS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 8 }).map((_, index) => {
          const meal = meals.find(m => m.day === index.toString())
          
          return (
            <motion.div 
              key={index}
              layout
              className={`relative h-32 rounded-[2rem] border transition-all duration-500 flex flex-col p-5 group ${
                meal ? 'bg-white/5 border-white/10' : 'bg-transparent border-dashed border-white/5 hover:border-white/20'
              }`}
            >
              {meal ? (
                <>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-bold text-white pr-8 leading-tight">{meal.dish_name}</span>
                    <button 
                      onClick={async () => { await supabase.from('meal_planner').delete().eq('id', meal.id); fetchData() }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Értékelő pöttyök */}
                  <div className="mt-auto flex justify-between items-center">
                    <div className="flex gap-1.5">
                      {MEMBERS.map(member => {
                        const rating = ratings.find(r => r.meal_id === meal.id && r.member_name === member.name)
                        if (!rating) return null
                        return (
                          <motion.div 
                            key={member.name} 
                            initial={{ scale: 0 }} 
                            animate={{ scale: 1 }}
                            className={`w-3.5 h-3.5 rounded-full ${member.color} flex items-center justify-center overflow-hidden`}
                          >
                            {!rating.is_liked && <div className="w-full h-[1px] bg-black/70 rotate-45" />}
                          </motion.div>
                        )
                      })}
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleRating(meal.id, true)} className={`p-1.5 rounded-lg ${ratings.find(r => r.meal_id === meal.id && r.member_name === userName && r.is_liked) ? 'text-emerald-500' : 'text-slate-600 hover:text-white'}`}>
                        <ThumbsUp size={14} />
                      </button>
                      <button onClick={() => toggleRating(meal.id, false)} className={`p-1.5 rounded-lg ${ratings.find(r => r.meal_id === meal.id && r.member_name === userName && !r.is_liked) ? 'text-red-500' : 'text-slate-600 hover:text-white'}`}>
                        <ThumbsDown size={14} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  {editingSlot === index ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-full gap-2">
                      <input 
                        autoFocus
                        value={newDish}
                        onChange={(e) => setNewDish(e.target.value)}
                        onBlur={() => { if(!newDish) setEditingSlot(null) }}
                        onKeyDown={(e) => e.key === 'Enter' && saveMeal(index)}
                        placeholder="Étel neve..."
                        className="flex-1 bg-white/10 border-none rounded-xl px-4 py-2 text-white text-xs font-bold outline-none"
                      />
                      <button onClick={() => saveMeal(index)} className="bg-amber-500 p-2 rounded-xl text-black">
                        <Plus size={16} />
                      </button>
                    </motion.div>
                  ) : (
                    <button 
                      onClick={() => setEditingSlot(index)}
                      className="text-slate-700 hover:text-slate-400 transition-colors"
                    >
                      <Plus size={24} />
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
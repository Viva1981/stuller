'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ChevronLeft, ThumbsUp, ThumbsDown, ChevronDown } from 'lucide-react'
import { supabase } from '../supabase'

type Meal = {
  id: string
  dish_name: string
}

type Rating = {
  id: string
  meal_id: string
  member_name: string
  is_liked: boolean
}

const MEMBERS = [
  { name: 'Andrea', color: 'bg-pink-500 shadow-pink-500/50' },
  { name: 'Zsolt', color: 'bg-blue-500 shadow-blue-500/50' },
  { name: 'Adél', color: 'bg-purple-500 shadow-purple-500/50' },
  { name: 'Zsombor', color: 'bg-orange-500 shadow-orange-500/50' }
]

export default function SundayChef({ userName }: { userName: string }) {
  const [meals, setMeals] = useState<Meal[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newDish, setNewDish] = useState('')

  const getSundayDate = (offset: number) => {
    const d = new Date()
    const day = d.getDay()
    const diffToSunday = day === 0 ? 0 : 7 - day
    return new Date(d.setDate(d.getDate() + diffToSunday + offset * 7))
  }

  const sundayDate = getSundayDate(weekOffset)
  const formattedSunday = sundayDate
    .toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '.')
  const dbDateKey = sundayDate.toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    const { data: mealData } = await supabase.from('meal_planner').select('*').eq('week_date', dbDateKey)
    const { data: ratingData } = await supabase.from('meal_ratings').select('*')
    if (mealData) setMeals(mealData as Meal[])
    if (ratingData) setRatings(ratingData as Rating[])
  }, [dbDateKey])

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchData()
    }, 0)
    return () => clearTimeout(initTimer)
  }, [fetchData])

  async function saveMeal() {
    if (!newDish) return
    await supabase.from('meal_planner').insert([
      {
        dish_name: newDish,
        week_date: dbDateKey,
        chef_name: userName,
        day: Date.now().toString(),
        meal_type: 'Slot'
      }
    ])
    setNewDish('')
    setIsAdding(false)
    fetchData()
  }

  async function toggleRating(mealId: string, isLiked: boolean) {
    const existing = ratings.find((r) => r.meal_id === mealId && r.member_name === userName)
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
    <div className="bg-[#0a0c10]/60 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-md transition-all">
      <div className="flex items-center justify-between p-4 px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3">
            <span className="text-xs font-black tracking-[0.2em] text-white uppercase">Menü</span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown size={16} className="text-amber-500" />
            </motion.div>
          </button>

          <div className="flex items-center gap-3 bg-white/5 px-3 py-1 rounded-full border border-white/10">
            <button onClick={() => setWeekOffset((prev) => prev - 1)} className="text-slate-500 hover:text-white">
              <ChevronLeft size={14} />
            </button>
            <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase">{formattedSunday}</span>
            <button onClick={() => setWeekOffset((prev) => prev + 1)} className="text-slate-500 hover:text-white">
              <ChevronLeft size={14} className="rotate-180" />
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            setIsExpanded(true)
            setIsAdding(true)
          }}
          className="bg-amber-500 text-black p-2 rounded-xl active:scale-90 transition-all"
        >
          <Plus size={16} />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-6 space-y-3"
          >
            {meals.map((meal) => (
              <motion.div
                key={meal.id}
                layout
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative bg-white/5 border border-white/10 rounded-[1.5rem] p-4 flex flex-col"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold text-white pr-10">{meal.dish_name}</span>
                  <button
                    onClick={async () => {
                      await supabase.from('meal_planner').delete().eq('id', meal.id)
                      fetchData()
                    }}
                    className="absolute top-4 right-4 text-amber-500/30 hover:text-amber-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-auto flex justify-between items-center">
                  <div className="flex gap-1">
                    {MEMBERS.map((member) => {
                      const rating = ratings.find((r) => r.meal_id === meal.id && r.member_name === member.name)
                      if (!rating) return null
                      return (
                        <div
                          key={member.name}
                          className={`w-3 h-3 rounded-full ${member.color} flex items-center justify-center overflow-hidden`}
                        >
                          {!rating.is_liked && <div className="w-full h-[1px] bg-black/70 rotate-45" />}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex gap-0.5">
                    <button
                      onClick={() => toggleRating(meal.id, true)}
                      className={`p-1.5 transition-all ${
                        ratings.find((r) => r.meal_id === meal.id && r.member_name === userName && r.is_liked)
                          ? 'text-amber-500'
                          : 'text-amber-500/20'
                      }`}
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      onClick={() => toggleRating(meal.id, false)}
                      className={`p-1.5 transition-all ${
                        ratings.find((r) => r.meal_id === meal.id && r.member_name === userName && !r.is_liked)
                          ? 'text-amber-500'
                          : 'text-amber-500/20'
                      }`}
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {isAdding ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-amber-500/30"
              >
                <input
                  autoFocus
                  value={newDish}
                  onChange={(e) => setNewDish(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveMeal()}
                  placeholder="Étel neve..."
                  className="flex-1 bg-transparent border-none px-3 py-2 text-white text-xs font-bold outline-none"
                />
                <button onClick={saveMeal} className="bg-amber-500 px-4 py-2 rounded-xl text-black text-[10px] font-black uppercase">
                  Ok
                </button>
              </motion.div>
            ) : (
              meals.length === 0 && (
                <p className="text-[10px] text-slate-600 text-center py-4 font-bold uppercase tracking-widest">Nincs rögzített étel</p>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

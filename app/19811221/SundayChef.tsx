'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Utensils, ChefHat, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']

export default function SundayChef({ userName }: { userName: string }) {
  const [meals, setMeals] = useState<any[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newMeal, setNewMeal] = useState({ day: 'Hétfő', meal_type: 'Vacsora', dish_name: '' })

  useEffect(() => {
    fetchMeals()
  }, [])

  async function fetchMeals() {
    const { data } = await supabase.from('meal_planner').select('*').order('day')
    if (data) setMeals(data)
  }

  async function addMeal() {
    if (!newMeal.dish_name) return
    await supabase.from('meal_planner').insert([{ ...newMeal, chef_name: userName }])
    setNewMeal({ ...newMeal, dish_name: '' })
    setIsAdding(false)
    fetchMeals()
  }

  async function deleteMeal(id: string) {
    await supabase.from('meal_planner').delete().eq('id', id)
    fetchMeals()
  }

  return (
    <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2 tracking-tight text-amber-400">
          <ChefHat /> Sunday Chef
        </h2>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsAdding(!isAdding)}
          className="bg-amber-500 text-black p-2 rounded-full font-bold"
        >
          <Plus size={20} />
        </motion.button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6 space-y-3 bg-white/5 p-4 rounded-2xl"
          >
            <select 
              value={newMeal.day}
              onChange={(e) => setNewMeal({...newMeal, day: e.target.value})}
              className="w-full bg-slate-800 border border-white/20 p-2 rounded-xl text-white"
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input
              type="text"
              placeholder="Mi legyen a kaja?"
              value={newMeal.dish_name}
              onChange={(e) => setNewMeal({...newMeal, dish_name: e.target.value})}
              className="w-full bg-slate-800 border border-white/20 p-2 rounded-xl text-white outline-none"
            />
            <button 
              onClick={addMeal}
              className="w-full bg-amber-500 text-black font-bold py-2 rounded-xl"
            >
              Hozzáadás
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {DAYS.map((day) => {
          const dayMeals = meals.filter(m => m.day === day)
          return ( dayMeals.length > 0 && (
            <motion.div 
              layout
              key={day}
              className="group bg-white/5 p-4 rounded-2xl border border-white/5"
            >
              <span className="text-xs font-black uppercase text-amber-500 mb-2 block">{day}</span>
              {dayMeals.map((m) => (
                <div key={m.id} className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-medium">{m.dish_name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                       <Utensils size={10} /> {m.chef_name}
                    </p>
                  </div>
                  <button onClick={() => deleteMeal(m.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-500 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </motion.div>
          ))
        })}
      </div>
    </div>
  )
}
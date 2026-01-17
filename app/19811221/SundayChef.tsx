'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Utensils, ChefHat, Plus, Trash2, CalendarDays } from 'lucide-react'
import { supabase } from '../supabase'

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']

export default function SundayChef({ userName }: { userName: string }) {
  const [meals, setMeals] = useState<any[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newMeal, setNewMeal] = useState({ day: 'Hétfő', meal_type: 'Vacsora', dish_name: '' })

  useEffect(() => { fetchMeals() }, [])

  async function fetchMeals() {
    const { data } = await supabase.from('meal_planner').select('*').order('created_at', { ascending: true })
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
    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 backdrop-blur-xl shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 p-3 rounded-2xl">
            <ChefHat className="text-amber-500" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Sunday Chef</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Heti Menü</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAdding(!isAdding)}
          className={`p-4 rounded-2xl transition-all ${isAdding ? 'bg-slate-800 text-white' : 'bg-amber-500 text-black font-black'}`}
        >
          {isAdding ? <Plus className="rotate-45 transition-transform" /> : <Plus />}
        </motion.button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="overflow-hidden mb-8 space-y-4 bg-white/5 p-6 rounded-[2rem] border border-white/10"
          >
            <div className="grid grid-cols-2 gap-3">
              <select 
                value={newMeal.day}
                onChange={(e) => setNewMeal({...newMeal, day: e.target.value})}
                className="bg-slate-800 border-none p-4 rounded-2xl text-white font-bold text-sm outline-none"
              >
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select 
                value={newMeal.meal_type}
                onChange={(e) => setNewMeal({...newMeal, meal_type: e.target.value})}
                className="bg-slate-800 border-none p-4 rounded-2xl text-white font-bold text-sm outline-none"
              >
                <option value="Vacsora">Vacsora</option>
                <option value="Ebéd">Ebéd</option>
                <option value="Reggeli">Reggeli</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Mi legyen a finomság?"
              value={newMeal.dish_name}
              onChange={(e) => setNewMeal({...newMeal, dish_name: e.target.value})}
              className="w-full bg-slate-800 border-none p-4 rounded-2xl text-white font-bold outline-none placeholder:text-slate-600"
            />
            <button onClick={addMeal} className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all">HOZZÁADÁS A MENÜHÖZ</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {DAYS.map((day) => {
          const dayMeals = meals.filter(m => m.day === day)
          return (
            <div key={day} className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <CalendarDays size={12} className="text-slate-600" />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{day}</span>
              </div>
              <AnimatePresence mode="popLayout">
                {dayMeals.length > 0 ? (
                  dayMeals.map((m) => (
                    <motion.div 
                      key={m.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group bg-slate-800/50 hover:bg-slate-800 border border-white/5 p-4 rounded-3xl flex justify-between items-center transition-colors shadow-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-amber-500/10 p-2 rounded-xl">
                          <Utensils size={16} className="text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{m.dish_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{m.meal_type} • Séf: {m.chef_name}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteMeal(m.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-500 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-1 bg-slate-800/20 rounded-full mx-2" />
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, CheckCircle2, Circle, Plus, Star } from 'lucide-react'
import { supabase } from '../supabase'

export default function ShoppingList({ userName }: { userName: string }) {
  const [items, setItems] = useState<any[]>([])
  const [newItem, setNewItem] = useState('')
  const [isSpecial, setIsSpecial] = useState(false)

  useEffect(() => {
    fetchItems()
    const channel = supabase.channel('shopping_changes')
      .on('postgres_changes' as any, { event: '*', table: 'shopping_list' }, () => { fetchItems() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchItems() {
    const { data } = await supabase.from('shopping_list').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem) return
    await supabase.from('shopping_list').insert([{ 
      item: newItem, 
      added_by: userName,
      is_special: isSpecial 
    }])
    setNewItem('')
    setIsSpecial(false)
  }

  async function toggleComplete(id: string, currentStatus: boolean) {
    await supabase.from('shopping_list').update({ is_completed: !currentStatus }).eq('id', id)
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_list').delete().eq('id', id)
  }

  return (
    <div className="bg-[#0a0c10]/60 border border-white/5 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-md shadow-2xl overflow-hidden">
      
      {/* HEADER - Minimalista, ikon nélkül */}
      <div className="flex flex-col items-center mb-8">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Bevásárlólista</h2>
        <p className="text-[10px] text-amber-500 font-bold uppercase tracking-[0.3em] mt-1">
          {items.filter(i => !i.is_completed).length} tétel maradt
        </p>
      </div>

      {/* INPUT MEZŐ */}
      <form onSubmit={addItem} className="relative mb-8 group">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Valami elfogyott?"
              className="w-full bg-white/5 border border-white/10 p-4 pr-12 rounded-2xl text-white font-bold outline-none focus:border-amber-500/50 transition-all placeholder:text-slate-600 text-sm"
            />
            {/* Speciális tétel kapcsoló (Csillag ikon) */}
            <button 
              type="button"
              onClick={() => setIsSpecial(!isSpecial)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isSpecial ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600'}`}
            >
              <Star size={18} fill={isSpecial ? "currentColor" : "none"} />
            </button>
          </div>
          <button type="submit" className="bg-amber-500 text-black p-4 rounded-2xl font-black active:scale-90 transition-all shadow-lg shadow-amber-500/20">
            <Plus size={20} />
          </button>
        </div>
        {isSpecial && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-2 ml-2">
            ✨ Speciális tétel (nem beszerezhető bárhol)
          </motion.p>
        )}
      </form>

      {/* LISTA */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all ${
                item.is_completed 
                  ? 'bg-white/5 border-transparent opacity-40' 
                  : item.is_special 
                    ? 'bg-amber-500/5 border-amber-500/20 shadow-lg shadow-amber-500/5' 
                    : 'bg-white/5 border-white/5'
              }`}
            >
              <div 
                className="flex items-center gap-4 cursor-pointer grow pr-10" 
                onClick={() => toggleComplete(item.id, item.is_completed)}
              >
                <div className="shrink-0">
                  {item.is_completed ? (
                    <CheckCircle2 className="text-amber-500" size={20} />
                  ) : (
                    <Circle className={item.is_special ? "text-amber-500" : "text-slate-700"} size={20} />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className={`font-bold text-sm transition-all ${item.is_completed ? 'line-through text-slate-500' : 'text-white'}`}>
                    {item.item}
                  </span>
                  {!item.is_completed && (
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                      Hozzáadta: {item.added_by}
                    </span>
                  )}
                </div>
              </div>

              {/* Törlés gomb - Fixen látható mobilon is, narancs színben */}
              <button 
                onClick={() => deleteItem(item.id)} 
                className="absolute right-3 p-2 text-amber-500/30 hover:text-red-500 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <p className="text-[10px] text-slate-700 text-center py-10 font-bold uppercase tracking-[0.4em]">
            A lista üres
          </p>
        )}
      </div>
    </div>
  )
}
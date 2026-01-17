'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { ShoppingBag, Trash2, CheckCircle2, Circle, Plus } from 'lucide-react'
import { supabase } from '../supabase'

export default function ShoppingList({ userName }: { userName: string }) {
  const [items, setItems] = useState<any[]>([])
  const [newItem, setNewItem] = useState('')

  useEffect(() => {
    fetchItems()
    const channel = supabase.channel('shopping_changes').on('postgres_changes' as any, { event: '*', table: 'shopping_list' }, () => { fetchItems() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchItems() {
    const { data } = await supabase.from('shopping_list').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem) return
    await supabase.from('shopping_list').insert([{ item: newItem, added_by: userName }])
    setNewItem('')
  }

  async function toggleComplete(id: string, currentStatus: boolean) {
    await supabase.from('shopping_list').update({ is_completed: !currentStatus }).eq('id', id)
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_list').delete().eq('id', id)
  }

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 backdrop-blur-xl shadow-2xl flex flex-col h-full min-h-[500px]">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-500/20 p-3 rounded-2xl">
          <ShoppingBag className="text-emerald-500" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-tighter">Kosár</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{items.filter(i => !i.is_completed).length} tétel maradt</p>
        </div>
      </div>

      <form onSubmit={addItem} className="relative mb-8">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Valami elfogyott?"
          className="w-full bg-white/5 border border-white/10 p-5 pr-16 rounded-[1.5rem] text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
        />
        <button type="submit" className="absolute right-2 top-2 bottom-2 bg-emerald-500 text-black px-4 rounded-xl font-black active:scale-90 transition-all">
          <Plus />
        </button>
      </form>

      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`group flex items-center justify-between p-5 rounded-[1.5rem] border transition-all ${
                item.is_completed ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-slate-800/50 border-white/5'
              }`}
            >
              <div 
                className="flex items-center gap-4 cursor-pointer grow" 
                onClick={() => toggleComplete(item.id, item.is_completed)}
              >
                <motion.div whileTap={{ scale: 0.8 }}>
                  {item.is_completed ? <CheckCircle2 className="text-emerald-500" /> : <Circle className="text-slate-600" />}
                </motion.div>
                <span className={`font-bold text-sm transition-all ${item.is_completed ? 'line-through text-slate-600' : 'text-white'}`}>
                  {item.item}
                </span>
              </div>
              <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-500 transition-all">
                <Trash2 size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
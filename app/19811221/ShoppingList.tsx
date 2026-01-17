'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { supabase } from '../supabase'

export default function ShoppingList({ userName }: { userName: string }) {
  const [items, setItems] = useState<any[]>([])
  const [newItem, setNewItem] = useState('')

  useEffect(() => {
    fetchItems()
    const channel = supabase
      .channel('shopping_changes')
      .on('postgres_changes', { event: '*', table: 'shopping_list' }, () => {
        fetchItems()
      })
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
    <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-xl h-full">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-6 tracking-tight text-emerald-400">
        <ShoppingCart /> Bevásárlólista
      </h2>

      <form onSubmit={addItem} className="mb-6">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Mi fogyott el?"
          className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors"
        />
      </form>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        <AnimatePresence mode='popLayout'>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`flex items-center justify-between p-4 rounded-2xl border ${item.is_completed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}
            >
              <div className="flex items-center gap-3 cursor-pointer grow" onClick={() => toggleComplete(item.id, item.is_completed)}>
                {item.is_completed ? <CheckCircle2 className="text-emerald-500" /> : <Circle className="text-slate-500" />}
                <span className={`${item.is_completed ? 'line-through text-slate-500' : 'text-white font-medium'}`}>
                  {item.item}
                </span>
              </div>
              <button onClick={() => deleteItem(item.id)} className="text-slate-600 hover:text-red-500 transition-colors ml-2">
                <Trash2 size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
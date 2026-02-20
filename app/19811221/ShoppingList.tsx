'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, CheckCircle2, Circle, Plus, Star, ChevronDown } from 'lucide-react'
import { supabase } from '../supabase'

type ShoppingItem = {
  id: string
  item: string
  added_by: string
  is_special: boolean
  is_completed: boolean
}

export default function ShoppingList({ userName }: { userName: string }) {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [isSpecial, setIsSpecial] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  const fetchItems = useCallback(async () => {
    const { data } = await supabase.from('shopping_list').select('*')
    if (data) {
      const sorted = [...(data as ShoppingItem[])].sort((a, b) => Number(a.is_special) - Number(b.is_special))
      setItems(sorted)
    }
  }, [])

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchItems()
    }, 0)
    const channel = supabase
      .channel('shopping_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, () => {
        void fetchItems()
      })
      .subscribe()

    return () => {
      clearTimeout(initTimer)
      supabase.removeChannel(channel)
    }
  }, [fetchItems])

  async function addItem() {
    if (!newItem) return
    const tempItem: Omit<ShoppingItem, 'id'> = {
      item: newItem,
      added_by: userName,
      is_special: isSpecial,
      is_completed: false
    }

    setItems((prev) =>
      [...prev, { ...tempItem, id: 'temp' }].sort((a, b) => Number(a.is_special) - Number(b.is_special))
    )

    await supabase.from('shopping_list').insert([tempItem])
    setNewItem('')
    setIsSpecial(false)
    setIsAdding(false)
    fetchItems()
  }

  async function toggleComplete(id: string, currentStatus: boolean) {
    await supabase.from('shopping_list').update({ is_completed: !currentStatus }).eq('id', id)
    fetchItems()
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_list').delete().eq('id', id)
    fetchItems()
  }

  return (
    <div className="bg-[#0a0c10]/60 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-md transition-all">
      <div className="flex items-center justify-between p-4 px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3">
            <span className="text-xs font-black tracking-[0.2em] text-white uppercase">Bevásárlólista</span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown size={16} className="text-amber-500" />
            </motion.div>
          </button>

          <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
            <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase">
              {items.filter((i) => !i.is_completed).length} TÉTEL
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setIsExpanded(true)
            setIsAdding(true)
          }}
          className="bg-amber-500 text-black p-2 rounded-xl active:scale-90 transition-all shadow-lg shadow-amber-500/20"
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
            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 p-3 rounded-2xl border border-amber-500/20 mb-4"
                >
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addItem()}
                      placeholder="Mit vegyünk?"
                      className="flex-1 bg-transparent border-none px-3 py-2 text-white text-xs font-bold outline-none"
                    />
                    <button
                      onClick={() => setIsSpecial(!isSpecial)}
                      className={`p-2 rounded-xl transition-all ${
                        isSpecial ? 'text-amber-500 bg-amber-500/10' : 'text-slate-600'
                      }`}
                    >
                      <Star size={16} fill={isSpecial ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={addItem} className="bg-amber-500 px-4 rounded-xl text-black text-[10px] font-black uppercase">
                      Ok
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`relative flex items-center justify-between p-4 rounded-[1.5rem] border transition-all ${
                  item.is_completed
                    ? 'bg-transparent border-white/5 opacity-30'
                    : item.is_special
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-white/5 border-white/5'
                }`}
              >
                <div
                  className="flex items-center gap-4 cursor-pointer grow pr-10"
                  onClick={() => toggleComplete(item.id, item.is_completed)}
                >
                  {item.is_completed ? (
                    <CheckCircle2 className="text-amber-500" size={18} />
                  ) : (
                    <Circle className={item.is_special ? 'text-amber-500' : 'text-slate-700'} size={18} />
                  )}
                  <div className="flex flex-col">
                    <span className={`font-bold text-sm ${item.is_completed ? 'line-through' : 'text-white'}`}>{item.item}</span>
                    {item.is_special && !item.is_completed && (
                      <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter italic">Speciális</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="absolute right-4 text-amber-500/30 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}

            {items.length === 0 && !isAdding && (
              <p className="text-[9px] text-slate-600 text-center py-6 font-bold uppercase tracking-[0.3em]">Minden megvan</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

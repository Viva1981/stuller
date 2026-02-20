'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'

type BillingRow = {
  id: string
  amount: number
  created_by: string
  spent_on: string
  created_at: string
}

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function RockaBilling({ userName }: { userName: string }) {
  const [entries, setEntries] = useState<BillingRow[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const monthLabel = useMemo(() => {
    return new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
  }, [])

  const monthShortLabel = useMemo(() => {
    return new Date().toLocaleDateString('hu-HU', { month: 'long' })
  }, [])

  const monthRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: toDateKey(start), end: toDateKey(end) }
  }, [])

  const monthlyTotal = entries.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from('rocka_billing')
      .select('*')
      .gte('spent_on', monthRange.start)
      .lte('spent_on', monthRange.end)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) {
      setEntries(data)
    }
  }, [monthRange.end, monthRange.start])

  useEffect(() => {
    fetchEntries()
    const channel = supabase
      .channel('rocka_billing_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rocka_billing' }, () => {
        fetchEntries()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchEntries])

  async function addEntry() {
    const normalized = newAmount.replace(',', '.').trim()
    const parsed = Number(normalized)
    if (!parsed || parsed <= 0 || isSaving) return

    setIsSaving(true)
    try {
      const payload = {
        amount: parsed,
        created_by: userName,
        spent_on: toDateKey(new Date())
      }

      await supabase.from('rocka_billing').insert([payload])
      setNewAmount('')
      setIsAdding(false)
      fetchEntries()
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    await supabase.from('rocka_billing').delete().eq('id', id)
    fetchEntries()
  }

  return (
    <div className="bg-[#0a0c10]/60 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-md transition-all">
      <div className="flex items-center justify-between gap-2 p-4 px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3">
            <span className="text-xs font-black tracking-[0.2em] text-white uppercase">RockaBilling</span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown size={16} className="text-amber-500" />
            </motion.div>
          </button>

          <div className="bg-white/5 px-2.5 py-1.5 sm:px-3 sm:py-1 rounded-2xl sm:rounded-full border border-white/10 min-w-0">
            <span className="hidden sm:inline text-[9px] font-black tracking-widest text-amber-500 uppercase">
              {monthLabel}: {monthlyTotal.toLocaleString('hu-HU')} Ft
            </span>
            <div className="sm:hidden leading-tight">
              <p className="text-[9px] font-black tracking-wider text-amber-500 uppercase whitespace-nowrap">{monthShortLabel}</p>
              <p className="text-[10px] font-black tracking-wide text-amber-500 uppercase whitespace-nowrap">
                {monthlyTotal.toLocaleString('hu-HU')} Ft
              </p>
            </div>
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
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 p-3 rounded-2xl border border-amber-500/20"
              >
                <div className="flex gap-2 items-center">
                  <input
                    autoFocus
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                    placeholder="Költés (Ft)"
                    className="flex-1 bg-transparent border-none px-3 py-2 text-white text-xs font-bold outline-none"
                    inputMode="decimal"
                  />
                  <button
                    onClick={addEntry}
                    className="bg-amber-500 px-4 py-2 rounded-xl text-black text-[10px] font-black uppercase disabled:opacity-60"
                    disabled={isSaving}
                  >
                    Ok
                  </button>
                </div>
              </motion.div>
            )}

            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative bg-white/5 border border-white/10 rounded-[1.5rem] p-4 pr-12"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">{Number(entry.amount).toLocaleString('hu-HU')} Ft</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {entry.spent_on} · {entry.created_by}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="absolute right-4 top-4 text-amber-500/30 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}

            {entries.length === 0 && !isAdding && (
              <p className="text-[10px] text-slate-600 text-center py-4 font-bold uppercase tracking-widest">
                Nincs rögzített költés ebben a hónapban
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

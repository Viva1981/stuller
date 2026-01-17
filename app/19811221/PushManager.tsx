'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { supabase } from '../supabase'

export default function PushManager({ userId }: { userId: string }) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      checkSubscription()
    }
  }, [])

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (e) {
      console.error('Hiba az állapot ellenőrzésekor', e)
    }
  }

  async function subscribe() {
    if (isProcessing) return
    setIsProcessing(true)

    try {
      const registration = await navigator.serviceWorker.ready
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      })

      // Egyszerű upsert: az SQL UNIQUE constraint fogja kezelni az ütközést
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription_json: subscription.toJSON()
      })

      if (error) throw error

      setIsSubscribed(true)
      alert('Értesítések bekapcsolva! ✅')
    } catch (error: any) {
      console.error('Push hiba részletesen:', error)
      alert('Hiba történt: ' + (error.message || 'Próbáld meg később!'))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <button 
      onClick={subscribe}
      disabled={isProcessing}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg ${
        isSubscribed 
          ? 'bg-slate-900 text-emerald-500 border border-emerald-500/30' 
          : 'bg-red-600 text-white animate-pulse'
      }`}
    >
      {isProcessing ? (
        <Loader2 className="animate-spin" size={14} />
      ) : isSubscribed ? (
        <Bell size={14} />
      ) : (
        <BellOff size={14} />
      )}
      {isProcessing ? 'Kapcsolódás...' : isSubscribed ? 'Értesítések aktívak' : 'Értesítések kellenek!'}
    </button>
  )
}
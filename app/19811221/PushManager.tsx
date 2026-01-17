'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
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
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    setIsSubscribed(!!subscription)
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

      // FONTOS: .toJSON() kell, hogy a Supabase megértse a struktúrát!
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription_json: subscription.toJSON() 
      }, { onConflict: 'user_id' })

      if (error) throw error

      setIsSubscribed(true)
      alert('Szuper! Ez az eszköz mostantól kap értesítéseket. ✅')
    } catch (error: any) {
      console.error('Push hiba:', error)
      alert('Hiba történt: ' + (error.message || 'Lehet, hogy letiltottad az értesítéseket?'))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <button 
      onClick={subscribe}
      disabled={isProcessing}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
        isSubscribed 
          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' 
          : 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
      }`}
    >
      {isSubscribed ? <Bell size={14} /> : <BellOff size={14} />}
      {isSubscribed ? 'Értesítések aktívak' : isProcessing ? 'Kapcsolódás...' : 'Értesítések kellenek!'}
    </button>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { supabase } from '../supabase'

export default function PushManager({ userId }: { userId: string }) {
  const [isSubscribed, setIsSubscribed] = useState(false)

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
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      user_visible_only: true,
      application_server_key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    })

    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription_json: subscription
    })

    setIsSubscribed(true)
    alert('Értesítések bekapcsolva ezen az eszközön! ✅')
  }

  return (
    <button 
      onClick={subscribe}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isSubscribed ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500 text-white animate-pulse'}`}
    >
      {isSubscribed ? <Bell size={14} /> : <BellOff size={14} />}
      {isSubscribed ? 'Értesítések aktívak' : 'Értesítések kellenek!'}
    </button>
  )
}
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

      if (subscription) {
        setIsSubscribed(true)
      }
    } catch (e) {
      console.error('Hiba az allapot ellenorzesekor', e)
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

      const subJson = subscription.toJSON()

      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .contains('subscription_json', { endpoint: subJson.endpoint })
        .maybeSingle()

      if (!existing) {
        const { error } = await supabase.from('push_subscriptions').insert({
          user_id: userId,
          subscription_json: subJson
        })
        if (error) throw error
      } else {
        console.log('Ez az eszkoz mar regisztralva van.')
      }

      setIsSubscribed(true)
      alert('Ertesitesek bekapcsolva ezen az eszkozon is!')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Probald meg kesobb!'
      console.error('Push hiba reszletesen:', error)
      alert('Hiba tortent: ' + message)
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
      {isProcessing ? 'Kapcsolodas...' : isSubscribed ? 'Ertesitesek aktivak' : 'Ertesitesek kellenek!'}
    </button>
  )
}

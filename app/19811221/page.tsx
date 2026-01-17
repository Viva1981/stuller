"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import FamilyCalendar from '../FamilyCalendar';
import ShoppingList from './ShoppingList';
import SundayChef from './SundayChef';
import { motion } from 'framer-motion';

const WHITELIST = [
  'stuller.zsolt@gmail.com',
  'stuller.adel@gmail.com',
  'stuller.zsombor@gmail.com',
  'demya1981@gmail.com'
];

export default function FamilyDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const getName = (email: string) => {
    if (email === 'stuller.zsolt@gmail.com') return 'Zsolt';
    if (email === 'stuller.adel@gmail.com') return 'Adél';
    if (email === 'stuller.zsombor@gmail.com') return 'Zsombor';
    if (email === 'demya1981@gmail.com') return 'Andrea';
    return 'Családtag';
  };

useEffect(() => {
    // 1. Auth ellenőrzés (ez már benne van)
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !WHITELIST.includes(user.email || '')) {
        await supabase.auth.signOut();
        router.push('/');
      } else {
        setUser({ ...user, displayName: getName(user.email || '') });
        setLoading(false);
      }
    };
    checkUser();

    // 2. SERVICE WORKER REGISZTRÁCIÓ (Ezt add hozzá!)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('SW regisztrálva:', reg.scope);
      });
    }
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
    </div>
  );

  return (
    <main className="min-h-screen p-2 md:p-6 bg-slate-950 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        {/* DASHBOARD GRID - Letisztítva, fejléc nélkül */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* BAL OLDAL: NAPTÁR ÉS ÉTEL */}
          <div className="lg:col-span-2 space-y-6">
            <FamilyCalendar currentUser={user} />
            <SundayChef userName={user?.displayName} />
          </div>

          {/* JOBB OLDAL: LISTA */}
          <div className="space-y-6">
            <ShoppingList userName={user?.displayName} />
          </div>

        </div>
      </div>
    </main>
  );
}
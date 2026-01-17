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

  // Név leképzés az email alapján
  const getName = (email: string) => {
    if (email === 'stuller.zsolt@gmail.com') return 'Zsolt';
    if (email === 'stuller.adel@gmail.com') return 'Adél';
    if (email === 'stuller.zsombor@gmail.com') return 'Zsombor';
    if (email === 'demya1981@gmail.com') return 'Andrea';
    return 'Családtag';
  };

  useEffect(() => {
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
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
    </div>
  );

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-950 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-12">
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h1 className="text-3xl font-black tracking-tighter italic uppercase">
              STULLER <span className="text-emerald-500">PROJEKT</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm">Szia, {user?.displayName}! 👋</p>
          </motion.div>

          <button 
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
            className="bg-white/5 hover:bg-red-500/20 hover:text-red-500 px-5 py-2 rounded-full border border-white/10 transition-all font-bold text-xs"
          >
            KILÉPÉS
          </button>
        </div>

        {/* DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* BAL OLDAL: NAPTÁR ÉS ÉTEL (2/3 szélesség) */}
          <div className="lg:col-span-2 space-y-8">
            <FamilyCalendar currentUser={user} />
            <SundayChef userName={user?.displayName} />
          </div>

          {/* JOBB OLDAL: LISTA (1/3 szélesség) */}
          <div className="space-y-8">
            <ShoppingList userName={user?.displayName} />
            
            {/* MOTIVÁCIÓS KÁRTYA */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-6 rounded-3xl text-white shadow-xl shadow-emerald-900/20">
              <h3 className="font-black italic uppercase mb-1">Családi infó</h3>
              <p className="text-sm opacity-90 leading-snug">
                Minden módosítás valós időben mentődik. A közös munka ereje! 🚀
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
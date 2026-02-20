"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import FamilyCalendar from '../FamilyCalendar';
import ShoppingList from './ShoppingList';
import SundayChef from './SundayChef';
import RockaBilling from './RockaBilling';
import { motion } from 'framer-motion';

const WHITELIST = [
  'stuller.zsolt@gmail.com',
  'stuller.adel@gmail.com',
  'stuller.zsombor@gmail.com',
  'demya1981@gmail.com'
];

export default function FamilyDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string; displayName: string } | null>(null);
  const router = useRouter();

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
        setUser({ id: user.id, email: user.email || '', displayName: getName(user.email || '') });
        setLoading(false);
      }
    };
    checkUser();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => console.log('SW regisztrĂˇlva:', reg.scope))
        .catch((err) => console.error('SW hiba:', err));
    }
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
    </div>
  );

  return (
    <main className="min-h-screen p-3 md:p-8 bg-[#050608] text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 1. NAPTĂR SZEKCIĂ“ */}
        {/* Ebben vannak a kicsi kerek gombok, amiket most kĂ¶tĂ¶ttĂĽnk be! */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <FamilyCalendar currentUser={user!} />
        </motion.section>

        {/* 2. BEVĂSĂRLĂ“LISTA SZEKCIĂ“ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ShoppingList userName={user?.displayName || 'Családtag'} />
        </motion.section>

        {/* 3. MENĂś SZEKCIĂ“ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <SundayChef userName={user?.displayName || 'Családtag'} />
        </motion.section>

        {/* 4. ROCKABILLING SZEKCIĂ“ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <RockaBilling userName={user?.displayName || 'Családtag'} />
        </motion.section>

        <footer className="py-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-800">
            STULLER • 2026
          </p>
        </footer>

      </div>
    </main>
  );
}


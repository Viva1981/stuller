"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import FamilyCalendar from '../FamilyCalendar';
import { supabase } from '../supabase';
import { FAMILY_EMAIL_WHITELIST, getFamilyDisplayName } from '@/app/lib/family';
import HousePanel from './HousePanel';
import RockaBilling from './RockaBilling';
import ShoppingList from './ShoppingList';
import SundayChef from './SundayChef';

export default function FamilyDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string; displayName: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser || !FAMILY_EMAIL_WHITELIST.includes(authUser.email || '')) {
        await supabase.auth.signOut();
        router.push('/');
        return;
      }

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        displayName: getFamilyDisplayName(authUser.email || ''),
      });
      setLoading(false);
    };

    void checkUser();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => console.log('SW regisztrálva:', registration.scope))
        .catch((error) => console.error('SW hiba:', error));
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050608] p-3 text-white selection:bg-emerald-500/30 md:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <FamilyCalendar currentUser={user!} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <HousePanel />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ShoppingList userName={user?.displayName || 'Családtag'} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <SundayChef userName={user?.displayName || 'Családtag'} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <RockaBilling userName={user?.displayName || 'Családtag'} />
        </motion.section>

        <footer className="py-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-800">STULLER • 2026</p>
        </footer>
      </div>
    </main>
  );
}

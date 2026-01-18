"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Fontos import!
import { supabase } from '../supabase';
import FamilyCalendar from '../FamilyCalendar';
import ShoppingList from './ShoppingList';
import SundayChef from './SundayChef';
import { motion } from 'framer-motion';
import { User, GraduationCap, Utensils, Heart } from 'lucide-react'; // Ikonok

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

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => console.log('SW regisztrálva:', reg.scope))
        .catch((err) => console.error('SW hiba:', err));
    }
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
    </div>
  );

  // Gombok definíciója a könnyebb kezelhetőségért
  const familyButtons = [
    { name: 'Andrea', path: '/19811221/andrea', color: 'bg-rose-500', icon: Heart },
    { name: 'Zsolt', path: '/19811221/zsolt', color: 'bg-blue-600', icon: User },
    { name: 'Adél', path: '/19811221/adel', color: 'bg-purple-600', icon: GraduationCap },
    { name: 'Zsombor', path: '/19811221/zsombor', color: 'bg-teal-600', icon: GraduationCap },
  ];

  return (
    <main className="min-h-screen p-3 md:p-8 bg-[#050608] text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 0. CSALÁD VÁLASZTÓ (ÚJ SZEKCIÓ) */}
        <motion.section 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
            {familyButtons.map((member) => (
                <Link key={member.name} href={member.path} className="block group">
                    <div className="relative overflow-hidden rounded-2xl bg-[#0a0c10] border border-white/5 p-4 hover:border-white/20 transition-all duration-300 h-24 flex flex-col items-center justify-center gap-2">
                        {/* Háttér glow */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${member.color}`}></div>
                        
                        <div className={`p-2 rounded-full bg-white/5 group-hover:scale-110 transition-transform ${member.color.replace('bg-', 'text-')}`}>
                            <member.icon size={20} />
                        </div>
                        <span className="font-bold text-sm tracking-widest uppercase text-white/80">{member.name}</span>
                    </div>
                </Link>
            ))}
        </motion.section>

        {/* 1. NAPTÁR SZEKCIÓ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <FamilyCalendar currentUser={user} />
        </motion.section>

        {/* 2. BEVÁSÁRLÓLISTA SZEKCIÓ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ShoppingList userName={user?.displayName} />
        </motion.section>

        {/* 3. MENÜ SZEKCIÓ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <SundayChef userName={user?.displayName} />
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
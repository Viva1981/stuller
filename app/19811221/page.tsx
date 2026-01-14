"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import FamilyCalendar from '../FamilyCalendar'; // Beimportáljuk az új naptárt
import { motion } from 'framer-motion';

export default function FamilyDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
      } else {
        setUser(user);
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Betöltés...</div>;

  return (
    <main className="min-h-screen p-4 md:p-10 bg-slate-950 text-white">
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            STULLER HUB
          </h1>
          <p className="text-slate-400 uppercase text-xs tracking-widest font-bold mt-1">
            Üdv az irányítóközpontban, {user?.user_metadata?.full_name?.split(' ')[0]}!
          </p>
        </motion.div>
        <button onClick={() => { supabase.auth.signOut(); window.location.href='/'; }} className="text-xs bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg hover:bg-red-900/20 transition-all">KIJELENTKEZÉS</button>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 gap-12">
        {/* NAPTÁR SZEKCIÓ */}
        <section>
          <FamilyCalendar />
        </section>

        {/* GYORS LINKEK / TAGOK */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Andrea', 'Zsolt', 'Adél', 'Zsombor'].map((name) => (
            <motion.div
              key={name}
              whileHover={{ y: -5 }}
              className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
            >
              <span className="font-bold text-slate-300">{name}</span>
            </motion.div>
          ))}
        </section>
      </div>
    </main>
  );
}
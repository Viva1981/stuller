"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import FamilyCalendar from '../FamilyCalendar';
import { motion } from 'framer-motion';

export default function FamilyDashboard() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
      } else {
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
    <main className="min-h-screen p-4 md:p-8 bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto">
        {/* Itt már csak a naptár jelenik meg, aminek a tetején ott lesznek a gombok */}
        <FamilyCalendar />
      </div>
    </main>
  );
}
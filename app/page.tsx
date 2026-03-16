"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { supabase } from './supabase';
import { buildAppUrl } from './lib/site';

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace('/19811221');
        return;
      }

      setCheckingSession(false);
    };

    void checkSession();
  }, [router]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildAppUrl('/auth/callback'),
      },
    });
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-emerald-500" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8 rounded-[2.5rem] border border-slate-800 bg-slate-900/50 p-10 text-center shadow-2xl"
      >
        <h1 className="text-3xl font-black tracking-tighter text-white">
          STULLER<span className="text-emerald-500">.</span>APP
        </h1>

        <button
          onClick={handleLogin}
          className="w-full rounded-2xl bg-white py-5 text-xs font-black uppercase tracking-widest text-black shadow-xl transition-all active:scale-95 hover:bg-slate-200"
        >
          Belépés Google-fiókkal
        </button>
      </motion.div>
    </main>
  );
}

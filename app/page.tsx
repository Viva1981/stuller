"use client";

import { supabase } from './supabase';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin + '/19811221' : '',
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm p-10 space-y-8 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 text-center shadow-2xl"
      >
        <h1 className="text-3xl font-black tracking-tighter text-white">
          STULLER<span className="text-emerald-500">.</span>APP
        </h1>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-black uppercase text-xs tracking-widest py-5 rounded-2xl hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
        >
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
          Belépés
        </button>
      </motion.div>
    </main>
  );
}
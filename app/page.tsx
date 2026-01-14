"use client";

import { supabase } from './supabase';

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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900 to-black">
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-900/50 rounded-2xl border border-slate-800 backdrop-blur-xl shadow-2xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          STULLER FAMILY
        </h1>
        <p className="text-slate-400">Üdvözlünk a privát családi alkalmazásunkban. Kérlek, jelentkezz be.</p>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3 px-6 rounded-lg hover:bg-slate-200 transition-all duration-200 transform hover:scale-[1.02]"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Bejelentkezés Google-lel
        </button>
      </div>
    </main>
  );
}
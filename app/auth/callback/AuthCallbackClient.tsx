"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/app/supabase';

type AuthCallbackClientProps = {
  code: string | null;
  errorMessage: string | null;
};

export default function AuthCallbackClient({ code, errorMessage: initialErrorMessage }: AuthCallbackClientProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);

  useEffect(() => {
    const finishLogin = async () => {
      if (errorMessage) {
        return;
      }

      if (!code) {
        router.replace('/');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setErrorMessage(exchangeError.message);
        return;
      }

      router.replace('/19811221');
    };

    void finishLogin();
  }, [code, errorMessage, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-2xl">
        {errorMessage ? (
          <div className="space-y-4">
            <h1 className="text-xl font-black uppercase tracking-widest text-rose-300">Belépési hiba</h1>
            <p className="text-sm text-slate-300">{errorMessage}</p>
            <button
              onClick={() => router.replace('/')}
              className="w-full rounded-2xl bg-white py-4 text-xs font-black uppercase tracking-widest text-black transition-all active:scale-95 hover:bg-slate-200"
            >
              Vissza a belépéshez
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-t-2 border-emerald-500" />
            <h1 className="text-xl font-black uppercase tracking-widest">Belépés folyamatban</h1>
            <p className="text-sm text-slate-300">A Google bejelentkezést véglegesítjük, mindjárt továbbviszünk.</p>
          </div>
        )}
      </div>
    </main>
  );
}

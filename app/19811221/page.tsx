"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import FamilyCalendar from '../FamilyCalendar';

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

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !WHITELIST.includes(user.email || '')) {
        await supabase.auth.signOut();
        router.push('/');
      } else {
        setUser(user);
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
        {/* Passzoljuk a user adatokat a naptárnak a szűréshez */}
        <FamilyCalendar currentUser={user} />
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';

export default function FamilyDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/');
      } else {
        setUser(user);
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const familyMembers = [
    { name: 'Andrea', role: 'Anya', color: 'from-pink-500 to-rose-600' },
    { name: 'Zsolt', role: 'Apa', color: 'from-blue-500 to-cyan-600' },
    { name: 'Adél', role: 'Lányunk', color: 'from-purple-500 to-indigo-600' },
    { name: 'Zsombor', role: 'Fiunk', color: 'from-orange-500 to-amber-600' },
  ];

  return (
    <main className="min-h-screen p-4 md:p-8 bg-slate-950">
      <header className="flex justify-between items-center mb-12 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white">Családi Irányítópult</h1>
          <p className="text-slate-400">Szia, {user?.user_metadata?.full_name || 'Tag'}! 👋</p>
        </div>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-sm rounded-md transition-colors border border-slate-700"
        >
          Kijelentkezés
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {familyMembers.map((member) => (
          <div 
            key={member.name}
            className={`relative group overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${member.color} shadow-lg transition-transform duration-300 hover:-translate-y-2 cursor-pointer`}
          >
            <div className="relative z-10">
              <h3 className="text-2xl font-black text-white">{member.name}</h3>
              <p className="text-white/80 font-medium">{member.role}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 text-white/10 text-8xl font-black italic group-hover:scale-110 transition-transform">
              {member.name[0]}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
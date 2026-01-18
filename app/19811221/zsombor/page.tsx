"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SchoolTimetable from '../components/SchoolTimetable';

export default function ZsomborPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-white p-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/19811221" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">Vissza a központba</span>
        </Link>

        {/* Ugyanaz a komponens, csak más owner paraméterrel */}
        <SchoolTimetable owner="Zsombor" />
        
      </div>
    </main>
  );
}
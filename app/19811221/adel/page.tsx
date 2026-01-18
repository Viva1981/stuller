"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SchoolTimetable from '../components/SchoolTimetable';

export default function AdelPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-white p-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Vissza gomb */}
        <Link href="/19811221" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">Vissza a központba</span>
        </Link>

        {/* Órarend Komponens */}
        <SchoolTimetable owner="Adél" />
        
        {/* Itt lehet majd később más modul (pl. Jegyek, Feladatok) */}
      </div>
    </main>
  );
}
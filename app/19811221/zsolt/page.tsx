"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
// IMPORTOK
import WeightTracker from '../components/WeightTracker';

export default function ZsoltPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-white p-4 font-sans pb-20">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Vissza gomb */}
        <Link href="/19811221" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">Vissza</span>
        </Link>

        <h1 className="text-3xl font-black italic uppercase text-blue-600">Zsolt</h1>

        {/* MODULOK */}
        
        {/* Súlynapló */}
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}}>
            <WeightTracker owner="Zsolt" />
        </motion.div>

        {/* Ide jöhetnek Zsolt egyéb moduljai később (pl. Jegyzetek) */}
      </div>
    </main>
  );
}
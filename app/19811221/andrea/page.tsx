"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import WeightTracker from '../components/WeightTracker';
import RecipeBook from '../components/RecipeBook'; // Import

export default function AndreaPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-white p-4 font-sans pb-20">
      {/* Szélesebb keret a jobb olvashatóságért */}
      <div className="max-w-5xl mx-auto space-y-8">
        
        <Link href="/19811221" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">Vissza</span>
        </Link>

        <h1 className="text-3xl font-black italic uppercase text-rose-500">Andrea</h1>

        {/* Súlynapló */}
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}}>
            <WeightTracker owner="Andrea" />
        </motion.div>

        {/* Recepttár */}
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.1}}>
            <RecipeBook owner="Andrea" />
        </motion.div>

      </div>
    </main>
  );
}
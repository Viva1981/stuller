"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/app/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Utensils, ChevronDown, ChevronUp, Plus, X, Save, Trash2, ChefHat, ScrollText 
} from 'lucide-react';

interface Ingredient {
  amount: string;
  name: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  owner: string;
}

export default function RecipeBook({ owner }: { owner: string }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false); // Fő accordion
  
  // Állapotok a szerkesztéshez/nézethez
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'details'>('list');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Form állapot
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIngredients, setFormIngredients] = useState<Ingredient[]>([]);

  useEffect(() => {
    fetchRecipes();
  }, [owner]);

  const fetchRecipes = async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('owner', owner)
      .order('created_at', { ascending: false });
    
    if (data) setRecipes(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;

    const recipeData = {
      owner,
      title: formTitle,
      description: formDesc,
      ingredients: formIngredients
    };

    if (selectedRecipe && viewMode === 'create') { 
        // Ez valójában update, ha van ID, de most egyszerűsítsük: create mód = új, details-ben nincs edit gomb még
        // De a logikát bővíthetjük. Most csak ÚJ mentése vagy meglévő törlése van.
        await supabase.from('recipes').insert(recipeData);
    } else {
        await supabase.from('recipes').insert(recipeData);
    }

    resetForm();
    fetchRecipes();
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Biztosan törlöd ezt a receptet?')) return;
    await supabase.from('recipes').delete().eq('id', id);
    setSelectedRecipe(null);
    setViewMode('list');
    fetchRecipes();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormIngredients([{ amount: '', name: '' }]);
    setViewMode('list');
    setSelectedRecipe(null);
  };

  const openCreate = () => {
    setFormTitle('');
    setFormDesc('');
    setFormIngredients([{ amount: '', name: '' }]);
    setViewMode('create');
  };

  const openDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setViewMode('details');
  };

  const addIngredientRow = () => {
    setFormIngredients([...formIngredients, { amount: '', name: '' }]);
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = [...formIngredients];
    newIngredients[index][field] = value;
    setFormIngredients(newIngredients);
  };

  const removeIngredientRow = (index: number) => {
    const newIngredients = formIngredients.filter((_, i) => i !== index);
    setFormIngredients(newIngredients);
  };

  if (loading) return null;

  return (
    <div className="space-y-2">
      {/* FEJLÉC */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between bg-[#0a0c10] p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
            {isOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
          </div>
          <h2 className="text-xl font-black italic tracking-wider text-white uppercase">
            RECEPTTÁR
          </h2>
        </div>
        <Utensils size={20} className="text-white/30" />
      </div>

      {/* TARTALOM */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#0a0c10]/50 border-x border-b border-white/5 rounded-b-2xl -mt-2 mx-1"
          >
            <div className="p-4">
              
              {/* NÉZET: LISTA */}
              {viewMode === 'list' && (
                <div className="space-y-3">
                    <button 
                        onClick={openCreate}
                        className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-emerald-500 font-black text-xs uppercase tracking-widest hover:bg-white/10 flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Új Recept
                    </button>

                    {recipes.length === 0 ? (
                        <p className="text-center text-white/30 text-sm italic py-4">Még nincs feltöltve recept.</p>
                    ) : (
                        <div className="grid gap-2">
                            {recipes.map(recipe => (
                                <div 
                                    key={recipe.id}
                                    onClick={() => openDetails(recipe)}
                                    className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-amber-500/50 cursor-pointer group transition-all"
                                >
                                    <h3 className="font-bold text-white group-hover:text-amber-500 transition-colors">{recipe.title}</h3>
                                    <p className="text-xs text-white/40 mt-1 truncate">{recipe.description?.substring(0, 50)}...</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              )}

              {/* NÉZET: ÚJ RECEPT */}
              {viewMode === 'create' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-emerald-500 font-black text-sm uppercase">Új finomság</h3>
                        <button onClick={() => setViewMode('list')}><X className="text-white/50" /></button>
                    </div>

                    <input 
                        type="text" 
                        placeholder="Recept neve (pl. Almás pite)" 
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-bold focus:border-emerald-500 outline-none"
                    />

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Hozzávalók</label>
                        {formIngredients.map((ing, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input 
                                    placeholder="Menny." 
                                    className="w-20 bg-white/5 border border-white/10 p-2 rounded-lg text-white text-sm"
                                    value={ing.amount}
                                    onChange={e => updateIngredient(idx, 'amount', e.target.value)}
                                />
                                <input 
                                    placeholder="Alapanyag" 
                                    className="flex-1 bg-white/5 border border-white/10 p-2 rounded-lg text-white text-sm"
                                    value={ing.name}
                                    onChange={e => updateIngredient(idx, 'name', e.target.value)}
                                />
                                <button onClick={() => removeIngredientRow(idx)} className="text-white/30 hover:text-red-500"><X size={18}/></button>
                            </div>
                        ))}
                        <button onClick={addIngredientRow} className="text-xs text-emerald-500 font-bold flex items-center gap-1 mt-2">
                            <Plus size={14} /> Sor hozzáadása
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Elkészítés</label>
                        <textarea 
                            rows={5}
                            value={formDesc}
                            onChange={e => setFormDesc(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                            placeholder="Írd le a lépéseket..."
                        />
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full py-4 bg-emerald-500 rounded-xl text-black font-black uppercase tracking-widest hover:bg-emerald-400"
                    >
                        Mentés
                    </button>
                </div>
              )}

              {/* NÉZET: RÉSZLETEK */}
              {viewMode === 'details' && selectedRecipe && (
                <div className="space-y-6">
                     <div className="flex justify-between items-start">
                        <button onClick={() => setViewMode('list')} className="text-xs font-bold text-white/50 uppercase tracking-widest hover:text-white">← Vissza</button>
                        <button onClick={() => handleDelete(selectedRecipe.id)} className="text-red-500/50 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>

                    <div>
                        <h2 className="text-2xl font-black text-amber-500 italic mb-2">{selectedRecipe.title}</h2>
                        <div className="h-1 w-20 bg-white/10 rounded-full"></div>
                    </div>

                    {/* Hozzávalók kártya */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <h4 className="flex items-center gap-2 text-xs font-black uppercase text-white/60 mb-4 tracking-widest">
                            <ChefHat size={16} className="text-emerald-500" /> Hozzávalók
                        </h4>
                        <ul className="space-y-2">
                            {selectedRecipe.ingredients?.map((ing, i) => (
                                <li key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                    <span className="text-white">{ing.name}</span>
                                    <span className="font-bold text-emerald-400">{ing.amount}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Elkészítés kártya */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                         <h4 className="flex items-center gap-2 text-xs font-black uppercase text-white/60 mb-4 tracking-widest">
                            <ScrollText size={16} className="text-blue-500" /> Elkészítés
                        </h4>
                        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
                            {selectedRecipe.description}
                        </p>
                    </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
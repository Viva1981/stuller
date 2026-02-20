"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, ChevronDown, ChevronUp, Plus, X, Trash2, ChefHat, ScrollText, Edit2
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
  const [isOpen, setIsOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'form' | 'details'>('list');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIngredients, setFormIngredients] = useState<Ingredient[]>([]);

  const fetchRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('owner', owner)
      .order('created_at', { ascending: false });

    if (data) setRecipes(data as Recipe[]);
    setLoading(false);
  }, [owner]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchRecipes();
    }, 0);
    return () => clearTimeout(initTimer);
  }, [fetchRecipes]);

  const handleSave = async () => {
    if (!formTitle.trim()) return;

    const recipeData = {
      owner,
      title: formTitle,
      description: formDesc,
      ingredients: formIngredients
    };

    if (selectedRecipe) {
      await supabase.from('recipes').update(recipeData).eq('id', selectedRecipe.id);
    } else {
      await supabase.from('recipes').insert(recipeData);
    }

    resetForm();
    fetchRecipes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan torlod ezt a receptet?')) return;
    await supabase.from('recipes').delete().eq('id', id);
    resetForm();
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
    setSelectedRecipe(null);
    setFormTitle('');
    setFormDesc('');
    setFormIngredients([{ amount: '', name: '' }]);
    setViewMode('form');
  };

  const openEdit = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setFormTitle(recipe.title);
    setFormDesc(recipe.description);
    setFormIngredients(recipe.ingredients ? [...recipe.ingredients] : [{ amount: '', name: '' }]);
    setViewMode('form');
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
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between bg-[#0a0c10] p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
            {isOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
          </div>
          <h2 className="text-xl font-black italic tracking-wider text-white uppercase">RECEPTTAR</h2>
        </div>
        <Utensils size={20} className="text-white/30" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[#0a0c10]/50 border-x border-b border-white/5 rounded-b-2xl -mt-2 mx-1"
          >
            <div className="p-4">
              {viewMode === 'list' && (
                <div className="space-y-3">
                  <button
                    onClick={openCreate}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-emerald-500 font-black text-xs uppercase tracking-widest hover:bg-white/10 flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Uj Recept
                  </button>

                  {recipes.length === 0 ? (
                    <p className="text-center text-white/30 text-sm italic py-4">Meg nincs feltoltve recept.</p>
                  ) : (
                    <div className="grid gap-2">
                      {recipes.map((recipe) => (
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

              {viewMode === 'form' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-emerald-500 font-black text-sm uppercase">
                      {selectedRecipe ? 'Recept szerkesztese' : 'Uj finomsag'}
                    </h3>
                    <button onClick={() => setViewMode('list')}><X className="text-white/50" /></button>
                  </div>

                  <input
                    type="text"
                    placeholder="Recept neve"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white font-bold focus:border-emerald-500 outline-none"
                  />

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Hozzavalok</label>
                    {formIngredients.map((ing, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          placeholder="Menny."
                          className="w-20 bg-white/5 border border-white/10 p-2 rounded-lg text-white text-sm"
                          value={ing.amount}
                          onChange={(e) => updateIngredient(idx, 'amount', e.target.value)}
                        />
                        <input
                          placeholder="Alapanyag"
                          className="flex-1 bg-white/5 border border-white/10 p-2 rounded-lg text-white text-sm"
                          value={ing.name}
                          onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                        />
                        <button onClick={() => removeIngredientRow(idx)} className="text-white/30 hover:text-red-500"><X size={18} /></button>
                      </div>
                    ))}
                    <button onClick={addIngredientRow} className="text-xs text-emerald-500 font-bold flex items-center gap-1 mt-2">
                      <Plus size={14} /> Sor hozzaadasa
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Elkeszites</label>
                    <textarea
                      rows={8}
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                      placeholder="Ird le a lepeseket..."
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    className="w-full py-4 bg-emerald-500 rounded-xl text-black font-black uppercase tracking-widest hover:bg-emerald-400"
                  >
                    {selectedRecipe ? 'Modositasok mentese' : 'Mentes'}
                  </button>
                </div>
              )}

              {viewMode === 'details' && selectedRecipe && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <button onClick={() => setViewMode('list')} className="text-xs font-bold text-white/50 uppercase tracking-widest hover:text-white">Vissza</button>
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEdit(selectedRecipe)}
                        className="p-2 bg-white/5 rounded-lg text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(selectedRecipe.id)}
                        className="p-2 bg-white/5 rounded-lg text-red-500 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-amber-500 italic mb-2">{selectedRecipe.title}</h2>
                    <div className="h-1 w-20 bg-white/10 rounded-full"></div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase text-white/60 mb-4 tracking-widest">
                      <ChefHat size={16} className="text-emerald-500" /> Hozzavalok
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

                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase text-white/60 mb-4 tracking-widest">
                      <ScrollText size={16} className="text-blue-500" /> Elkeszites
                    </h4>
                    <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{selectedRecipe.description}</p>
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

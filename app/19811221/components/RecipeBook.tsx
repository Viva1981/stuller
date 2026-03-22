"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, ChevronDown, ChevronUp, Plus, X, Trash2, ChefHat, ScrollText, Edit2, Loader2, Sparkles
} from 'lucide-react';
import { buildRecipeDescription, parseRecipeRecord, RecipeNutritionMeta } from '@/app/lib/recipes';

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
  visibleDescription?: string;
  nutrition?: RecipeNutritionMeta;
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
  const [yieldWeightGrams, setYieldWeightGrams] = useState('');
  const [servings, setServings] = useState('');
  const [totalCalories, setTotalCalories] = useState('');
  const [caloriesPer100g, setCaloriesPer100g] = useState('');
  const [caloriesPerServing, setCaloriesPerServing] = useState('');
  const [nutritionAssumptions, setNutritionAssumptions] = useState('');
  const [estimatingNutrition, setEstimatingNutrition] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('owner', owner)
      .order('created_at', { ascending: false });

    if (data) setRecipes((data as Recipe[]).map((recipe) => parseRecipeRecord(recipe)));
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
      description: buildRecipeDescription(formDesc, {
        yieldWeightGrams: yieldWeightGrams ? parseInt(yieldWeightGrams, 10) : null,
        servings: servings ? parseInt(servings, 10) : null,
        totalCalories: totalCalories ? parseInt(totalCalories, 10) : null,
        caloriesPer100g: caloriesPer100g ? parseInt(caloriesPer100g, 10) : null,
        caloriesPerServing: caloriesPerServing ? parseInt(caloriesPerServing, 10) : null,
        assumptions: nutritionAssumptions,
        estimatedBy: nutritionAssumptions ? 'ai' : 'manual',
      }),
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
    if (!confirm('Biztosan törlöd ezt a receptet?')) return;
    await supabase.from('recipes').delete().eq('id', id);
    resetForm();
    fetchRecipes();
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormIngredients([{ amount: '', name: '' }]);
    setYieldWeightGrams('');
    setServings('');
    setTotalCalories('');
    setCaloriesPer100g('');
    setCaloriesPerServing('');
    setNutritionAssumptions('');
    setEstimateError(null);
    setViewMode('list');
    setSelectedRecipe(null);
  };

  const openCreate = () => {
    setSelectedRecipe(null);
    setFormTitle('');
    setFormDesc('');
    setFormIngredients([{ amount: '', name: '' }]);
    setYieldWeightGrams('');
    setServings('');
    setTotalCalories('');
    setCaloriesPer100g('');
    setCaloriesPerServing('');
    setNutritionAssumptions('');
    setEstimateError(null);
    setViewMode('form');
  };

  const openEdit = (recipe: Recipe) => {
    const nutrition = recipe.nutrition ?? {};
    setSelectedRecipe(recipe);
    setFormTitle(recipe.title);
    setFormDesc(recipe.visibleDescription ?? recipe.description);
    setFormIngredients(recipe.ingredients ? [...recipe.ingredients] : [{ amount: '', name: '' }]);
    setYieldWeightGrams(nutrition.yieldWeightGrams ? String(nutrition.yieldWeightGrams) : '');
    setServings(nutrition.servings ? String(nutrition.servings) : '');
    setTotalCalories(nutrition.totalCalories ? String(nutrition.totalCalories) : '');
    setCaloriesPer100g(nutrition.caloriesPer100g ? String(nutrition.caloriesPer100g) : '');
    setCaloriesPerServing(nutrition.caloriesPerServing ? String(nutrition.caloriesPerServing) : '');
    setNutritionAssumptions(nutrition.assumptions ?? '');
    setEstimateError(null);
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

  const estimateNutrition = async () => {
    if (!formTitle.trim() && formIngredients.every((ingredient) => !ingredient.name.trim())) {
      setEstimateError('Adj meg legalább egy receptnevet vagy néhány hozzávalót a becsléshez.');
      return;
    }

    setEstimatingNutrition(true);
    setEstimateError(null);

    try {
      const response = await fetch('/api/recipe/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          title: formTitle,
          description: formDesc,
          ingredients: formIngredients.filter((ingredient) => ingredient.name.trim()),
        }),
      });

      const payload = (await response.json()) as {
        estimate?: {
          yieldWeightGrams?: number;
          servings?: number;
          totalCalories?: number;
          caloriesPer100g?: number;
          caloriesPerServing?: number;
          assumptions?: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.estimate) {
        throw new Error(payload.error || 'Nem sikerült receptbecslést kérni.');
      }

      const estimate = payload.estimate;
      setYieldWeightGrams(estimate.yieldWeightGrams ? String(estimate.yieldWeightGrams) : '');
      setServings(estimate.servings ? String(estimate.servings) : '');
      setTotalCalories(estimate.totalCalories ? String(estimate.totalCalories) : '');
      setCaloriesPer100g(estimate.caloriesPer100g ? String(estimate.caloriesPer100g) : '');
      setCaloriesPerServing(estimate.caloriesPerServing ? String(estimate.caloriesPerServing) : '');
      setNutritionAssumptions(estimate.assumptions ?? '');
    } catch (error) {
      setEstimateError(error instanceof Error ? error.message : 'Ismeretlen hiba történt a becslés közben.');
    } finally {
      setEstimatingNutrition(false);
    }
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
          <h2 className="text-xl font-black italic tracking-wider text-white uppercase">RECEPTTÁR</h2>
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
                    <Plus size={16} /> Új Recept
                  </button>

                  {recipes.length === 0 ? (
                    <p className="text-center text-white/30 text-sm italic py-4">Még nincs feltöltve recept.</p>
                  ) : (
                    <div className="grid gap-2">
                      {recipes.map((recipe) => (
                        <div
                          key={recipe.id}
                          onClick={() => openDetails(recipe)}
                          className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-amber-500/50 cursor-pointer group transition-all"
                        >
                          <h3 className="font-bold text-white group-hover:text-amber-500 transition-colors">{recipe.title}</h3>
                          <p className="mt-1 line-clamp-2 text-xs text-white/40">{recipe.visibleDescription || recipe.description}</p>
                          {recipe.nutrition?.caloriesPer100g ? (
                            <div className="mt-2 inline-flex rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black tracking-widest text-emerald-200">
                              {recipe.nutrition.caloriesPer100g} kcal / 100 g
                            </div>
                          ) : null}
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
                      {selectedRecipe ? 'Recept szerkesztése' : 'Új finomság'}
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
                    <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Hozzávalók</label>
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
                      <Plus size={14} /> Sor hozzáadása
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase text-white/40 tracking-widest font-bold">Elkészítés</label>
                    <textarea
                      rows={8}
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                      placeholder="Írd le a lépéseket..."
                    />
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Kalória adatok</div>
                        <div className="mt-1 text-sm text-white/60">
                          Ezt hasznosítja a kalóriamérleg, amikor saját receptből próbál számolni.
                        </div>
                      </div>
                      <button
                        onClick={() => void estimateNutrition()}
                        disabled={estimatingNutrition}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        {estimatingNutrition ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Gemini receptbecslés
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="number"
                        placeholder="Kész tömeg (g)"
                        value={yieldWeightGrams}
                        onChange={(e) => setYieldWeightGrams(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/20"
                      />
                      <input
                        type="number"
                        placeholder="Adagok száma"
                        value={servings}
                        onChange={(e) => setServings(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/20"
                      />
                      <input
                        type="number"
                        placeholder="Teljes kcal"
                        value={totalCalories}
                        onChange={(e) => setTotalCalories(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/20"
                      />
                      <input
                        type="number"
                        placeholder="kcal / 100 g"
                        value={caloriesPer100g}
                        onChange={(e) => setCaloriesPer100g(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/20"
                      />
                      <input
                        type="number"
                        placeholder="kcal / adag"
                        value={caloriesPerServing}
                        onChange={(e) => setCaloriesPerServing(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/20 sm:col-span-2"
                      />
                    </div>

                    {nutritionAssumptions ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/65">
                        {nutritionAssumptions}
                      </div>
                    ) : null}
                    {estimateError ? <div className="text-sm text-rose-200">{estimateError}</div> : null}
                  </div>

                  <button
                    onClick={handleSave}
                    className="w-full py-4 bg-emerald-500 rounded-xl text-black font-black uppercase tracking-widest hover:bg-emerald-400"
                  >
                    {selectedRecipe ? 'Módosítások mentése' : 'Mentés'}
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

                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase text-white/60 mb-4 tracking-widest">
                      <ScrollText size={16} className="text-blue-500" /> Elkészítés
                    </h4>
                    <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{selectedRecipe.visibleDescription || selectedRecipe.description}</p>
                  </div>

                  {(selectedRecipe.nutrition?.caloriesPer100g ||
                    selectedRecipe.nutrition?.caloriesPerServing ||
                    selectedRecipe.nutrition?.totalCalories) ? (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-white/60">Kalória adatok</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedRecipe.nutrition?.caloriesPer100g ? (
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            kcal / 100 g
                            <div className="mt-1 text-lg font-black text-emerald-300">{selectedRecipe.nutrition.caloriesPer100g}</div>
                          </div>
                        ) : null}
                        {selectedRecipe.nutrition?.caloriesPerServing ? (
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            kcal / adag
                            <div className="mt-1 text-lg font-black text-emerald-300">{selectedRecipe.nutrition.caloriesPerServing}</div>
                          </div>
                        ) : null}
                        {selectedRecipe.nutrition?.totalCalories ? (
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            Teljes kcal
                            <div className="mt-1 text-lg font-black text-white">{selectedRecipe.nutrition.totalCalories}</div>
                          </div>
                        ) : null}
                        {selectedRecipe.nutrition?.yieldWeightGrams ? (
                          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            Kész tömeg
                            <div className="mt-1 text-lg font-black text-white">{selectedRecipe.nutrition.yieldWeightGrams} g</div>
                          </div>
                        ) : null}
                      </div>
                      {selectedRecipe.nutrition?.assumptions ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-relaxed text-white/65">
                          {selectedRecipe.nutrition.assumptions}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

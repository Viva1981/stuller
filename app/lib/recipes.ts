export type RecipeIngredient = {
  amount: string;
  name: string;
};

export type RecipeNutritionMeta = {
  yieldWeightGrams?: number | null;
  servings?: number | null;
  totalCalories?: number | null;
  caloriesPer100g?: number | null;
  caloriesPerServing?: number | null;
  assumptions?: string;
  estimatedBy?: 'manual' | 'ai';
};

export type StoredRecipe = {
  id: string;
  owner: string;
  title: string;
  description: string;
  ingredients: RecipeIngredient[];
};

export type ParsedRecipe = StoredRecipe & {
  visibleDescription: string;
  nutrition: RecipeNutritionMeta;
};

export type RecipeEstimateResult = {
  recipe: ParsedRecipe;
  matchedAmount: string;
  calculatedCalories: number;
  assumptions: string;
  reason: string;
};

const RECIPE_META_PREFIX = '__stuller_recipe_meta__:';

function normalizeNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value);
}

export function parseRecipeDescription(description: string | null | undefined) {
  const raw = description ?? '';

  if (!raw.startsWith(RECIPE_META_PREFIX)) {
    return {
      visibleDescription: raw,
      nutrition: {} satisfies RecipeNutritionMeta,
    };
  }

  const firstBreak = raw.indexOf('\n\n');
  const metaPart = firstBreak >= 0 ? raw.slice(RECIPE_META_PREFIX.length, firstBreak) : raw.slice(RECIPE_META_PREFIX.length);
  const visibleDescription = firstBreak >= 0 ? raw.slice(firstBreak + 2) : '';

  try {
    const parsed = JSON.parse(metaPart) as Record<string, unknown>;
    return {
      visibleDescription,
      nutrition: {
        yieldWeightGrams: normalizeNumber(parsed.yieldWeightGrams),
        servings: normalizeNumber(parsed.servings),
        totalCalories: normalizeNumber(parsed.totalCalories),
        caloriesPer100g: normalizeNumber(parsed.caloriesPer100g),
        caloriesPerServing: normalizeNumber(parsed.caloriesPerServing),
        assumptions: typeof parsed.assumptions === 'string' ? parsed.assumptions : '',
        estimatedBy: (parsed.estimatedBy === 'ai' ? 'ai' : 'manual') as RecipeNutritionMeta['estimatedBy'],
      } satisfies RecipeNutritionMeta,
    };
  } catch {
    return {
      visibleDescription: raw,
      nutrition: {} satisfies RecipeNutritionMeta,
    };
  }
}

export function buildRecipeDescription(visibleDescription: string, nutrition: RecipeNutritionMeta) {
  const cleanedDescription = visibleDescription.trim();
  const normalizedMeta = {
    ...(nutrition.yieldWeightGrams ? { yieldWeightGrams: Math.round(nutrition.yieldWeightGrams) } : {}),
    ...(nutrition.servings ? { servings: Math.round(nutrition.servings) } : {}),
    ...(nutrition.totalCalories ? { totalCalories: Math.round(nutrition.totalCalories) } : {}),
    ...(nutrition.caloriesPer100g ? { caloriesPer100g: Math.round(nutrition.caloriesPer100g) } : {}),
    ...(nutrition.caloriesPerServing ? { caloriesPerServing: Math.round(nutrition.caloriesPerServing) } : {}),
    ...(nutrition.assumptions?.trim() ? { assumptions: nutrition.assumptions.trim() } : {}),
    ...(nutrition.estimatedBy ? { estimatedBy: nutrition.estimatedBy } : {}),
  };

  if (Object.keys(normalizedMeta).length === 0) {
    return cleanedDescription;
  }

  return `${RECIPE_META_PREFIX}${JSON.stringify(normalizedMeta)}\n\n${cleanedDescription}`;
}

export function parseRecipeRecord(recipe: StoredRecipe): ParsedRecipe {
  const parsed = parseRecipeDescription(recipe.description);
  return {
    ...recipe,
    visibleDescription: parsed.visibleDescription,
    nutrition: parsed.nutrition,
  };
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('hu-HU')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function parseServingCount(normalizedText: string) {
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(adag|adagot|adagnyi)\b/u,
    /(\d+(?:[.,]\d+)?)\s*(szelet|szeletet)\b/u,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      return {
        amountText: match[0],
        count: Number(match[1].replace(',', '.')),
      };
    }
  }

  if (/\bfel adag\b/u.test(normalizedText)) {
    return {
      amountText: 'fél adag',
      count: 0.5,
    };
  }

  return null;
}

function parseWeightInGrams(normalizedText: string) {
  const gramsPattern = /(\d+(?:[.,]\d+)?)\s*(g|gramm)\b/u;
  const dekagramPattern = /(\d+(?:[.,]\d+)?)\s*(dkg|deka)\b/u;
  const kiloPattern = /(\d+(?:[.,]\d+)?)\s*(kg|kilogramm)\b/u;

  const gramsMatch = normalizedText.match(gramsPattern);
  if (gramsMatch) {
    return {
      amountText: gramsMatch[0],
      grams: Math.round(Number(gramsMatch[1].replace(',', '.'))),
    };
  }

  const dekagramMatch = normalizedText.match(dekagramPattern);
  if (dekagramMatch) {
    return {
      amountText: dekagramMatch[0],
      grams: Math.round(Number(dekagramMatch[1].replace(',', '.')) * 10),
    };
  }

  const kiloMatch = normalizedText.match(kiloPattern);
  if (kiloMatch) {
    return {
      amountText: kiloMatch[0],
      grams: Math.round(Number(kiloMatch[1].replace(',', '.')) * 1000),
    };
  }

  return null;
}

export function estimateCaloriesFromRecipes(input: string, recipes: ParsedRecipe[]) {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) {
    return null;
  }

  const matchingRecipe = [...recipes]
    .filter((recipe) => {
      const normalizedTitle = normalizeText(recipe.title);
      return normalizedTitle && normalizedInput.includes(normalizedTitle);
    })
    .sort((left, right) => normalizeText(right.title).length - normalizeText(left.title).length)[0];

  if (!matchingRecipe) {
    return null;
  }

  const weightAmount = parseWeightInGrams(normalizedInput);
  const servingAmount = parseServingCount(normalizedInput);
  const nutrition = matchingRecipe.nutrition;

  if (weightAmount && nutrition.caloriesPer100g) {
    return {
      recipe: matchingRecipe,
      matchedAmount: weightAmount.amountText,
      calculatedCalories: Math.round((nutrition.caloriesPer100g * weightAmount.grams) / 100),
      assumptions: `Saját recept alapján számolva (${nutrition.caloriesPer100g} kcal / 100 g).`,
      reason: `${weightAmount.grams} g × ${nutrition.caloriesPer100g} kcal / 100 g`,
    } satisfies RecipeEstimateResult;
  }

  if (weightAmount && nutrition.totalCalories && nutrition.yieldWeightGrams) {
    const caloriesPer100g = Math.round((nutrition.totalCalories / nutrition.yieldWeightGrams) * 100);
    return {
      recipe: matchingRecipe,
      matchedAmount: weightAmount.amountText,
      calculatedCalories: Math.round((caloriesPer100g * weightAmount.grams) / 100),
      assumptions: `Saját recept alapján számolva a teljes recept tömegéből (${nutrition.yieldWeightGrams} g).`,
      reason: `${weightAmount.grams} g × ${caloriesPer100g} kcal / 100 g`,
    } satisfies RecipeEstimateResult;
  }

  if (servingAmount && nutrition.caloriesPerServing) {
    return {
      recipe: matchingRecipe,
      matchedAmount: servingAmount.amountText,
      calculatedCalories: Math.round(nutrition.caloriesPerServing * servingAmount.count),
      assumptions: `Saját recept alapján számolva (${nutrition.caloriesPerServing} kcal / adag).`,
      reason: `${servingAmount.count} adag × ${nutrition.caloriesPerServing} kcal`,
    } satisfies RecipeEstimateResult;
  }

  if (!weightAmount && !servingAmount && nutrition.caloriesPerServing) {
    return {
      recipe: matchingRecipe,
      matchedAmount: '1 adag',
      calculatedCalories: nutrition.caloriesPerServing,
      assumptions: 'Saját recept alapján 1 adagot feltételezve.',
      reason: `1 adag × ${nutrition.caloriesPerServing} kcal`,
    } satisfies RecipeEstimateResult;
  }

  if (!weightAmount && !servingAmount && nutrition.caloriesPer100g) {
    return {
      recipe: matchingRecipe,
      matchedAmount: '100 g',
      calculatedCalories: nutrition.caloriesPer100g,
      assumptions: 'Saját recept alapján 100 grammos mintamennyiséget feltételezve, mert nem volt megadott adag.',
      reason: `${nutrition.caloriesPer100g} kcal / 100 g`,
    } satisfies RecipeEstimateResult;
  }

  return null;
}

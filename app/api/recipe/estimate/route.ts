import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type RecipeEstimateRequest = {
  owner?: string;
  title?: string;
  description?: string;
  ingredients?: Array<{
    amount?: string;
    name?: string;
  }>;
};

type RecipeNutritionEstimate = {
  yieldWeightGrams: number;
  servings: number;
  totalCalories: number;
  caloriesPer100g: number;
  caloriesPerServing: number;
  assumptions: string;
};

function normalizeEstimate(input: unknown): RecipeNutritionEstimate {
  const value = (input ?? {}) as Record<string, unknown>;
  return {
    yieldWeightGrams: Math.max(0, Math.round(Number(value.yieldWeightGrams ?? 0))),
    servings: Math.max(0, Math.round(Number(value.servings ?? 0))),
    totalCalories: Math.max(0, Math.round(Number(value.totalCalories ?? 0))),
    caloriesPer100g: Math.max(0, Math.round(Number(value.caloriesPer100g ?? 0))),
    caloriesPerServing: Math.max(0, Math.round(Number(value.caloriesPerServing ?? 0))),
    assumptions: String(value.assumptions ?? ''),
  };
}

function buildPrompt(body: RecipeEstimateRequest) {
  const title = body.title?.trim() || 'Névtelen recept';
  const description = body.description?.trim() || 'Nincs külön elkészítési leírás.';
  const ingredients = (body.ingredients ?? [])
    .filter((ingredient) => ingredient.name?.trim())
    .map((ingredient) => `- ${ingredient.amount?.trim() || 'ismeretlen mennyiség'} ${ingredient.name?.trim()}`)
    .join('\n');

  return `
Te egy magyar nyelvű recept-kalóriabecslő asszisztens vagy.
A feladatod: a megadott recepthez adj óvatos, hasznos, főzés közben is használható becslést.

Szabályok:
- Kizárólag JSON-t adj vissza.
- Ne tégy úgy, mintha laborpontosságú adatod lenne.
- Inkább konzervatív, reális becslést adj.
- Minden szám egész szám legyen.
- Ha valami hiányzik, használj ésszerű feltételezést, és ezt írd bele az assumptions mezőbe.

Visszaadandó JSON:
{
  "yieldWeightGrams": 0,
  "servings": 0,
  "totalCalories": 0,
  "caloriesPer100g": 0,
  "caloriesPerServing": 0,
  "assumptions": ""
}

Recept neve: ${title}

Hozzávalók:
${ingredients || '- nincs külön hozzávalólista'}

Elkészítés:
${description}
`.trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'A GEMINI_API_KEY környezeti változó nincs beállítva.' }, { status: 500 });
    }

    const body = (await request.json()) as RecipeEstimateRequest;
    if (!body.title?.trim() && !(body.ingredients ?? []).some((ingredient) => ingredient.name?.trim())) {
      return NextResponse.json({ error: 'Adj meg legalább receptnevet vagy hozzávalókat.' }, { status: 400 });
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildPrompt(body) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message || 'A Gemini receptbecslés sikertelen volt.' },
        { status: response.status }
      );
    }

    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ error: 'A Gemini nem adott vissza értelmezhető receptbecslést.' }, { status: 502 });
    }

    const estimate = normalizeEstimate(JSON.parse(rawText));
    return NextResponse.json({ estimate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

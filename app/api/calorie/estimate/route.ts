import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type EstimateMode = 'meal' | 'exercise';

type EstimateRequest = {
  owner?: string;
  text?: string;
  mode?: EstimateMode;
  profile?: {
    heightCm?: number | null;
    ageYears?: number | null;
    sex?: 'male' | 'female' | null;
    activityLevel?: string | null;
    latestWeightKg?: number | null;
    effectiveMaintenance?: number | null;
  };
};

type GeminiEstimate = {
  totalCalories: number;
  items: Array<{
    name: string;
    estimatedCalories: number;
    reason: string;
  }>;
  assumptions: string;
  confidence: number;
};

function normalizeEstimate(input: unknown): GeminiEstimate {
  const value = (input ?? {}) as Record<string, unknown>;
  const items = Array.isArray(value.items)
    ? value.items.map((item) => {
        const typed = item as Record<string, unknown>;
        return {
          name: String(typed.name ?? 'Ismeretlen tétel'),
          estimatedCalories: Number(typed.estimatedCalories ?? 0),
          reason: String(typed.reason ?? ''),
        };
      })
    : [];

  return {
    totalCalories: Math.max(0, Math.round(Number(value.totalCalories ?? 0))),
    items,
    assumptions: String(value.assumptions ?? ''),
    confidence: Math.max(0, Math.min(100, Math.round(Number(value.confidence ?? 50)))),
  };
}

function buildPrompt(body: EstimateRequest) {
  const mode = body.mode ?? 'meal';
  const owner = body.owner?.trim() || 'Családtag';
  const text = body.text?.trim() || '';
  const profile = body.profile ?? {};

  const profileContext = `
Felhasználó: ${owner}
Nem: ${profile.sex ?? 'ismeretlen'}
Életkor: ${profile.ageYears ?? 'ismeretlen'}
Magasság: ${profile.heightCm ?? 'ismeretlen'} cm
Legutóbbi súly: ${profile.latestWeightKg ?? 'ismeretlen'} kg
Életmód: ${profile.activityLevel ?? 'ismeretlen'}
Jelenlegi napi alap becslés: ${profile.effectiveMaintenance ?? 'ismeretlen'} kcal
`.trim();

  if (mode === 'exercise') {
    return `
Te egy magyar nyelvű mozgás-kalóriabecslő asszisztens vagy.
A feladatod: a felhasználó mozgásleírása alapján becsüld meg a plusz, edzésből vagy aktivitásból származó elégetett kalóriát.
Fontos: ez extra mozgás, nem a teljes napi alapanyagcsere.

Szabályok:
- Kizárólag JSON-t adj vissza.
- Légy konzervatív, ne adj túlzó becslést.
- Vedd figyelembe a testsúlyt, nemet, életkort és aktivitási szintet, ha van adat.
- A totalCalories egész szám legyen.
- Az items tömbben bontsd szét a tevékenységet logikus elemekre, ha kell.
- A confidence 0 és 100 közötti egész szám legyen.

Visszaadandó JSON:
{
  "totalCalories": 0,
  "items": [
    {
      "name": "",
      "estimatedCalories": 0,
      "reason": ""
    }
  ],
  "assumptions": "",
  "confidence": 0
}

${profileContext}
Mozgás leírása: ${text}
`.trim();
  }

  return `
Te egy magyar nyelvű kalóriabecslő asszisztens vagy.
A feladatod: a felhasználó rövid étkezésleírásából készíts óvatos, reális kalóriabecslést.

Szabályok:
- Kizárólag JSON-t adj vissza.
- Ne állíts biztos értéket, ha csak becslés lehetséges.
- Légy óvatos, konzervatív becslést adj.
- A totalCalories egész szám legyen.
- Az items tömbben minden tételhez add meg a nevet, becsült kalóriát és rövid indokot.
- A confidence 0 és 100 közötti egész szám legyen.

Visszaadandó JSON:
{
  "totalCalories": 0,
  "items": [
    {
      "name": "",
      "estimatedCalories": 0,
      "reason": ""
    }
  ],
  "assumptions": "",
  "confidence": 0
}

${profileContext}
Étkezés leírása: ${text}
`.trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'A GEMINI_API_KEY környezeti változó nincs beállítva.' }, { status: 500 });
    }

    const body = (await request.json()) as EstimateRequest;
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'Hiányzik a leírás.' }, { status: 400 });
    }

    const prompt = buildPrompt(body);

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
              parts: [{ text: prompt }],
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
        { error: payload.error?.message || 'A Gemini API hívás sikertelen volt.' },
        { status: response.status }
      );
    }

    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ error: 'A Gemini nem adott vissza értelmezhető választ.' }, { status: 502 });
    }

    const parsed = JSON.parse(rawText) as unknown;
    const estimate = normalizeEstimate(parsed);

    return NextResponse.json({ estimate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

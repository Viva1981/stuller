import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type EstimateRequest = {
  owner?: string;
  text?: string;
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
    totalCalories: Number(value.totalCalories ?? 0),
    items,
    assumptions: String(value.assumptions ?? ''),
    confidence: Math.max(0, Math.min(100, Number(value.confidence ?? 50))),
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'A GEMINI_API_KEY környezeti változó nincs beállítva.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as EstimateRequest;
    const text = body.text?.trim();
    const owner = body.owner?.trim() || 'Családtag';

    if (!text) {
      return NextResponse.json({ error: 'Hiányzik az étkezés leírása.' }, { status: 400 });
    }

    const prompt = `
Te egy kalóriabecslő asszisztens vagy magyar nyelven.
A feladatod: a felhasználó rövid étkezésleírásából készíts óvatos, reális becslést.

Fontos szabályok:
- Ne állíts biztos értéket, ha csak becslés lehetséges.
- Magyarul gondolkodj, de kizárólag JSON-t adj vissza.
- A totalCalories legyen egész szám.
- Az items tömbben minden tételhez add meg a nevet, becsült kalóriát és rövid indokot.
- Az assumptions mezőbe írd le röviden, milyen feltételezésekkel számoltál.
- A confidence legyen 0 és 100 közötti egész szám.
- Ha valami nagyon bizonytalan, inkább konzervatív becslést adj.

Visszaadandó JSON szerkezet:
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

Felhasználó: ${owner}
Étkezés leírása: ${text}
`.trim();

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

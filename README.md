# Stuller családi app

Next.js + Supabase alapú családi PWA.

## Fő modulok

- családi naptár
- bevásárlólista
- menütervező
- Rocka elszámolás
- push értesítések
- otthon / jelenlét modul
- személyes súlynapló
- személyes kalóriamérleg

## Fejlesztői indítás

```bash
npm install
npm run dev
```

## Szükséges környezeti változók

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
HOUSE_SENSOR_TOKEN=
GEMINI_API_KEY=
```

## Otthon modul

Az otthon modul fő táblái:

- `house_devices`
- `house_observations`
- `house_presence`
- `house_events`

Nyers megfigyelések ide érkeznek:

- `GET /api/house/config`
- `POST /api/house/ingest`

Hitelesítés:

- `Authorization: Bearer <HOUSE_SENSOR_TOKEN>`
  vagy
- `x-sensor-token: <HOUSE_SENSOR_TOKEN>`

Minta kérés:

```json
{
  "sensorLabel": "redmi-note-9-pro",
  "observations": [
    {
      "slug": "apa-telefonja",
      "reachabilityState": "online",
      "latencyMs": 12,
      "ipAddress": "192.168.0.55",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "confidence": 95
    },
    {
      "slug": "adel-lampaja",
      "powerState": "on",
      "confidence": 100
    }
  ]
}
```

Az ingest route:

- eltárolja a nyers megfigyelést
- frissíti az eszköz állapotát
- jelenléti állapotot számol
- eseményt generál

Az Android szenzor külön projektben található:

- `android-house-sensor`

## Kalóriamérleg modul

Az új személyes kalóriamérleg modul táblái:

- `calorie_profiles`
- `calorie_logs`

Mit tud jelenleg:

- személyes napi alap / fenntartó kcal beállítás
- napi bevitt kalória mentése
- extra mozgás / elégetett kalória mentése
- napi egyenleg számítása
- egyszerű státusz: deficitben / nagyjából szinten / többletben
- Gemini-alapú gyors étkezésbecslés a `POST /api/calorie/estimate` végponton keresztül

A Gemini becslőhöz szükséges:

- `GEMINI_API_KEY`

## Ajánlott rendszerkép

1. a családi dashboard `Otthon` paneljén felveszed az eszközöket
2. az otthon hagyott Android szenzor POST-ol az ingest endpointnak
3. a PWA realtime-ban mutatja az állapotot és az eseményeket
4. a személyes oldalakon külön owner-alapon mennek a testsúly- és kalóriamérleg adatok

## Ellenőrzés

```bash
npm run lint
npm run build
```

### Frissítés: több tételes napi kalórianapló

A kalóriamérleg most már a `calorie_entries` táblát használja a részletes naplózáshoz.

Mit jelent ez:
- egy napon belül több külön étkezés is menthető
- egy napon belül több külön mozgás is menthető
- a napi összesítés ezekből a tételekből számolódik
- a korábbi sablonok továbbra is újrahasználhatók

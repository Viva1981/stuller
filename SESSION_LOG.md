# Session Log

## 2026-03-13 20:21 +01:00

### Otthon / jelenlét modul

- új Supabase séma felkerült:
  - `house_devices`
  - `house_observations`
  - `house_presence`
  - `house_events`
- új ingest API készült:
  - `POST /api/house/ingest`
  - tokenes védelem `HOUSE_SENSOR_TOKEN` env változóval
- szerveroldali feldolgozás elkészült:
  - érkezés / távozás események
  - eszköz online / offline események
  - lámpa fel / le kapcsolás események
  - push értesítés a meglévő `push_subscriptions` infrastruktúrára építve

### UI

- új `Otthon` panel került a családi dashboardba
- lehet eszközöket felvenni, szerkeszteni, törölni
- látszik az aktuális jelenlét, eszközállapot és az otthoni eseménynapló

### Közös segédfájlok

- létrejött a közös családi metadata:
  - `app/lib/family.ts`
- létrejött a közös otthon modul típus- és helper készlet:
  - `app/lib/house.ts`
- létrejött a szerveres Supabase admin kliens helper:
  - `app/lib/server/supabase-admin.ts`
- létrejött a szerveres push helper:
  - `app/lib/server/push.ts`

### Magyar szövegek / dokumentáció

- javítva lett néhány hibásan kódolt magyar szöveg
- frissült a `README.md` az otthon modul és ingest endpoint leírásával

### Ellenőrzés

- `npm run lint` lefutott
  - maradt 2 régi warning a `SchoolTimetable.tsx` fájlban, nem az új modulból
- `npm run build` sikeres

### Supabase security megjegyzés

- az új house függvények `search_path` figyelmeztetése javítva lett
- a régi projektben továbbra is maradtak korábbi, laza RLS policy-k és egy RLS nélküli tábla:
  - `meal_ratings`
  - `events`
  - `meal_planner`
  - `push_subscriptions`
  - `recipes`
  - `rocka_billing`
  - `school_timetable`
  - `shopping_list`
  - `weight_logs`

### Következő jó lépések

1. Android szenzor kliens első verziója a Redmi telefonra
2. régi Supabase RLS policy-k auditált szigorítása
3. otthon modul értesítési beállítások családtagonként

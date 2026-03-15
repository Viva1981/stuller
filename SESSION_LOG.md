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

### Dokumentáció

- frissült a `README.md` az otthon modul és ingest endpoint leírásával

### Ellenőrzés

- `npm run lint` lefutott
  - maradt 2 régi warning a `SchoolTimetable.tsx` fájlban, nem az új modulból
- `npm run build` sikeres

## 2026-03-13 20:30 +01:00

### Otthon panel UI finomítás

- az `Otthon` szekció átkerült a `RockaBilling` blokk alá
- az `Otthon` szekció lenyíló panelként működik, a meglévő dashboard blokkokkal egységes mintában

### Ellenőrzés

- `npm run lint` továbbra is sikeres az új változtatásokkal
- `npm run build` továbbra is sikeres

## 2026-03-13 20:45 +01:00

### Android szenzor MVP

- új backend végpont készült a szenzor számára:
  - `GET /api/house/config`
- új külön Android projekt került a repóba:
  - `android-house-sensor`
- az Android app első verziója tudja:
  - URL és token mentése
  - foreground service indítása
  - aktív eszközlista letöltése a config végpontról
  - `ping` alapú reachability mérést
  - megfigyelések feltöltését a `POST /api/house/ingest` végpontra

### Korlát

- ezen a gépen nincs teljes Android SDK / Gradle / Java eszközlánc a CLI-ben, ezért a build végigellenőrzése részben Android Studio-val történt

## 2026-03-15 18:45 +01:00

### Otthon panel mobilos rendezés

- az `Otthon` blokk mobil fejlécét a többi lenyíló panel mintájához igazítottam
- a felső sorban maradt a cím és a nyitás/zárás vezérlés, a műveleti gomb külön, tisztábban elkülönül
- a státusz badge és a `Frissítés` gomb mobilon külön sorba került, így nem csúszik szét a fejléc
- az eseménylistából kikerült a push értesítéshez kapcsolódó vizuális jelölés

### Push értesítések kivezetése az Otthon modulból

- a `POST /api/house/ingest` feldolgozás már nem küld push értesítést
- az otthoni események továbbra is bekerülnek a `house_events` táblába
- az `arrival`, `departure`, `light_on`, `light_off` és reachability események mostantól csak naplózódnak

### Magyar szövegek és kódolás

- az `Otthon` panel felhasználói szövegei UTF-8-ra lettek javítva
- a `house` helper címkéi és időbélyeg-formázó szövegei is javítva lettek
- a `SESSION_LOG.md` fájl is újra UTF-8 tartalommal került mentésre

### Android projekt stabilizálás

- bekerült az Android Gradle wrapper a repóba
- a szükséges Android build javítások commitra készek:
  - AGP frissítés `8.13.2`-re
  - Material dependency
  - kompatibilis téma (`Theme.MaterialComponents.DayNight.NoActionBar`)
  - `android.suppressUnsupportedCompileSdk=35`
- a `.gitignore` frissült az Android generált fájlokra

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-15 20:05 +01:00

### Kalóriamérleg MVP

- új Supabase tábla került be: `calorie_logs`
- az új tábla owner + date alapon egyedi naplózást támogat
- bekerült az első `CalorieBalanceTracker` komponens a személyes modulok közé
- a modul tudja:
  - napi kalóriacél rögzítését
  - bevitt kalória rögzítését
  - extra mozgás / elégetett kalória rögzítését
  - napi egyenleg számítását
  - egyszerű státuszt mutatni: deficitben / nagyjából szinten / többletben
  - időszakos trendgrafikont mutatni
  - átlagolt összegzést mutatni a kiválasztott időszakra
- a napi cél az utolsó mentett érték alapján automatikusan előtöltődik, hogy kevesebb legyen a napi adatbevitel

### Bekötés a személyes oldalakra

- a modul bekerült mind a négy személyes oldalra:
  - `Zsolt`
  - `Andrea`
  - `Adél`
  - `Zsombor`
- minden oldal saját `owner` alapján a saját adatait látja, ugyanúgy, mint a súlynapló

### MVP döntések

- a Gemini API most még szándékosan nincs bekötve
- első körben a gyors, stabil, kézi rögzítés került bevezetésre
- a következő természetes bővítés lehet egy AI-segített szöveges étkezésbevitel, de csak az alapmodul stabil használata után

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

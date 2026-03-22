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

## 2026-03-15 20:40 +01:00

### Kalóriamérleg bővítés: fenntartó kcal + Gemini gyors bevitel

- új Supabase tábla került be: `calorie_profiles`
- személyenként külön menthető napi alap / fenntartó kalóriaérték
- a kalóriamérleg modul most már nem napi kézi célértékre épít, hanem a személyes fenntartó kcal profilra
- a napi egyenleg számítása így történik:
  - `bevitt kcal - extra mozgás - fenntartó kcal`
- bekerült egy új API végpont:
  - `POST /api/calorie/estimate`
- ez a végpont Gemini segítségével becslést kér egy szöveges étkezésleírásból
- a becslés eredménye:
  - összes becsült kalória
  - tételes bontás
  - rövid feltételezések
  - megbízhatósági százalék
- a becslés nem ment automatikusan, csak előtölti a mezőket, így a felhasználó marad kontrollban

### Használat

- először érdemes beállítani a személyes napi alap kalóriát
- utána lehet:
  - kézzel beírni a bevitt kalóriát
  - vagy a Gemini gyors bevitellel becsültetni
- az extra mozgás külön mezőben levonható a napi egyenlegből

### Környezeti változó

- az AI becsléshez szükséges új env:
  - `GEMINI_API_KEY`

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-15 21:15 +01:00

### Kalóriamérleg bővítés: profil alapú számolás és sablonok

- a kalóriamérleg most már a személyes profilból számol napi alap kalóriaigényt
- a profilban menthető:
  - magasság
  - életkor
  - nem
  - aktivitási szint
  - tartalék kézi alap kcal érték
- a számolás a legutóbbi `weight_logs` bejegyzést is figyelembe veszi
- ha nincs elég profil- vagy súlyadat, akkor a tartalék alap kcal értéket használja

### Gemini étkezés és mozgás becslés

- a Gemini becslő most már két módot támogat:
  - étkezés
  - extra mozgás
- a mozgásbecslés a profiladatokat és a legutóbbi testsúlyt is megkapja kontextusként
- az AI továbbra sem ment automatikusan, csak előtölti a mezőket

### Újrahasználható sablonok

- bekerült a korábbi étkezések és mozgások újrahasználhatósága
- a mentett nap alapján automatikusan menthetők újrahasználható sablonok
- a sablonok owner szerint különülnek el
- egy korábbi étkezés vagy mozgás egy gombnyomással visszatölthető, így nem kell újra AI-t hívni vagy kézzel újraírni

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-15 21:35 +01:00

### Kalóriamérleg javítás: csak mozgás mentése

- a kalóriamérleg mentése már nem követeli meg, hogy legyen bevitt kalória is
- most már elmenthető egy olyan nap is, ahol csak extra mozgás / elégetett kalória lett rögzítve
- a mentés feltétele most:
  - legyen számolható vagy kézi alap kcal
  - legyen dátum
  - és legyen legalább étkezés vagy mozgás adat
- a sablonmentés is ehhez igazodott, így a csak mozgásos napokból is készülhet újrahasználható mozgás preset

## 2026-03-15 22:15 +01:00

### Kalóriamérleg több tételes naplózás

- a kalóriamérleg mostantól nem napi egyetlen rekorddal dolgozik, hanem külön `calorie_entries` tételekkel
- egy napon belül több étkezés és több mozgás is külön menthető
- a napi összesítés, grafikon és átlagok ezekből a tételekből állnak össze
- a mentés most már új bejegyzést ad hozzá a kiválasztott naphoz, nem felülírja a korábbit
- bekerült egy napi tétellista is, így rögtön látszik ugyanarra a napra az összes étkezés és mozgás
- a korábbi `calorie_logs` adatok migrálva lettek az új `calorie_entries` táblába

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-15 22:35 +01:00

### Kalóriatétel szerkesztés és törlés

- a napi tétellistából most már egy korábbi étkezés vagy mozgás betölthető szerkesztésre
- szerkesztéskor az űrlap a kiválasztott tétel adatait tölti be, és a mentés azt az egy bejegyzést frissíti
- bekerült a tétel törlése is közvetlenül a napi listában
- a szerkesztési mód külön vizuális jelzést kapott, és egy gombbal megszakítható

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-15 22:45 +01:00

### Kalóriamérleg mobil finomítás

- az extra mozgás mező alapértéke most már üres, nem zavar be egy előre beírt `0`
- a megjegyzés + mentés sáv mobilon egymás alá törik, így a `Hozzáadás` gomb nem lóg ki keskeny kijelzőn

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-16 19:10 +01:00

### Google login session javítás

- a Google OAuth belépés most már külön `/auth/callback` oldalon véglegesíti a sessiont
- a callback oldalon megtörténik a `code` cseréje valódi Supabase sessionre
- a fő login oldal most belépett felhasználónál automatikusan továbbdob a dashboardra
- a kliens oldali Supabase auth beállítások expliciten bekapcsolják a session megőrzést és az URL-ből való felismerést
- ez a javítás a webes és a PWA használatnál is azt célozza, hogy ne kelljen minden megnyitásnál újra Google-lel belépni

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-16 19:25 +01:00

### Kanonikus domain és auth session stabilizálás

- bekerült egy központi kanonikus app URL helper (`stuller.vercel.app` fallbackkel)
- a Google OAuth login most már mindig a kanonikus domain callback URL-jére tér vissza
- bekerült egy kliensoldali kanonikus redirect is, ami preview Vercel domainről automatikusan visszairányít a fix app domainre
- ez azért fontos, mert a Supabase session originhez kötött, és a preview URL másik originnek számít

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-22 18:20 +01:00

### Kalóriamérleg napi alap egységesítés

- a napi összesítés eddig a mentett tételek `maintenance_calories` snapshotjából dolgozott, miközben a profilkártya a frissen számolt aktuális alapot mutatta
- emiatt a mai napnál eltérhetett a kártyán látható `Napi alap most` és az összesítő `Napi alap` érték
- a mai nap aggregálása most már mindig a friss, aktuálisan számolt napi alapot használja
- a múltbeli napok továbbra is a saját elmentett snapshotjukból maradnak visszanézhetők
- profilmentéskor a mai napi bejegyzések snapshotja is frissül az új számolt alapra, így a meglévő mai tételek sem maradnak régi alappal

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-22 18:45 +01:00

### Kalóriamérleg UX finomítások

- a `Személyes alapadatok` blokk mostantól lenyíló
- kikerült a kézi `Tartalék alap kcal` mező a felületről
- a profilmentés most a megadott adatokból számolt napi alapot menti vissza
- a diagram alatti átlagkártya kikerült
- a `Gemini gyors étkezés` és `Gemini gyors mozgás` blokk külön lenyíló lett
- a preseteknél megjelent a kedvencek jelölése
- a kedvencek külön lenyíló blokkban jelennek meg, és a többi sablon elé kerülnek
- a kedvencek jelenleg ugyanazon origin localStorage-jában tárolódnak, így a PWA-ban és ugyanazon domainen megmaradnak
- a sablonok szövege már nincs levágva és nincs mesterségesen kapitalizálva vagy uppercaselve
- a rögzített napi tételeknél is teljes szöveg jelenik meg, tördeléssel
- a zavaró magyarázó szöveg a beviteli blokk alól kikerült
- a `Napi tételek` fejléc kapott bal/jobb napléptetést
- a fejléc kompakt módon mutatja az adott nap státuszát és egyenlegét
- a `Napi tételek` blokk kapott egy lábléc-összesítőt: napi alap, bevitt, mozgás, napi summa

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-22 21:55 +01:00

### Kalóriamérleg mobilos fejléc és zárt alapállapot

- a kalóriamérleg összes lenyíló része alapból zárt állapotból indul
- a `Gemini gyors étkezés`, `Gemini gyors mozgás`, kedvencek és alapadatok blokkok első betöltéskor nem nyílnak ki automatikusan
- a `Napi tételek` mobilos fejlécének elrendezése átalakult, hogy keskeny kijelzőn ne csússzanak egymásra a dátum, a státusz és a navigációs elemek
- a fejléc középső tartalma mobilon függőlegesebb, olvashatóbb tördelést kapott, így a napi státusz badge nem nyomja szét a dátum sort

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-22 22:35 +01:00

### Kalóriamérleg: Supabase-kedvencek, időpont és napi fókusz

- a kalóriamérleg kedvenc sablonjai már nem localStorage-ben élnek, hanem a meglévő `calorie_presets` Supabase rekordok metaadatában
- ezzel a kedvencek owner-alapon a felhasználóhoz kötődnek, és ugyanazon fiókkal több eszközről is megmaradnak
- a napi tételekhez bekerült külön időpont megadása (`HH:mm`), ami a meglévő `calorie_entries` rekordok metaadatában mentődik
- a napi tétellista időpont szerint rendeződik, és a soroknál megjelenik a mentett idő is
- a rögzített tételek megjegyzései most már a tisztított, felhasználói szöveget mutatják, nem a háttér-metaadatot
- bekerült egy külön felső `Mai fókusz` blokk, ami megmutatja, hogy ma még mennyi fér bele vagy mennyivel lett túllépve a napi keret
- a fókuszblokk külön mutatja a napi alap, bevitt és mozgási adatokat is, hogy ne kelljen azonnal a napi tételek láblécéhez lemenni
- a megoldás szándékosan a meglévő Supabase táblákra épül, így ehhez a körhöz nem kellett külön séma-migráció

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-22 23:20 +01:00

### Recepttár bővítés és recept-first kalóriabecslés

- a `RecipeBook` modul bekerült Zsolt személyes oldalára is, így Andrea mellett Zsolt alatt is használható a recepttár
- a receptleírás most opcionális, beágyazott táplálkozási metaadatot is tud tárolni a meglévő `recipes` rekordokban külön séma-migráció nélkül
- a receptűrlap kapott egy új `Kalória adatok` blokkot a következő mezőkkel:
  - kész tömeg grammban
  - adagok száma
  - teljes kcal
  - kcal / 100 g
  - kcal / adag
- bekerült egy új `POST /api/recipe/estimate` végpont, ami Gemini segítségével receptszintű kalóriabecslést készít a recept neve, hozzávalói és elkészítése alapján
- a receptűrlapon a `Gemini receptbecslés` gomb ezekkel az értékekkel elő tudja tölteni a kalóriás mezőket főzés közbeni rögzítéshez is
- a kalóriamérleg `POST /api/calorie/estimate` route-ja most már étkezésnél először a saját recepteket próbálja egyeztetni az adott owner alatt
- ha van recepttalálat és a recepthez van használható kalóriaadat, abból számol kcal-t mennyiség alapján (pl. gramm, dkg, adag, szelet)
- ha nincs elég receptadat vagy nincs találat, akkor a korábbi Gemini fallback becslés fut tovább
- a receptlista és recept-részletek most már meg tudják jeleníteni a recepthez mentett kalóriaadatokat is

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

## 2026-03-22 23:45 +01:00

### Receptleírás meta-kijelzés javítás és családi receptfallback

- a recept részleteinél és a receptlista kivonatában többé nem jelenik meg nyersen a beágyazott recept-meta JSON
- ha a recepthez nincs külön szöveges elkészítési leírás, akkor kulturált fallback szöveg jelenik meg a nyers meta helyett
- a kalóriamérleg recept alapú becslése most már nem csak az adott owner receptjeit látja
- a route a család összes receptjét figyelembe veszi, de az aktuális user saját receptjeit prioritással kezeli találat esetén
- ha a találat nem a saját receptből jön, a visszaadott indoklás ezt külön jelzi

### Ellenőrzés

- `npm run lint` lefutott
  - továbbra is csak a két régi `SchoolTimetable.tsx` warning maradt
- `npm run build` sikeres

# House Sensor Android

Android MVP szenzor app a `stuller` családi PWA `Otthon` moduljához.

## Mit tud ez az első verzió

- letölti az aktív `house_devices` listát a `GET /api/house/config` végpontról
- foreground service módban időközönként reachability mérést végez
- az eredményt elküldi a `POST /api/house/ingest` végpontra
- kézzel indítható és leállítható
- a beállítások helyben mentődnek

## Fontos korlát

Ez az MVP csak a `ping` jellegű reachability megfigyelést támogatja.

## Telepítés

1. Nyisd meg az `android-house-sensor` mappát Android Studio-ban.
2. Állíts be egy valódi Android SDK-t.
3. Fordítsd és telepítsd a Redmi telefonra.
4. Az appban add meg:
   - a családi webapp alap URL-jét
   - a `HOUSE_SENSOR_TOKEN` értékét
   - a szenzor címkéjét
5. Indítsd el a figyelést.

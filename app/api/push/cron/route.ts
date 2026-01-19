import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Segédfüggvény: Ellenőrzi, hogy érvényes feliratkozás-e
const isValidSubscription = (sub: any) => {
  return sub && sub.endpoint && sub.keys && sub.keys.auth && sub.keys.p256dh;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  console.log('--- 🤖 CRON ROBOT INDUL (JAVÍTOTT) ---');
  
  // 1. lépés: Jelenlegi idő meghatározása Budapest időzónában
  const nowUTC = new Date();
  
  // Trükk: Létrehozunk egy Date objektumot, ami úgy tesz, mintha UTC lenne, 
  // de a számértéke a magyar időt mutatja. Így könnyű kivonni egymásból a DB időt és ezt.
  const timeZone = "Europe/Budapest";
  const nowInBudapest = new Date(nowUTC.toLocaleString("en-US", { timeZone }));

  console.log(`Időellenőrzés: UTC: ${nowUTC.toISOString()} | HU (kalkulált): ${nowInBudapest.toISOString()}`);

  try {
    // 2. lépés: Feliratkozók lekérése
    const { data: rawSubs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_json');
    
    if (subError) throw subError;

    // JSON stringek parszolása és szűrése
    const subs = rawSubs
      ?.map(s => (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json))
      .filter(isValidSubscription);

    if (!subs || subs.length === 0) {
      console.log('Nincs érvényes feliratkozó.');
      return NextResponse.json({ status: 'nincs feliratkozó' });
    }

    // 3. lépés: Események lekérése
    // JAVÍTÁS: Kivettük a .eq('priority', 'fontos') szűrést!
    // Helyette lekérünk mindent, ami ma vagy a jövőben van és még nem volt kiküldve minden emlékeztető
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false'); // Csak olyat, amiről még van mit mondani

    if (eventError) throw eventError;
    
    // Szűrés JS-ben: Csak a FONTOS vagy ÜGYELET (is_duty) érdekel minket
    const targetEvents = events?.filter(e => e.priority === 'fontos' || e.is_duty === true) || [];

    if (targetEvents.length === 0) {
      console.log('Nincs feldolgozandó esemény (szűrés után).');
      return NextResponse.json({ status: 'nincs esemény' });
    }

    let sentCount = 0;

    for (const event of targetEvents) {
      // Esemény időpont összeállítása
      // A DB-ben pl: "2026-01-26" és "17:00:00"
      const eventDateTimeStr = `${event.event_date}T${event.event_time}`;
      const eventDate = new Date(eventDateTimeStr); // Ez a Vercelen UTC-nek fog minősülni, ami nekünk MOST JÓ, mert a nowInBudapest-et is eltoltuk.

      // Különbség órákban
      const diffMs = eventDate.getTime() - nowInBudapest.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      console.log(`Vizsgálat: [${event.is_duty ? 'ÜGYELET' : event.priority}] ${event.title} | Idő: ${eventDateTimeStr} | Hátravan: ${diffHours.toFixed(2)} óra`);

      let type = "";
      let updateField = "";

      // Logika:
      // 1. NAPOS emlékeztető: 20 és 28 óra között (hogy kb előző nap délután/este menjen ki)
      if (diffHours >= 20 && diffHours <= 30 && !event.reminder_1d_sent) {
        type = "HOLNAP";
        updateField = "reminder_1d_sent";
      } 
      // 2. ÓRÁS emlékeztető: 0 és 1.5 óra között
      else if (diffHours > 0 && diffHours <= 1.5 && !event.reminder_1h_sent) {
        type = "HAMAROSAN";
        updateField = "reminder_1h_sent";
      }

      if (type && updateField) {
        console.log(`🚀 KÜLDÉS INDÍTÁSA -> ${event.title} (${type})`);
        
        // Címzett meghatározása az üzenethez
        const who = event.is_duty ? '🛡️ ÜGYELET' : (event.member_names?.join(', ') || 'Család');
        const titleText = event.is_duty ? `ÜGYELET: ${type}` : `EMLÉKEZTETŐ: ${type}`;
        
        // Küldés a saját API endpointnak (ami elvégzi a tényleges push-t a Google felé)
        // Fontos: Abszolút URL kell a fetch-hez szerver oldalon, vagy a Vercel URL
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000'; // Fallback devhez

        try {
          const pushRes = await fetch(`${baseUrl}/api/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptions: subs, // Mindenkinek elküldjük (később lehet szűrni user_id alapján)
              payload: {
                title: titleText,
                body: `${who}: ${event.title} ekkor: ${event.event_time.substring(0, 5)}`,
                url: '/19811221', // Ide irányít kattintáskor
                badge: '/icon-192x192.png'
              }
            })
          });

          if (pushRes.ok) {
            console.log(`✅ Sikeres küldés: ${event.title}`);
            // Adatbázis frissítése, hogy ne küldje újra
            await supabase.from('events').update({ [updateField]: true }).eq('id', event.id);
            sentCount++;
          } else {
            console.error(`❌ Hiba a push API hívásakor: ${pushRes.statusText}`);
          }
        } catch (e) {
          console.error(`❌ Fetch hiba:`, e);
        }
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err: any) {
    console.error('🔥 KRITIKUS HIBA:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
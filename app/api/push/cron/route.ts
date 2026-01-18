import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service Role kliens az RLS megkerüléséhez
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  console.log('--- 🤖 CRON ROBOT INDUL ---');
  
  // Magyar idő szerinti "most" kinyerése
  const now = new Date();
  const budapestNow = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(now);

  console.log('Szerver idő (UTC):', now.toISOString());
  console.log('Magyar idő (számított):', budapestNow);

  try {
    // 1. Feliratkozók lekérése
    const { data: subs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_json');
    
    if (subError) throw subError;
    if (!subs || subs.length === 0) {
      console.log('❌ Nincs feliratkozó az adatbázisban.');
      return NextResponse.json({ status: 'nincs feliratkozó' });
    }

    // 2. Fontos események lekérése, amiknél még hiányzik valamelyik értesítés
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('priority', 'fontos')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

    if (eventError) throw eventError;
    if (!events || events.length === 0) {
      console.log('✅ Nincs aktuális fontos esemény, amiről értesíteni kellene.');
      return NextResponse.json({ status: 'nincs aktuális fontos esemény' });
    }

    let sentCount = 0;

    for (const event of events) {
      // Dátum értelmezése: kényszerítjük a magyar időzónát az értelmezésnél
      const eventDateTimeStr = `${event.event_date}T${event.event_time}:00`;
      const eventTime = new Date(new Date(eventDateTimeStr).toLocaleString("en-US", {timeZone: "Europe/Budapest"}));
      
      // Kiszámoljuk a különbséget milliszekundumban, majd órában
      const diffMs = eventTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      console.log(`Vizsgálat: ${event.title} | Időpont: ${eventDateTimeStr} | Diff: ${diffHours.toFixed(2)} óra`);

      let type = "";
      let updateField = "";

      // 1. Emlékeztető: 24 órával előtte (20-26 óra közötti ablak, hogy biztos beleessen a cron)
      if (diffHours > 0 && diffHours <= 26 && !event.reminder_1d_sent && diffHours > 10) {
        type = "HOLNAP";
        updateField = "reminder_1d_sent";
      } 
      // 2. Emlékeztető: 1 órával előtte (0 és 2 óra közötti ablak)
      else if (diffHours > 0 && diffHours <= 2 && !event.reminder_1h_sent) {
        type = "HAMAROSAN (1 óra)";
        updateField = "reminder_1h_sent";
      }

      if (type && updateField) {
        console.log(`🚀 KÜLDÉS -> ${event.title} (${type})`);
        
        const baseUrl = `https://stuller.vercel.app`; // Fix domain a biztonság kedvéért
        
        try {
          const pushRes = await fetch(`${baseUrl}/api/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptions: subs,
              payload: {
                title: `⏰ EMLÉKEZTETŐ: ${type}`,
                body: `${event.member_names?.join(', ') || 'Család'}: ${event.title} - ${event.event_time}`,
                url: '/19811221'
              }
            })
          });

          if (pushRes.ok) {
            // Csak akkor jelöljük késznek, ha a push kiment
            await supabase.from('events').update({ [updateField]: true }).eq('id', event.id);
            sentCount++;
          } else {
            const errText = await pushRes.text();
            console.error(`Push hiba (${event.title}):`, errText);
          }
        } catch (e) {
          console.error(`Fetch hiba a push küldésekor (${event.title}):`, e);
        }
      }
    }

    console.log(`--- CRON KÉSZ. Kiküldve: ${sentCount} db ---`);
    return NextResponse.json({ success: true, processed: events.length, sent: sentCount });
  } catch (err: any) {
    console.error('Kritikus Cron hiba:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
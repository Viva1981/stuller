import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  console.log('--- 🤖 CRON ROBOT INDUL ---');
  
  const now = new Date();
  // Magyar idő kiírása a logba ellenőrzéshez
  const budapestNowStr = now.toLocaleString("hu-HU", {timeZone: "Europe/Budapest"});
  console.log('Szerver idő (UTC):', now.toISOString());
  console.log('Magyar idő (most):', budapestNowStr);

  try {
    const { data: subs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_json');
    
    if (subError) throw subError;
    if (!subs || subs.length === 0) return NextResponse.json({ status: 'nincs feliratkozó' });

    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('priority', 'fontos')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

    if (eventError) throw eventError;
    if (!events || events.length === 0) return NextResponse.json({ status: 'nincs esemény' });

    let sentCount = 0;

    for (const event of events) {
      // JAVÍTÁS: Nem adunk hozzá fixen :00-át, mert a DB-ből már :00-val jön (HH:mm:ss)
      const eventDateTimeStr = `${event.event_date}T${event.event_time}`;
      
      // Magyar időzóna szerinti dátum objektum létrehozása
      const eventTime = new Date(new Date(eventDateTimeStr).toLocaleString("en-US", {timeZone: "Europe/Budapest"}));
      
      const diffMs = eventTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      console.log(`Vizsgálat: ${event.title} | Időpont: ${eventDateTimeStr} | Diff: ${diffHours.toFixed(2)} óra`);

      let type = "";
      let updateField = "";

      // 1. Emlékeztető: HOLNAP (Ha 10 és 26 óra között vagyunk)
      if (diffHours > 10 && diffHours <= 26 && !event.reminder_1d_sent) {
        type = "HOLNAP";
        updateField = "reminder_1d_sent";
      } 
      // 2. Emlékeztető: HAMAROSAN (Ha már csak 0-2 óra van hátra)
      else if (diffHours > 0 && diffHours <= 2 && !event.reminder_1h_sent) {
        type = "HAMAROSAN (1 óra)";
        updateField = "reminder_1h_sent";
      }

      if (type && updateField) {
        console.log(`🚀 KÜLDÉS -> ${event.title} (${type})`);
        
        const baseUrl = `https://stuller.vercel.app`;
        
        try {
          const pushRes = await fetch(`${baseUrl}/api/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptions: subs,
              payload: {
                title: `⏰ EMLÉKEZTETŐ: ${type}`,
                body: `${event.member_names?.join(', ') || 'Család'}: ${event.title} - ${event.event_time.substring(0, 5)}`,
                url: '/19811221'
              }
            })
          });

          if (pushRes.ok) {
            await supabase.from('events').update({ [updateField]: true }).eq('id', event.id);
            sentCount++;
          }
        } catch (e) {
          console.error(`Fetch hiba:`, e);
        }
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err: any) {
    console.error('Hiba:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
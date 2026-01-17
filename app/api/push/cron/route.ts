import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Kliens létrehozása (mivel ez szerveroldali, itt közvetlenül a környezeti változókat használjuk)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  console.log('--- CRON ROBOT INDUL ---');
  const now = new Date();
  
  try {
    // 1. Összes feliratkozó lekérése
    const { data: subs } = await supabase.from('push_subscriptions').select('subscription_json');
    if (!subs || subs.length === 0) return NextResponse.json({ status: 'nincs feliratkozó' });

    // 2. Fontos események lekérése, amiknél még kell emlékeztető
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('priority', 'fontos')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

    if (!events || events.length === 0) return NextResponse.json({ status: 'nincs aktuális fontos esemény' });

    for (const event of events) {
      const eventTime = new Date(`${event.event_date}T${event.event_time}`);
      const diffMs = eventTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let type = "";
      let updateField = "";

      // 24 órás ablak (23-25 óra között)
      if (diffHours > 23 && diffHours < 25 && !event.reminder_1d_sent) {
        type = "HOLNAP";
        updateField = "reminder_1d_sent";
      } 
      // 1 órás ablak (0.5-1.5 óra között)
      else if (diffHours > 0.5 && diffHours < 1.5 && !event.reminder_1h_sent) {
        type = "HAMAROSAN (1 óra)";
        updateField = "reminder_1h_sent";
      }

      if (type && updateField) {
        console.log(`Emlékeztető küldése: ${event.title} (${type})`);
        
        // Meghívjuk a már működő push API-t
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.vercel.app')}/api/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptions: subs,
            payload: {
              title: `⏰ EMLÉKEZTETŐ: ${type}`,
              body: `${event.member_names?.join(', ')}: ${event.title} - ${event.event_time}`,
              url: '/19811221'
            }
          })
        });

        // Adatbázis frissítése, hogy ne küldjük el többször
        await supabase.from('events').update({ [updateField]: true }).eq('id', event.id);
      }
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString() });
  } catch (err) {
    console.error('Cron hiba:', err);
    return NextResponse.json({ error: 'Szerver hiba a cron futásakor' }, { status: 500 });
  }
}
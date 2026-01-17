import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const now = new Date();
  
  // 1. Lekérjük az összes feliratkozót
  const { data: subs } = await supabase.from('push_subscriptions').select('subscription_json');
  if (!subs || subs.length === 0) return NextResponse.json({ status: 'nincs feliratkozó' });

  // 2. Lekérjük a fontos eseményeket, amiknél még nem ment ki valamelyik emlékeztető
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('priority', 'fontos')
    .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

  if (!events) return NextResponse.json({ status: 'nincs esemény' });

  for (const event of events) {
    const eventTime = new Date(`${event.event_date}T${event.event_time}`);
    const diffMs = eventTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let type = "";
    let updateField = "";

    // 24 órás emlékeztető (23 és 25 óra között nézzük, hogy biztos beleessünk)
    if (diffHours > 23 && diffHours < 25 && !event.reminder_1d_sent) {
      type = "HOLNAP";
      updateField = "reminder_1d_sent";
    } 
    // 1 órás emlékeztető (0.5 és 1.5 óra között)
    else if (diffHours > 0.5 && diffHours < 1.5 && !event.reminder_1h_sent) {
      type = "HAMAROSAN (1 óra)";
      updateField = "reminder_1h_sent";
    }

    if (type) {
      const payload = {
        title: `⏰ EMLÉKEZTETŐ: ${type}`,
        body: `${event.member_names?.join(', ')}: ${event.title} - ${event.event_time}`,
        url: '/19811221'
      };

      // Küldés az API-n keresztül
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.vercel.app')}/api/push`, {
        method: 'POST',
        body: JSON.stringify({ subscriptions: subs, payload })
      }).catch(() => {});

      // Megjelöljük elküldöttnek
      await supabase.from('events').update({ [updateField]: true }).eq('id', event.id);
    }
  }

  return NextResponse.json({ success: true });
}
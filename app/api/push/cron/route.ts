import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push'; // KÖZVETLEN IMPORT

// Beállítjuk a web-push adatokat itt helyben
webPush.setVapidDetails(
  'mailto:stuller.zsolt@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const isValidSubscription = (sub: any) => {
  return sub && sub.endpoint && sub.keys && sub.keys.auth && sub.keys.p256dh;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  console.log('--- 🤖 CRON ROBOT INDUL (DIRECT MODE) ---');
  
  const nowUTC = new Date();
  const timeZone = "Europe/Budapest";
  const nowInBudapest = new Date(nowUTC.toLocaleString("en-US", { timeZone }));

  console.log(`Idő: ${nowInBudapest.toLocaleString('hu-HU')}`);

  try {
    // --- 1. Feliratkozók ---
    const { data: rawSubs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_json');
    
    if (subError) throw subError;

    const subs = rawSubs
      ?.map(s => (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json))
      .filter(isValidSubscription);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ status: 'nincs feliratkozó' });
    }

    // --- 2. Események ---
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

    if (eventError) throw eventError;
    
    const targetEvents = events?.filter(e => e.priority === 'fontos' || e.is_duty === true) || [];

    if (targetEvents.length === 0) {
      return NextResponse.json({ status: 'nincs esemény' });
    }

    let sentCount = 0;

    for (const event of targetEvents) {
      const eventDateTimeStr = `${event.event_date}T${event.event_time}`;
      const eventDate = new Date(eventDateTimeStr);
      const diffMs = eventDate.getTime() - nowInBudapest.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      console.log(`Vizsgálat: ${event.title} | Hátravan: ${diffHours.toFixed(2)} óra`);

      let type = "";
      let updateField = "";

      // HOLNAP
      if (diffHours >= 20 && diffHours <= 30 && !event.reminder_1d_sent) {
        type = "HOLNAP";
        updateField = "reminder_1d_sent";
      } 
      // HAMAROSAN
      else if (diffHours > 0 && diffHours <= 1.5 && !event.reminder_1h_sent) {
        type = "HAMAROSAN";
        updateField = "reminder_1h_sent";
      }

      if (type && updateField) {
        console.log(`🚀 KÜLDÉS: ${event.title} (${type})`);
        
        const who = event.is_duty ? '🛡️ ÜGYELET' : (event.member_names?.join(', ') || 'Család');
        const titleText = event.is_duty ? `ÜGYELET: ${type}` : `EMLÉKEZTETŐ: ${type}`;
        
        const payload = JSON.stringify({
          title: titleText,
          body: `${who}: ${event.title} - ${event.event_time.substring(0, 5)}`,
          url: '/19811221',
          icon: '/icon-192x192.png' // Opcionális
        });

        // --- ITT A VÁLTOZÁS: Közvetlenül küldjük a web-push-sal ---
        // Minden feliratkozónak elküldjük párhuzamosan
        const sendPromises = subs.map(sub => 
          webPush.sendNotification(sub, payload)
            .then(() => ({ success: true }))
            .catch(err => {
              console.error('WebPush hiba egy feliratkozónál:', err.statusCode);
              // Ha 410 (Gone), akkor törölni kéne, de most ne bonyolítsuk
              return { success: false };
            })
        );

        await Promise.all(sendPromises);

        // Adatbázis frissítése
        await supabase.from('events').update({ [updateField]: true }).eq('id', event.id);
        sentCount++;
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err: any) {
    console.error('🔥 KRITIKUS HIBA:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
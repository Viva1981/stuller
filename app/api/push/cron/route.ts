import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

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
  console.log('--- 🤖 CRON ROBOT INDUL (CLEANER MODE) ---');
  
  const nowUTC = new Date();
  const timeZone = "Europe/Budapest";
  const nowInBudapest = new Date(nowUTC.toLocaleString("en-US", { timeZone }));

  try {
    // 1. Feliratkozók lekérése (ID-val együtt, hogy tudjunk törölni)
    const { data: rawSubs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json'); // ID is kell!
    
    if (subError) throw subError;
    if (!rawSubs || rawSubs.length === 0) return NextResponse.json({ status: 'nincs feliratkozó' });

    // 2. Események lekérése
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

    if (eventError) throw eventError;

    const targetEvents = events?.filter(e => e.priority === 'fontos' || e.is_duty === true) || [];
    let sentCount = 0;

    for (const event of targetEvents) {
      const eventDateTimeStr = `${event.event_date}T${event.event_time}`;
      const eventDate = new Date(eventDateTimeStr);
      const diffMs = eventDate.getTime() - nowInBudapest.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Logika: 
      // 20-30 óra: HOLNAP (24h)
      // 0-1.5 óra: HAMAROSAN (1h)
      let type = "";
      let updateField = "";

      if (diffHours >= 20 && diffHours <= 30 && !event.reminder_1d_sent) {
        type = "HOLNAP";
        updateField = "reminder_1d_sent";
      } else if (diffHours > 0 && diffHours <= 1.5 && !event.reminder_1h_sent) {
        type = "HAMAROSAN";
        updateField = "reminder_1h_sent";
      }

      if (type && updateField) {
        console.log(`🚀 CRON KÜLDÉS: ${event.title} (${type})`);
        
        const who = event.is_duty ? '🛡️ ÜGYELET' : (event.member_names?.join(', ') || 'Család');
        const titleText = event.is_duty ? `ÜGYELET: ${type}` : `EMLÉKEZTETŐ: ${type}`;
        
        const payload = JSON.stringify({
          title: titleText,
          body: `${who}: ${event.title} - ${event.event_time.substring(0, 5)}`,
          url: '/19811221',
          icon: '/icon-192x192.png'
        });

        // Párhuzamos küldés és hibakezelés (törlés ha 410)
        const sendPromises = rawSubs.map(async (record) => {
          let subPayload = record.subscription_json;
          if (typeof subPayload === 'string') subPayload = JSON.parse(subPayload);
          
          if (!isValidSubscription(subPayload)) return;

          try {
            await webPush.sendNotification(subPayload, payload);
          } catch (err: any) {
            // HA A FELIRATKOZÁS HALOTT (410 vagy 404), TÖRÖLJÜK A DB-BŐL
            if (err.statusCode === 410 || err.statusCode === 404) {
              console.log(`🗑️ Halott feliratkozás törlése (ID: ${record.id})`);
              await supabase.from('push_subscriptions').delete().eq('id', record.id);
            } else {
              console.error('Push hiba:', err.statusCode);
            }
          }
        });

        await Promise.all(sendPromises);
        
        // Esemény frissítése, hogy ne küldje újra
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
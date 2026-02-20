import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';

type SubscriptionRecord = {
  id: string;
  subscription_json: webPush.PushSubscription | string;
};

type EventRecord = {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  member_names?: string[];
  priority?: string;
  is_duty?: boolean;
  reminder_1d_sent?: boolean;
  reminder_1h_sent?: boolean;
};

function ensureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webPush.setVapidDetails('mailto:stuller.zsolt@gmail.com', publicKey, privateKey);
  return true;
}

function isValidSubscription(sub: unknown): sub is webPush.PushSubscription {
  if (!sub || typeof sub !== 'object') return false;
  const candidate = sub as {
    endpoint?: string;
    keys?: { auth?: string; p256dh?: string };
  };
  return !!(candidate.endpoint && candidate.keys?.auth && candidate.keys?.p256dh);
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  console.log('--- CRON ROBOT INDUL (CLEANER MODE) ---');

  if (!ensureVapid()) {
    return NextResponse.json({ error: 'VAPID kulcs nincs beallitva' }, { status: 500 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase env nincs beallitva' }, { status: 500 });
  }

  const nowUTC = new Date();
  const timeZone = 'Europe/Budapest';
  const nowInBudapest = new Date(nowUTC.toLocaleString('en-US', { timeZone }));

  try {
    const { data: rawSubs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_json');

    if (subError) throw subError;
    if (!rawSubs || rawSubs.length === 0) return NextResponse.json({ status: 'nincs feliratkozo' });

    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

    if (eventError) throw eventError;

    const targetEvents = ((events as EventRecord[] | null) ?? []).filter(
      (e) => e.priority === 'fontos' || e.is_duty === true
    );
    let sentCount = 0;

    for (const event of targetEvents) {
      const eventDateTimeStr = `${event.event_date}T${event.event_time}`;
      const eventDate = new Date(eventDateTimeStr);
      const diffMs = eventDate.getTime() - nowInBudapest.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let type = '';
      let updateField = '';

      if (diffHours >= 20 && diffHours <= 30 && !event.reminder_1d_sent) {
        type = 'HOLNAP';
        updateField = 'reminder_1d_sent';
      } else if (diffHours > 0 && diffHours <= 1.5 && !event.reminder_1h_sent) {
        type = 'HAMAROSAN';
        updateField = 'reminder_1h_sent';
      }

      if (type && updateField) {
        console.log(`CRON KULDES: ${event.title} (${type})`);

        const who = event.is_duty ? 'UGYELET' : event.member_names?.join(', ') || 'Csalad';
        const titleText = event.is_duty ? `UGYELET: ${type}` : `EMLEKEZTETO: ${type}`;

        const payload = JSON.stringify({
          title: titleText,
          body: `${who}: ${event.title} - ${event.event_time.substring(0, 5)}`,
          url: '/19811221',
          icon: '/icon-192x192.png'
        });

        const sendPromises = (rawSubs as SubscriptionRecord[]).map(async (record) => {
          let subPayload: unknown = null;
          if (typeof record.subscription_json === 'string') {
            subPayload = JSON.parse(record.subscription_json) as unknown;
          } else {
            subPayload = record.subscription_json;
          }

          if (!isValidSubscription(subPayload)) return;

          try {
            await webPush.sendNotification(subPayload, payload);
          } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number }).statusCode;
            if (statusCode === 410 || statusCode === 404) {
              console.log(`Halott feliratkozas torlese (ID: ${record.id})`);
              await supabase.from('push_subscriptions').delete().eq('id', record.id);
            } else {
              console.error('Push hiba:', statusCode);
            }
          }
        });

        await Promise.all(sendPromises);

        await supabase.from('events').update({ [updateField]: true }).eq('id', event.id);
        sentCount++;
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    console.error('KRITIKUS HIBA:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

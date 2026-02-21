import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';

type SubscriptionRecord = {
  id: string;
  user_id: string | null;
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

const MEMBER_USER_IDS: Record<string, string> = {
  andrea: 'fd66cfc9-81e9-43fb-9998-14e3f5552c7d',
  zsolt: '002ebc2c-1e6a-42d2-8d93-ecaab7678a64',
  adel: '6a2a9b24-09d2-4d03-a2f3-15cfec060d09',
  zsombor: '3f0d1cbf-c353-4df3-bec2-b9130c2112b0'
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

function canonicalizeMemberName(value: string): string {
  return value
    .toLowerCase()
    .replace(/Ă©|Ã©|é/g, 'e')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function toCivilMsFromDateTime(dateStr: string, timeStr: string): number | null {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute, second] = timeStr.split(':').map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return Date.UTC(year, month - 1, day, hour, minute, second || 0);
}

function getNowCivilMsInBudapest(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
}

function resolveTargetUserIds(event: EventRecord): string[] {
  const names = event.member_names || [];
  const ids = names
    .map((name) => MEMBER_USER_IDS[canonicalizeMemberName(name)])
    .filter((id): id is string => Boolean(id));

  return [...new Set(ids)];
}

export async function GET() {
  console.log('--- CRON ROBOT INDUL (TARGETED MODE) ---');

  if (!ensureVapid()) {
    return NextResponse.json({ error: 'VAPID kulcs nincs beállítva' }, { status: 500 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase env nincs beállítva' }, { status: 500 });
  }

  try {
    const { data: rawSubs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, subscription_json');

    if (subError) throw subError;
    if (!rawSubs || rawSubs.length === 0) return NextResponse.json({ status: 'nincs feliratkozó' });

    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .or('reminder_1d_sent.eq.false,reminder_1h_sent.eq.false');

    if (eventError) throw eventError;

    const targetEvents = ((events as EventRecord[] | null) ?? []).filter((e) => e.priority === 'fontos');

    const nowCivilMs = getNowCivilMsInBudapest();
    let sentCount = 0;

    for (const event of targetEvents) {
      const eventCivilMs = toCivilMsFromDateTime(event.event_date, event.event_time);
      if (!eventCivilMs) continue;

      const diffHours = (eventCivilMs - nowCivilMs) / (1000 * 60 * 60);

      let type = '';
      let updateField: 'reminder_1d_sent' | 'reminder_1h_sent' | '' = '';

      if (diffHours >= 23 && diffHours <= 25 && !event.reminder_1d_sent) {
        type = 'HOLNAP';
        updateField = 'reminder_1d_sent';
      } else if (diffHours > 0 && diffHours <= 1.25 && !event.reminder_1h_sent) {
        type = 'HAMAROSAN';
        updateField = 'reminder_1h_sent';
      }

      if (!type || !updateField) continue;

      const targetUserIds = resolveTargetUserIds(event);
      if (targetUserIds.length === 0) {
        console.warn(`Nincs cél user az eseményhez: ${event.id}`);
        continue;
      }

      const targetSubs = (rawSubs as SubscriptionRecord[]).filter(
        (record) => !!record.user_id && targetUserIds.includes(record.user_id)
      );

      if (targetSubs.length === 0) {
        console.warn(`Nincs aktív cél feliratkozás az eseményhez: ${event.id}`);
        continue;
      }

      console.log(`CRON KÜLDÉS: ${event.title} (${type}) -> ${targetSubs.length} eszköz`);

      const who = event.member_names?.join(', ') || 'Család';
      const titleText = `EMLÉKEZTETŐ: ${type}`;

      const payload = JSON.stringify({
        title: titleText,
        body: `${who}: ${event.title} - ${event.event_time.substring(0, 5)}`,
        url: '/19811221',
        icon: '/icon-192x192.png'
      });

      const sendPromises = targetSubs.map(async (record) => {
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

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
    console.error('KRITIKUS HIBA:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

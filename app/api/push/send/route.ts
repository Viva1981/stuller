import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';

type SendBody = {
  title?: string;
  message?: string;
  url?: string;
  userIds?: string[];
};

type SubscriptionPayload = {
  endpoint?: string;
};

type SubscriptionRecord = {
  id: string;
  user_id: string;
  subscription_json: SubscriptionPayload | string;
};

function ensureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webPush.setVapidDetails('mailto:stuller.zsolt@gmail.com', publicKey, privateKey);
  return true;
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    if (!ensureVapid()) {
      return NextResponse.json({ error: 'VAPID kulcs nincs beallitva' }, { status: 500 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase env nincs beallitva' }, { status: 500 });
    }

    const body = (await request.json()) as SendBody;
    const { title, message, url, userIds } = body;

    let query = supabase.from('push_subscriptions').select('id, user_id, subscription_json');

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data: rawSubs, error } = await query;

    if (error) throw error;
    if (!rawSubs || rawSubs.length === 0) {
      console.log('Nincs kinek kuldeni (ures lista vagy szures eredmenye).');
      return NextResponse.json({ sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/',
      icon: '/icon-192x192.png'
    });

    console.log(`Kuldes ${rawSubs.length} eszkozre...`);

    const promises = (rawSubs as SubscriptionRecord[]).map(async (record) => {
      let sub: SubscriptionPayload | null = null;
      if (typeof record.subscription_json === 'string') {
        sub = JSON.parse(record.subscription_json) as SubscriptionPayload;
      } else {
        sub = record.subscription_json;
      }

      if (!sub?.endpoint) return;

      try {
        await webPush.sendNotification(sub as webPush.PushSubscription, payload);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          console.log(`Halott feliratkozas torlese azonnali kuldesnel (ID: ${record.id})`);
          await supabase.from('push_subscriptions').delete().eq('id', record.id);
        } else {
          console.error(`Push hiba (ID: ${record.id}):`, statusCode);
        }
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true, count: rawSubs.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba';
    console.error('API Send Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

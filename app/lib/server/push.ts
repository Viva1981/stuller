import webPush from 'web-push';

import { FAMILY_MEMBERS } from '@/app/lib/family';
import { getSupabaseAdminClient } from '@/app/lib/server/supabase-admin';

type PushSubscriptionRecord = {
  id: string;
  user_id: string | null;
  subscription_json: webPush.PushSubscription | string;
};

type PushPayload = {
  title: string;
  message: string;
  url?: string;
  userIds?: string[];
};

function ensureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error('A VAPID kulcsok nincsenek beállítva.');
  }

  webPush.setVapidDetails('mailto:stuller.zsolt@gmail.com', publicKey, privateKey);
}

function parseSubscription(value: webPush.PushSubscription | string): webPush.PushSubscription | null {
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as webPush.PushSubscription;
    return parsed.endpoint ? parsed : null;
  }

  return value?.endpoint ? value : null;
}

export async function sendPushNotification(payload: PushPayload) {
  ensureVapid();

  const supabase = getSupabaseAdminClient();
  let query = supabase.from('push_subscriptions').select('id, user_id, subscription_json');

  if (payload.userIds && payload.userIds.length > 0) {
    query = query.in('user_id', payload.userIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const subscriptions = (data ?? []) as PushSubscriptionRecord[];
  if (subscriptions.length === 0) {
    return { sent: 0 };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.message,
    url: payload.url || '/19811221',
    icon: '/icon-192x192.png',
  });

  let sent = 0;
  for (const record of subscriptions) {
    const subscription = parseSubscription(record.subscription_json);
    if (!subscription) {
      continue;
    }

    try {
      await webPush.sendNotification(subscription, body);
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', record.id);
      } else {
        console.error('Push küldési hiba:', statusCode, error);
      }
    }
  }

  return { sent };
}

export function getAllFamilyUserIds() {
  return FAMILY_MEMBERS.map((member) => member.userId);
}

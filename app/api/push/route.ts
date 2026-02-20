import { NextResponse } from 'next/server';
import webpush from 'web-push';

type PushBody = {
  subscriptions?: Array<{ subscription_json: webpush.PushSubscription }>;
  payload?: unknown;
};

function ensureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails('mailto:stuller.zsolt@gmail.com', publicKey, privateKey);
  return true;
}

export async function POST(request: Request) {
  try {
    if (!ensureVapid()) {
      return NextResponse.json({ error: 'VAPID kulcs nincs beallítva' }, { status: 500 });
    }

    const { subscriptions, payload } = (await request.json()) as PushBody;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'Nincs feliratkozo' });
    }

    const notifications = subscriptions.map((sub) =>
      webpush
        .sendNotification(sub.subscription_json, JSON.stringify(payload))
        .catch((err: unknown) => console.error('Kuldesi hiba:', err))
    );

    await Promise.all(notifications);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push hiba:', error);
    return NextResponse.json({ error: 'Hiba' }, { status: 500 });
  }
}

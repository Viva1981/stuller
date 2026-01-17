import { NextResponse } from 'next/server';
// @ts-ignore: Megkerüljük a típusellenőrzést a build idejére
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:stuller.zsolt@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    const { subscriptions, payload } = await request.json();

    if (!subscriptions || !Array.isArray(subscriptions)) {
      return NextResponse.json({ error: 'Nincsenek feliratkozók' }, { status: 400 });
    }

    const notifications = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub.subscription_json, JSON.stringify(payload))
        .catch((err: any) => console.error('Küldési hiba egy eszközre:', err))
    );

    await Promise.all(notifications);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push hiba:', error);
    return NextResponse.json({ error: 'Szerver hiba a küldéskor' }, { status: 500 });
  }
}
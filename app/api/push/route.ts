import { NextResponse } from 'next/server';
// @ts-ignore
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:stuller.zsolt@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    const { subscriptions, payload } = await request.json();

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'Nincs feliratkozó' });
    }

    const notifications = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub.subscription_json, JSON.stringify(payload))
        .catch((err: any) => console.error('Küldési hiba:', err))
    );

    await Promise.all(notifications);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push hiba:', error);
    return NextResponse.json({ error: 'Hiba' }, { status: 500 });
  }
}
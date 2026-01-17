import { NextResponse } from 'next/server';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:stuller.zsolt@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    const { subscriptions, payload } = await request.json();

    const notifications = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub.subscription_json, JSON.stringify(payload))
        .catch(err => console.error('Hiba egy küldésnél:', err))
    );

    await Promise.all(notifications);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push hiba:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
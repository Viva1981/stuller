import { NextResponse } from 'next/server';
// @ts-ignore
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:stuller.zsolt@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  console.log('--- PUSH API HÍVÁS ÉRKEZETT ---');
  
  try {
    const { subscriptions, payload } = await request.json();

    console.log(`Feliratkozók száma: ${subscriptions?.length}`);

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      console.error('Nincsenek érvényes feliratkozók a kérésben.');
      return NextResponse.json({ error: 'Nincsenek feliratkozók' }, { status: 400 });
    }

    const notifications = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub.subscription_json, JSON.stringify(payload))
        .then(() => console.log('Értesítés sikeresen elküldve egy eszközre.'))
        .catch((err: any) => console.error('Küldési hiba egy eszközre:', err))
    );

    await Promise.all(notifications);
    console.log('--- PUSH API FOLYAMAT VÉGE ---');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Kritikus Push hiba az API-ban:', error);
    return NextResponse.json({ error: 'Szerver hiba a küldéskor' }, { status: 500 });
  }
}
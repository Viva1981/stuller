// app/api/push/send/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

// Web-push beállítása
webPush.setVapidDetails(
  'mailto:stuller.zsolt@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, message, url } = body;

    // 1. Feliratkozók lekérése
    const { data: rawSubs, error } = await supabase
      .from('push_subscriptions')
      .select('subscription_json');

    if (error) throw error;
    if (!rawSubs || rawSubs.length === 0) return NextResponse.json({ sent: 0 });

    // Validálás
    const subs = rawSubs
      .map(s => (typeof s.subscription_json === 'string' ? JSON.parse(s.subscription_json) : s.subscription_json))
      .filter(s => s && s.endpoint);

    const payload = JSON.stringify({
      title: title,
      body: message,
      url: url || '/',
      icon: '/icon-192x192.png'
    });

    // 2. Küldés mindenkinek
    const promises = subs.map(sub => 
      webPush.sendNotification(sub, payload)
        .then(() => ({ success: true }))
        .catch(err => {
          // Ha 410 (Gone), az azt jelenti, hogy a feliratkozás már nem él (pl. kijelentkezett)
          if (err.statusCode === 410) {
             console.log('Halott feliratkozás, törlésre jelölve...');
             // Itt opcionálisan törölhetnénk a DB-ből az endpoint alapján
          }
          return { success: false };
        })
    );

    await Promise.all(promises);

    return NextResponse.json({ success: true, count: subs.length });
  } catch (error: any) {
    console.error('API Send Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
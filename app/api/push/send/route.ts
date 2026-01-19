import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

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
    const { title, message, url, userIds } = body; // Itt fogadjuk a userIds listát

    // 1. Feliratkozók lekérése
    let query = supabase
      .from('push_subscriptions')
      .select('id, user_id, subscription_json'); // ID kell a törléshez, user_id a szűréshez

    // Ha kaptunk userIds listát, és nem üres, akkor szűrünk rá
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data: rawSubs, error } = await query;

    if (error) throw error;
    if (!rawSubs || rawSubs.length === 0) {
        console.log('Nincs kinek küldeni (üres lista vagy szűrés eredménye).');
        return NextResponse.json({ sent: 0 });
    }

    const payload = JSON.stringify({
      title: title,
      body: message,
      url: url || '/',
      icon: '/icon-192x192.png'
    });

    console.log(`Küldés ${rawSubs.length} eszközre...`);

    // 2. Küldés és takarítás
    const promises = rawSubs.map(async (record) => {
        let sub = record.subscription_json;
        if (typeof sub === 'string') sub = JSON.parse(sub);
        
        // Ellenőrzés
        if (!sub || !sub.endpoint) return;

        try {
            await webPush.sendNotification(sub, payload);
        } catch (err: any) {
            // HA 410 (Gone) vagy 404 (Not Found), akkor töröljük a DB-ből
            if (err.statusCode === 410 || err.statusCode === 404) {
                console.log(`🗑️ Halott feliratkozás törlése azonnali küldésnél (ID: ${record.id})`);
                await supabase.from('push_subscriptions').delete().eq('id', record.id);
            } else {
                console.error(`Push hiba (ID: ${record.id}):`, err.statusCode);
            }
        }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true, count: rawSubs.length });
  } catch (error: any) {
    console.error('API Send Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
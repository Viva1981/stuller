import { NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/app/lib/server/supabase-admin';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const expectedToken = process.env.HOUSE_SENSOR_TOKEN;
  if (!expectedToken) {
    throw new Error('A HOUSE_SENSOR_TOKEN környezeti változó nincs beállítva.');
  }

  const authHeader = request.headers.get('authorization');
  const sensorHeader = request.headers.get('x-sensor-token');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || sensorHeader || '';
  return token === expectedToken;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Érvénytelen szenzor token.' }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('house_devices')
      .select(
        'id, name, slug, owner_name, device_kind, ip_address, mac_address, vendor_name, monitor_method, presence_role, state_role, is_enabled, metadata'
      )
      .eq('is_enabled', true)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      sensorLabel: 'redmi-note-9-pro',
      recommendedIntervalSeconds: 120,
      supportedMonitorMethods: ['ping'],
      supportedObservationTypes: ['reachability'],
      devices: data ?? [],
    });
  } catch (error) {
    console.error('House config hiba:', error);
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

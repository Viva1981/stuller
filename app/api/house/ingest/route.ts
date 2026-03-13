import { NextResponse } from 'next/server';

import { getUserIdsForOwner } from '@/app/lib/family';
import { HouseDeviceRecord, HouseEventRecord, HousePowerState, HousePresenceRecord, HouseReachabilityState } from '@/app/lib/house';
import { sendPushNotification } from '@/app/lib/server/push';
import { getSupabaseAdminClient } from '@/app/lib/server/supabase-admin';

export const runtime = 'nodejs';

type ObservationInput = {
  slug: string;
  observedAt?: string;
  reachabilityState?: HouseReachabilityState;
  powerState?: HousePowerState;
  latencyMs?: number | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  vendorName?: string | null;
  confidence?: number;
  rawValue?: Record<string, unknown>;
};

type IngestBody = {
  sensorLabel?: string;
  observations?: ObservationInput[];
};

const ARRIVAL_THRESHOLD = 2;
const DEPARTURE_THRESHOLD = 3;

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

function clampConfidence(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function getObservedAt(input?: string) {
  const parsed = input ? new Date(input) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function buildObservationRows(device: HouseDeviceRecord, payload: ObservationInput, sensorLabel: string) {
  const rows: Array<Record<string, unknown>> = [];
  const observedAt = getObservedAt(payload.observedAt);
  const confidence = clampConfidence(payload.confidence);

  if (payload.reachabilityState) {
    rows.push({
      device_id: device.id,
      sensor_label: sensorLabel,
      observed_at: observedAt,
      observation_type: device.presence_role ? 'presence' : 'reachability',
      observed_status: payload.reachabilityState,
      latency_ms: payload.latencyMs ?? null,
      ip_address: payload.ipAddress ?? device.ip_address,
      mac_address: payload.macAddress ?? device.mac_address,
      raw_value: payload.rawValue ?? {},
      confidence,
    });
  }

  if (payload.powerState) {
    rows.push({
      device_id: device.id,
      sensor_label: sensorLabel,
      observed_at: observedAt,
      observation_type: 'power_state',
      observed_status: payload.powerState,
      latency_ms: null,
      ip_address: payload.ipAddress ?? device.ip_address,
      mac_address: payload.macAddress ?? device.mac_address,
      raw_value: payload.rawValue ?? {},
      confidence,
    });
  }

  return rows;
}

function buildReachabilityEvent(device: HouseDeviceRecord, nextState: HouseReachabilityState, observedAt: string) {
  if (nextState === 'unknown' || device.reachability_state === nextState) {
    return null;
  }

  if (nextState === 'online') {
    return {
      event_type: 'device_online',
      title: `${device.name} elérhető lett`,
      description: `${device.name} ismét válaszol a hálózaton.`,
      subject_name: device.owner_name ?? device.name,
      device_id: device.id,
      severity: 'info',
      should_notify: false,
      metadata: {
        slug: device.slug,
        observedAt,
        reachabilityState: nextState,
      },
    };
  }

  return {
    event_type: 'device_offline',
    title: `${device.name} offline lett`,
    description: `${device.name} jelenleg nem elérhető.`,
    subject_name: device.owner_name ?? device.name,
    device_id: device.id,
    severity: 'info',
    should_notify: false,
    metadata: {
      slug: device.slug,
      observedAt,
      reachabilityState: nextState,
    },
  };
}

function buildPowerEvent(device: HouseDeviceRecord, nextState: HousePowerState, observedAt: string) {
  if (nextState === 'unknown' || device.power_state === nextState || device.device_kind !== 'light') {
    return null;
  }

  const turnedOn = nextState === 'on';
  return {
    event_type: turnedOn ? 'light_on' : 'light_off',
    title: `${device.name} ${turnedOn ? 'felkapcsolva' : 'lekapcsolva'}`,
    description: `${device.name} állapota ${turnedOn ? 'bekapcsolva' : 'kikapcsolva'}.`,
    subject_name: device.owner_name ?? device.name,
    device_id: device.id,
    severity: 'info',
    should_notify: true,
    metadata: {
      slug: device.slug,
      observedAt,
      powerState: nextState,
    },
  };
}

function buildPresenceTransition(
  device: HouseDeviceRecord,
  currentPresence: HousePresenceRecord | null,
  nextReachability: HouseReachabilityState,
  observedAt: string,
  confidence: number,
) {
  if (!device.presence_role || nextReachability === 'unknown') {
    return null;
  }

  const previousState = currentPresence?.current_state ?? 'unknown';
  const previousOnline = currentPresence?.streak_online ?? 0;
  const previousOffline = currentPresence?.streak_offline ?? 0;
  const isOnline = nextReachability === 'online';

  const streakOnline = isOnline ? previousOnline + 1 : 0;
  const streakOffline = isOnline ? 0 : previousOffline + 1;

  let nextState = previousState;
  let event:
    | {
        event_type: 'arrival' | 'departure';
        title: string;
        description: string;
        subject_name: string | null;
        device_id: string;
        severity: 'important';
        should_notify: true;
        metadata: Record<string, unknown>;
      }
    | null = null;

  if (isOnline && previousState !== 'home' && streakOnline >= ARRIVAL_THRESHOLD) {
    nextState = 'home';
    event = {
      event_type: 'arrival',
      title: `${device.owner_name ?? device.name} megérkezett`,
      description: `${device.name} stabilan elérhető lett az otthoni hálózaton.`,
      subject_name: device.owner_name ?? device.name,
      device_id: device.id,
      severity: 'important',
      should_notify: true,
      metadata: {
        slug: device.slug,
        observedAt,
        streakOnline,
      },
    };
  } else if (!isOnline && previousState === 'home' && streakOffline >= DEPARTURE_THRESHOLD) {
    nextState = 'away';
    event = {
      event_type: 'departure',
      title: `${device.owner_name ?? device.name} elment`,
      description: `${device.name} már huzamosabb ideje nem látszik az otthoni hálózaton.`,
      subject_name: device.owner_name ?? device.name,
      device_id: device.id,
      severity: 'important',
      should_notify: true,
      metadata: {
        slug: device.slug,
        observedAt,
        streakOffline,
      },
    };
  } else if (!isOnline && previousState === 'unknown' && streakOffline >= DEPARTURE_THRESHOLD) {
    nextState = 'away';
  }

  const presenceRow = {
    device_id: device.id,
    owner_name: device.owner_name,
    current_state: nextState,
    last_changed_at: event ? observedAt : currentPresence?.last_changed_at ?? observedAt,
    last_seen_at: isOnline ? observedAt : currentPresence?.last_seen_at ?? null,
    last_success_at: isOnline ? observedAt : currentPresence?.last_success_at ?? null,
    streak_online: streakOnline,
    streak_offline: streakOffline,
    confidence,
    derived_from: {
      reachabilityState: nextReachability,
      arrivalThreshold: ARRIVAL_THRESHOLD,
      departureThreshold: DEPARTURE_THRESHOLD,
      observedAt,
    },
  };

  return { presenceRow, event };
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Érvénytelen szenzor token.' }, { status: 401 });
    }

    const body = (await request.json()) as IngestBody;
    const observations = body.observations ?? [];
    const sensorLabel = body.sensorLabel?.trim() || 'redmi-note-9-pro';

    if (observations.length === 0) {
      return NextResponse.json({ error: 'Nincs feldolgozható megfigyelés.' }, { status: 400 });
    }

    const slugs = [...new Set(observations.map((item) => item.slug).filter(Boolean))];
    const supabase = getSupabaseAdminClient();

    const { data: devicesData, error: devicesError } = await supabase
      .from('house_devices')
      .select('*')
      .in('slug', slugs)
      .eq('is_enabled', true);

    if (devicesError) {
      throw devicesError;
    }

    const devices = (devicesData ?? []) as HouseDeviceRecord[];
    const deviceBySlug = new Map(devices.map((device) => [device.slug, device]));

    const relevantDeviceIds = devices.map((device) => device.id);
    const { data: presenceData, error: presenceError } = await supabase
      .from('house_presence')
      .select('*')
      .in('device_id', relevantDeviceIds.length > 0 ? relevantDeviceIds : ['00000000-0000-0000-0000-000000000000']);

    if (presenceError) {
      throw presenceError;
    }

    const presenceByDeviceId = new Map(((presenceData ?? []) as HousePresenceRecord[]).map((row) => [row.device_id, row]));
    const createdEvents: HouseEventRecord[] = [];
    const ignoredSlugs: string[] = [];

    for (const observation of observations) {
      const device = deviceBySlug.get(observation.slug);
      if (!device) {
        ignoredSlugs.push(observation.slug);
        continue;
      }

      const observedAt = getObservedAt(observation.observedAt);
      const confidence = clampConfidence(observation.confidence);

      const observationRows = buildObservationRows(device, observation, sensorLabel);
      if (observationRows.length > 0) {
        const { error } = await supabase.from('house_observations').insert(observationRows);
        if (error) {
          throw error;
        }
      }

      const reachabilityState = observation.reachabilityState ?? device.reachability_state;
      const powerState = observation.powerState ?? device.power_state;

      const deviceUpdate = {
        ip_address: observation.ipAddress ?? device.ip_address,
        mac_address: observation.macAddress ?? device.mac_address,
        vendor_name: observation.vendorName ?? device.vendor_name,
        reachability_state: reachabilityState,
        power_state: powerState,
        last_seen_at:
          reachabilityState === 'online' || powerState === 'on'
            ? observedAt
            : device.last_seen_at,
        last_ping_ms: reachabilityState === 'online' ? (observation.latencyMs ?? device.last_ping_ms) : null,
        sensor_label: sensorLabel,
      };

      const { error: updateError } = await supabase.from('house_devices').update(deviceUpdate).eq('id', device.id);
      if (updateError) {
        throw updateError;
      }

      const reachabilityEvent = buildReachabilityEvent(device, reachabilityState, observedAt);
      if (reachabilityEvent) {
        const { data, error } = await supabase.from('house_events').insert(reachabilityEvent).select('*').single();
        if (error) {
          throw error;
        }
        createdEvents.push(data as HouseEventRecord);
      }

      const powerEvent = buildPowerEvent(device, powerState, observedAt);
      if (powerEvent) {
        const { data, error } = await supabase.from('house_events').insert(powerEvent).select('*').single();
        if (error) {
          throw error;
        }
        createdEvents.push(data as HouseEventRecord);
      }

      const presenceResult = buildPresenceTransition(
        device,
        presenceByDeviceId.get(device.id) ?? null,
        reachabilityState,
        observedAt,
        confidence,
      );

      if (presenceResult) {
        const { data, error } = await supabase
          .from('house_presence')
          .upsert(presenceResult.presenceRow, { onConflict: 'device_id' })
          .select('*')
          .single();

        if (error) {
          throw error;
        }

        presenceByDeviceId.set(device.id, data as HousePresenceRecord);

        if (presenceResult.event) {
          const { data: insertedEvent, error: eventError } = await supabase
            .from('house_events')
            .insert(presenceResult.event)
            .select('*')
            .single();

          if (eventError) {
            throw eventError;
          }

          createdEvents.push(insertedEvent as HouseEventRecord);
        }
      }
    }

    for (const event of createdEvents.filter((item) => item.should_notify && !item.notified_at)) {
      const targetUserIds = getUserIdsForOwner(event.subject_name);
      await sendPushNotification({
        title: event.title,
        message: event.description ?? event.title,
        url: '/19811221',
        userIds: targetUserIds,
      });

      await supabase.from('house_events').update({ notified_at: new Date().toISOString() }).eq('id', event.id);
    }

    return NextResponse.json({
      success: true,
      processed: observations.length - ignoredSlugs.length,
      ignoredSlugs,
      createdEvents: createdEvents.length,
    });
  } catch (error) {
    console.error('House ingest hiba:', error);
    const message = error instanceof Error ? error.message : 'Ismeretlen hiba történt.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

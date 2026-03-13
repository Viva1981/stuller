export type HouseDeviceKind =
  | 'person_phone'
  | 'light'
  | 'tv'
  | 'router'
  | 'iot'
  | 'sensor'
  | 'appliance';

export type HouseMonitorMethod = 'ping' | 'local_api' | 'router_presence' | 'manual';
export type HouseReachabilityState = 'online' | 'offline' | 'unknown';
export type HousePowerState = 'on' | 'off' | 'unknown';
export type HousePresenceState = 'home' | 'away' | 'unknown';
export type HouseEventType =
  | 'arrival'
  | 'departure'
  | 'device_online'
  | 'device_offline'
  | 'light_on'
  | 'light_off'
  | 'status_change';

export type HouseDeviceRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slug: string;
  device_kind: HouseDeviceKind;
  owner_name: string | null;
  mac_address: string | null;
  ip_address: string | null;
  vendor_name: string;
  presence_role: boolean;
  state_role: boolean;
  monitor_method: HouseMonitorMethod;
  entry_type: 'device' | 'virtual' | 'multicast' | 'unknown';
  power_state: HousePowerState;
  reachability_state: HouseReachabilityState;
  last_seen_at: string | null;
  last_ping_ms: number | null;
  sensor_label: string | null;
  is_enabled: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type HousePresenceRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  device_id: string;
  owner_name: string | null;
  current_state: HousePresenceState;
  last_changed_at: string;
  last_seen_at: string | null;
  last_success_at: string | null;
  streak_online: number;
  streak_offline: number;
  confidence: number;
  derived_from: Record<string, unknown>;
};

export type HouseEventRecord = {
  id: string;
  created_at: string;
  event_type: HouseEventType;
  title: string;
  description: string | null;
  subject_name: string | null;
  device_id: string | null;
  severity: 'info' | 'important';
  should_notify: boolean;
  notified_at: string | null;
  metadata: Record<string, unknown>;
};

export const HOUSE_DEVICE_KIND_OPTIONS: Array<{ value: HouseDeviceKind; label: string }> = [
  { value: 'person_phone', label: 'Telefon / jelenlét' },
  { value: 'light', label: 'Lámpa' },
  { value: 'tv', label: 'TV' },
  { value: 'router', label: 'Router' },
  { value: 'iot', label: 'IoT eszköz' },
  { value: 'sensor', label: 'Szenzor' },
  { value: 'appliance', label: 'Háztartási eszköz' },
];

export const HOUSE_MONITOR_METHOD_OPTIONS: Array<{ value: HouseMonitorMethod; label: string }> = [
  { value: 'ping', label: 'Ping' },
  { value: 'local_api', label: 'Helyi API' },
  { value: 'router_presence', label: 'Router jelenlét' },
  { value: 'manual', label: 'Kézi' },
];

export function formatRelativeHouseTime(value?: string | null): string {
  if (!value) {
    return 'nincs adat';
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'épp most';
  if (diffMinutes < 60) return `${diffMinutes} perce`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} órája`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} napja`;
}

export function formatHouseTimestamp(value?: string | null): string {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function slugifyHouseDeviceName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function getPresenceLabel(state: HousePresenceState): string {
  if (state === 'home') return 'otthon';
  if (state === 'away') return 'nincs otthon';
  return 'ismeretlen';
}

export function getReachabilityLabel(state: HouseReachabilityState): string {
  if (state === 'online') return 'elérhető';
  if (state === 'offline') return 'offline';
  return 'ismeretlen';
}

export function getPowerLabel(state: HousePowerState): string {
  if (state === 'on') return 'bekapcsolva';
  if (state === 'off') return 'kikapcsolva';
  return 'ismeretlen';
}

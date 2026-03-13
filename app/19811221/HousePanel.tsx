'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ChevronDown, Cpu, Home, Lightbulb, Loader2, Plus, Router, Save, Smartphone, Tv, Wifi, WifiOff } from 'lucide-react';

import { supabase } from '@/app/supabase';
import {
  formatHouseTimestamp,
  formatRelativeHouseTime,
  getPowerLabel,
  getPresenceLabel,
  getReachabilityLabel,
  HOUSE_DEVICE_KIND_OPTIONS,
  HOUSE_MONITOR_METHOD_OPTIONS,
  HouseDeviceRecord,
  HouseEventRecord,
  HousePresenceRecord,
  slugifyHouseDeviceName,
} from '@/app/lib/house';

type DeviceFormState = {
  id: string | null;
  name: string;
  owner_name: string;
  device_kind: HouseDeviceRecord['device_kind'];
  monitor_method: HouseDeviceRecord['monitor_method'];
  mac_address: string;
  ip_address: string;
  vendor_name: string;
  notes: string;
  presence_role: boolean;
  state_role: boolean;
  is_enabled: boolean;
};

const EMPTY_FORM: DeviceFormState = {
  id: null,
  name: '',
  owner_name: '',
  device_kind: 'person_phone',
  monitor_method: 'ping',
  mac_address: '',
  ip_address: '',
  vendor_name: '',
  notes: '',
  presence_role: true,
  state_role: false,
  is_enabled: true,
};

function getDeviceIcon(kind: HouseDeviceRecord['device_kind']) {
  if (kind === 'person_phone') return Smartphone;
  if (kind === 'light') return Lightbulb;
  if (kind === 'tv') return Tv;
  if (kind === 'router') return Router;
  return Cpu;
}

export default function HousePanel() {
  const [devices, setDevices] = useState<HouseDeviceRecord[]>([]);
  const [presence, setPresence] = useState<HousePresenceRecord[]>([]);
  const [events, setEvents] = useState<HouseEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [form, setForm] = useState<DeviceFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const fetchHouseData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [devicesResult, presenceResult, eventsResult] = await Promise.all([
      supabase.from('house_devices').select('*').order('name', { ascending: true }),
      supabase.from('house_presence').select('*').order('owner_name', { ascending: true }),
      supabase.from('house_events').select('*').order('created_at', { ascending: false }).limit(12),
    ]);

    if (devicesResult.error || presenceResult.error || eventsResult.error) {
      setError(
        devicesResult.error?.message || presenceResult.error?.message || eventsResult.error?.message || 'Ismeretlen hiba'
      );
      setLoading(false);
      return;
    }

    setDevices((devicesResult.data ?? []) as HouseDeviceRecord[]);
    setPresence((presenceResult.data ?? []) as HousePresenceRecord[]);
    setEvents((eventsResult.data ?? []) as HouseEventRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void fetchHouseData();
    }, 0);

    const devicesChannel = supabase
      .channel('house-devices-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_devices' }, () => void fetchHouseData())
      .subscribe();

    const presenceChannel = supabase
      .channel('house-presence-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_presence' }, () => void fetchHouseData())
      .subscribe();

    const eventsChannel = supabase
      .channel('house-events-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_events' }, () => void fetchHouseData())
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(devicesChannel);
      void supabase.removeChannel(presenceChannel);
      void supabase.removeChannel(eventsChannel);
    };
  }, [fetchHouseData]);

  const presenceByDeviceId = useMemo(
    () => new Map(presence.map((item) => [item.device_id, item])),
    [presence]
  );

  const peopleCards = useMemo(
    () =>
      devices
        .filter((device) => device.presence_role)
        .map((device) => ({
          device,
          presence: presenceByDeviceId.get(device.id) ?? null,
        }))
        .sort((left, right) => (left.device.owner_name || left.device.name).localeCompare(right.device.owner_name || right.device.name, 'hu')),
    [devices, presenceByDeviceId]
  );

  function startEdit(device: HouseDeviceRecord) {
    setForm({
      id: device.id,
      name: device.name,
      owner_name: device.owner_name ?? '',
      device_kind: device.device_kind,
      monitor_method: device.monitor_method,
      mac_address: device.mac_address ?? '',
      ip_address: device.ip_address ?? '',
      vendor_name: device.vendor_name ?? '',
      notes: device.notes ?? '',
      presence_role: device.presence_role,
      state_role: device.state_role,
      is_enabled: device.is_enabled,
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function saveDevice() {
    if (!form.name.trim()) {
      setError('Adj nevet az eszköznek.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      slug: slugifyHouseDeviceName(form.name),
      owner_name: form.owner_name.trim() || null,
      device_kind: form.device_kind,
      monitor_method: form.monitor_method,
      mac_address: form.mac_address.trim() || null,
      ip_address: form.ip_address.trim() || null,
      vendor_name: form.vendor_name.trim() || 'Ismeretlen gyártó',
      notes: form.notes.trim() || null,
      presence_role: form.presence_role,
      state_role: form.state_role,
      is_enabled: form.is_enabled,
    };

    const query = form.id
      ? supabase.from('house_devices').update(payload).eq('id', form.id)
      : supabase.from('house_devices').insert(payload);

    const { error: saveError } = await query;
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    resetForm();
    await fetchHouseData();
  }

  async function removeDevice(id: string) {
    if (!window.confirm('Biztosan törlöd ezt az eszközt?')) {
      return;
    }

    const { error: deleteError } = await supabase.from('house_devices').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (form.id === id) {
      resetForm();
    }

    await fetchHouseData();
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a0c10]/60 backdrop-blur-md transition-all">
      <div className="flex items-center justify-between gap-3 p-4 px-4 sm:px-6">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Otthon</span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown size={16} className="text-emerald-400" />
            </motion.div>
          </button>

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
              {peopleCards.filter((item) => item.presence?.current_state === 'home').length} OTTHON
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsExpanded(true);
              resetForm();
            }}
            className="rounded-xl bg-emerald-500 p-2 text-black transition-all active:scale-90"
            aria-label="Új otthoni eszköz"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => void fetchHouseData()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-transform active:scale-95"
          >
            <Activity size={14} />
            Frissítés
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-6 sm:px-6"
          >
            <div className="rounded-[2rem] border border-emerald-500/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,0.95))] p-5 shadow-2xl shadow-emerald-950/30 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400/80">Otthon</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Jelenlét és otthoni eszközök</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300">
                    Ez a panel mutatja, ki van itthon, melyik eszköz milyen állapotban van, és ide érkeznek majd a lakásban
                    futó Android szenzor megfigyelései.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-300">
                  <div className="font-black uppercase tracking-widest text-white">Szenzor végpont</div>
                  <div className="mt-1 font-mono text-[11px] text-emerald-300">POST /api/house/ingest</div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="mt-8 flex items-center justify-center rounded-[2rem] border border-white/5 bg-black/10 py-12 text-slate-300">
                  <Loader2 className="mr-3 animate-spin" size={18} />
                  Betöltés...
                </div>
              ) : (
                <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {peopleCards.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-white/10 bg-black/10 p-6 text-sm text-slate-400 md:col-span-2 xl:col-span-4">
                Még nincs jelenlétre figyelt eszköz. Adj hozzá legalább egy telefont vagy személyhez rendelt eszközt.
              </div>
            ) : (
              peopleCards.map(({ device, presence: presenceRow }) => {
                const isHome = presenceRow?.current_state === 'home';
                return (
                  <article
                    key={device.id}
                    className={`rounded-[2rem] border p-5 shadow-xl ${
                      isHome
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-white/10 bg-black/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">Jelenlét</div>
                        <h3 className="mt-2 text-2xl font-black text-white">{device.owner_name || device.name}</h3>
                      </div>
                      <div className={`rounded-full p-3 ${isHome ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                        <Home size={18} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm font-bold">
                      {isHome ? <Wifi size={16} className="text-emerald-300" /> : <WifiOff size={16} className="text-slate-400" />}
                      <span className={isHome ? 'text-emerald-200' : 'text-slate-200'}>
                        {getPresenceLabel(presenceRow?.current_state ?? 'unknown')}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-300">
                      <div className="flex justify-between gap-3">
                        <span>Eszköz</span>
                        <span className="font-semibold text-white">{device.name}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Utolsó sikeres jel</span>
                        <span className="font-semibold text-white">{formatRelativeHouseTime(presenceRow?.last_success_at)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>Biztonság</span>
                        <span className="font-semibold text-white">{presenceRow?.confidence ?? 0}%</span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-[2rem] border border-white/10 bg-black/15 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-white">Eszközök</h3>
                  <p className="mt-1 text-sm text-slate-400">Itt tudod felvenni a figyelt telefonokat, lámpákat és egyéb otthoni eszközöket.</p>
                </div>
                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
                >
                  <Plus size={14} />
                  Új eszköz
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {devices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                    Még nincs eszköz felvéve.
                  </div>
                ) : (
                  devices.map((device) => {
                    const Icon = getDeviceIcon(device.device_kind);
                    return (
                      <div
                        key={device.id}
                        className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-emerald-500/20"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-4">
                            <div className="rounded-2xl bg-white/8 p-3 text-white">
                              <Icon size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-lg font-black text-white">{device.name}</h4>
                                {!device.is_enabled && (
                                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                                    Kikapcsolva
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-400">
                                {device.owner_name ? `${device.owner_name} • ` : ''}
                                {device.slug} • {device.monitor_method}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-300">
                              {getReachabilityLabel(device.reachability_state)}
                            </span>
                            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-200">
                              {getPowerLabel(device.power_state)}
                            </span>
                            <button
                              onClick={() => startEdit(device)}
                              className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white"
                            >
                              Szerkesztés
                            </button>
                            <button
                              onClick={() => void removeDevice(device.id)}
                              className="rounded-full border border-red-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-red-200"
                            >
                              Törlés
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 text-xs text-slate-300 md:grid-cols-4">
                          <div>
                            <div className="text-slate-500">IP</div>
                            <div className="font-semibold text-white">{device.ip_address || '—'}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">MAC</div>
                            <div className="font-semibold text-white">{device.mac_address || '—'}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Gyártó</div>
                            <div className="font-semibold text-white">{device.vendor_name || '—'}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Utolsó jel</div>
                            <div className="font-semibold text-white">{formatHouseTimestamp(device.last_seen_at)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-xl font-black text-white">{form.id ? 'Eszköz szerkesztése' : 'Új eszköz felvétele'}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  A szenzor ezekre a slugokra fog mérési adatot küldeni. A név alapján automatikusan generáljuk.
                </p>

                <div className="mt-5 space-y-3">
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Eszköz neve"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />

                  <input
                    value={slugifyHouseDeviceName(form.name)}
                    readOnly
                    className="w-full rounded-2xl border border-white/5 bg-black/15 px-4 py-3 text-xs text-slate-400 outline-none"
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={form.owner_name}
                      onChange={(event) => setForm((current) => ({ ...current, owner_name: event.target.value }))}
                      placeholder="Tulajdonos / személy"
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <select
                      value={form.device_kind}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, device_kind: event.target.value as HouseDeviceRecord['device_kind'] }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none"
                    >
                      {HOUSE_DEVICE_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      value={form.monitor_method}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, monitor_method: event.target.value as HouseDeviceRecord['monitor_method'] }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none"
                    >
                      {HOUSE_MONITOR_METHOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={form.vendor_name}
                      onChange={(event) => setForm((current) => ({ ...current, vendor_name: event.target.value }))}
                      placeholder="Gyártó"
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={form.ip_address}
                      onChange={(event) => setForm((current) => ({ ...current, ip_address: event.target.value }))}
                      placeholder="IP cím"
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <input
                      value={form.mac_address}
                      onChange={(event) => setForm((current) => ({ ...current, mac_address: event.target.value }))}
                      placeholder="MAC cím"
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>

                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    placeholder="Megjegyzés"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={form.presence_role}
                        onChange={(event) => setForm((current) => ({ ...current, presence_role: event.target.checked }))}
                      />
                      Jelenlétre figyelünk
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={form.state_role}
                        onChange={(event) => setForm((current) => ({ ...current, state_role: event.target.checked }))}
                      />
                      Állapotfigyelés
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={form.is_enabled}
                        onChange={(event) => setForm((current) => ({ ...current, is_enabled: event.target.checked }))}
                      />
                      Aktív eszköz
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => void saveDevice()}
                      disabled={saving}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition-transform active:scale-95 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      {form.id ? 'Mentés' : 'Eszköz hozzáadása'}
                    </button>

                    {form.id && (
                      <button
                        onClick={resetForm}
                        className="rounded-2xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
                      >
                        Mégse
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/15 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-white">Legutóbbi események</h3>
                    <p className="mt-1 text-sm text-slate-400">Ide kerül majd minden megérkezés, lekapcsolás és fontos otthoni állapotváltás.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {events.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                      Még nincs otthoni esemény.
                    </div>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-black text-white">{event.title}</h4>
                              {event.should_notify && (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                  Push
                                </span>
                              )}
                            </div>
                            {event.description && <p className="mt-1 text-sm text-slate-300">{event.description}</p>}
                          </div>
                          <div className="text-right text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            {formatRelativeHouseTime(event.created_at)}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                          <span className="rounded-full bg-white/5 px-2 py-1">{event.event_type}</span>
                          <span className="rounded-full bg-white/5 px-2 py-1">{event.subject_name || 'Otthon'}</span>
                          <span className="rounded-full bg-white/5 px-2 py-1">{formatHouseTimestamp(event.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CarFront, ChevronDown, ChevronUp, Download, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'stuller-fuel-expense-entries-v1';
const FORM_STORAGE_KEY = 'stuller-fuel-expense-form-v1';
const DEFAULT_AMORTIZATION_FT_PER_KM = 15;

type FuelEntry = {
  id: string;
  employeeName: string;
  date: string;
  route: string;
  purpose: string;
  licensePlate: string;
  distanceKm: number;
  consumptionLitersPer100Km: number;
  navFuelPriceFtPerLiter: number;
};

type FormState = {
  employeeName: string;
  date: string;
  route: string;
  purpose: string;
  licensePlate: string;
  distanceKm: string;
  consumptionLitersPer100Km: string;
  navFuelPriceFtPerLiter: string;
  amortizationFtPerKm: string;
};

type NavResponse = {
  latest?: {
    month: string;
    esz95FtPerLiter: number;
  };
  error?: string;
};

const INITIAL_FORM: FormState = {
  employeeName: '',
  date: new Date().toISOString().split('T')[0],
  route: '',
  purpose: '',
  licensePlate: '',
  distanceKm: '',
  consumptionLitersPer100Km: '',
  navFuelPriceFtPerLiter: '',
  amortizationFtPerKm: String(DEFAULT_AMORTIZATION_FT_PER_KM),
};

function parsePositiveNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function calculateFuelCost(entry: FuelEntry) {
  return (entry.distanceKm / 100) * entry.consumptionLitersPer100Km * entry.navFuelPriceFtPerLiter;
}

function calculateAmortization(entry: FuelEntry, rate: number) {
  return entry.distanceKm * rate;
}

export default function FuelExpenseTracker({ owner }: { owner: string }) {
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [navInfo, setNavInfo] = useState<string | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const storageKey = `${STORAGE_KEY}-${owner.toLowerCase()}`;
  const formStorageKey = `${FORM_STORAGE_KEY}-${owner.toLowerCase()}`;

  useEffect(() => {
    const rawEntries = localStorage.getItem(storageKey);
    if (rawEntries) {
      try {
        setEntries(JSON.parse(rawEntries) as FuelEntry[]);
      } catch {
        setEntries([]);
      }
    }

    const rawForm = localStorage.getItem(formStorageKey);
    if (rawForm) {
      try {
        setForm((prev) => ({ ...prev, ...(JSON.parse(rawForm) as Partial<FormState>) }));
      } catch {
        setForm(INITIAL_FORM);
      }
    }
  }, [storageKey, formStorageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries, storageKey]);

  useEffect(() => {
    localStorage.setItem(formStorageKey, JSON.stringify(form));
  }, [form, formStorageKey]);

  const amortizationRate = useMemo(() => {
    const parsed = parsePositiveNumber(form.amortizationFtPerKm);
    return Number.isNaN(parsed) ? DEFAULT_AMORTIZATION_FT_PER_KM : parsed;
  }, [form.amortizationFtPerKm]);

  const filteredEntries = useMemo(() => {
    const normalizedName = employeeFilter.trim().toLowerCase();
    return entries.filter((entry) => {
      if (exportFrom && entry.date < exportFrom) return false;
      if (exportTo && entry.date > exportTo) return false;
      if (normalizedName && !entry.employeeName.toLowerCase().includes(normalizedName)) return false;
      return true;
    });
  }, [entries, exportFrom, exportTo, employeeFilter]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        const fuelCost = calculateFuelCost(entry);
        const amortization = calculateAmortization(entry, amortizationRate);
        return {
          distanceKm: acc.distanceKm + entry.distanceKm,
          fuelCost: acc.fuelCost + fuelCost,
          amortization: acc.amortization + amortization,
          total: acc.total + fuelCost + amortization,
        };
      },
      { distanceKm: 0, fuelCost: 0, amortization: 0, total: 0 },
    );
  }, [filteredEntries, amortizationRate]);

  const hasFilter = Boolean(exportFrom || exportTo || employeeFilter.trim());

  const handleAddEntry = () => {
    setError(null);
    const distanceKm = parsePositiveNumber(form.distanceKm);
    const consumption = parsePositiveNumber(form.consumptionLitersPer100Km);
    const navPrice = parsePositiveNumber(form.navFuelPriceFtPerLiter);

    if (
      !form.employeeName.trim() ||
      !form.date ||
      !form.route.trim() ||
      !form.purpose.trim() ||
      !form.licensePlate.trim() ||
      Number.isNaN(distanceKm) ||
      Number.isNaN(consumption) ||
      Number.isNaN(navPrice)
    ) {
      setError('Kérlek minden kötelező mezőt tölts ki helyesen.');
      return;
    }

    const entry: FuelEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      employeeName: form.employeeName.trim(),
      date: form.date,
      route: form.route.trim(),
      purpose: form.purpose.trim(),
      licensePlate: form.licensePlate.trim().toUpperCase(),
      distanceKm,
      consumptionLitersPer100Km: consumption,
      navFuelPriceFtPerLiter: navPrice,
    };

    setEntries((prev) => [entry, ...prev]);
  };

  const handleFetchNavPrice = async () => {
    setNavLoading(true);
    setError(null);
    setNavInfo(null);
    try {
      const response = await fetch('/api/nav-fuel-price', { cache: 'no-store' });
      const data = (await response.json()) as NavResponse;
      if (!response.ok) {
        throw new Error(data.error ?? 'NAV ár lekérés sikertelen.');
      }
      if (!data.latest?.esz95FtPerLiter) {
        throw new Error('A NAV válaszból nem olvasható ki ESZ-95 ár.');
      }

      setForm((prev) => ({ ...prev, navFuelPriceFtPerLiter: String(data.latest?.esz95FtPerLiter ?? '') }));
      setNavInfo(`NAV frissítve: ${data.latest.month} - ${data.latest.esz95FtPerLiter} Ft/l`);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Ismeretlen hiba történt.');
    } finally {
      setNavLoading(false);
    }
  };

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      setError('Nincs exportálható adat az adott szűrővel.');
      return;
    }

    const rows: Array<Record<string, string | number>> = filteredEntries.map((entry) => {
      const fuelCost = calculateFuelCost(entry);
      const amortization = calculateAmortization(entry, amortizationRate);
      return {
        'Dolgozó neve': entry.employeeName,
        Dátum: entry.date,
        'Honnan → hova': entry.route,
        'Cél / feladat': entry.purpose,
        'Autó rendszáma': entry.licensePlate,
        Km: entry.distanceKm,
        'Fogyasztási norma (l/100km)': entry.consumptionLitersPer100Km,
        'NAV üzemanyagár (Ft/l)': entry.navFuelPriceFtPerLiter,
        'Rögzített amortizáció (Ft/km)': amortizationRate,
        'Üzemanyagköltség (Ft)': Math.round(fuelCost),
        'Amortizáció (Ft)': Math.round(amortization),
        'Számolt térítés (Ft)': Math.round(fuelCost + amortization),
      };
    });

    rows.push({
      'Dolgozó neve': 'Összesen',
      Dátum: '',
      'Honnan → hova': '',
      'Cél / feladat': '',
      'Autó rendszáma': '',
      Km: Math.round(totals.distanceKm),
      'Fogyasztási norma (l/100km)': '',
      'NAV üzemanyagár (Ft/l)': '',
      'Rögzített amortizáció (Ft/km)': amortizationRate,
      'Üzemanyagköltség (Ft)': Math.round(totals.fuelCost),
      'Amortizáció (Ft)': Math.round(totals.amortization),
      'Számolt térítés (Ft)': Math.round(totals.total),
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Üzemanyag elszámolás');

    const fromLabel = exportFrom || 'kezdet';
    const toLabel = exportTo || 'vége';
    const nameLabel = employeeFilter.trim() ? employeeFilter.trim().replace(/\s+/g, '-') : 'mindenki';
    XLSX.writeFile(workbook, `üzemanyag-elszámolás_${nameLabel}_${fromLabel}_${toLabel}.xlsx`);
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-[#0a0c10] p-4 transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-4">
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
            {isOpen ? <ChevronUp className="text-white/50" /> : <ChevronDown className="text-white/50" />}
          </div>
          <h2 className="text-xl font-black uppercase italic tracking-wider text-white">ÜZEMANYAG ELSZÁMOLÁS</h2>
        </div>
        <CarFront size={20} className="text-white/30" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="mx-1 -mt-2 overflow-hidden rounded-b-2xl border-x border-b border-white/5 bg-[#0a0c10]/50 px-4 pb-6 pt-4"
          >
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Dolgozó neve" value={form.employeeName} onChange={(e) => setForm((prev) => ({ ...prev, employeeName: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20 sm:col-span-2" placeholder="Honnan → hova" value={form.route} onChange={(e) => setForm((prev) => ({ ...prev, route: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Cél / feladat" value={form.purpose} onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Autó rendszáma" value={form.licensePlate} onChange={(e) => setForm((prev) => ({ ...prev, licensePlate: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Km" value={form.distanceKm} onChange={(e) => setForm((prev) => ({ ...prev, distanceKm: e.target.value }))} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Fogyasztási norma (l/100km)" value={form.consumptionLitersPer100Km} onChange={(e) => setForm((prev) => ({ ...prev, consumptionLitersPer100Km: e.target.value }))} />
                <div className="flex gap-2">
                  <input className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="NAV üzemanyagár (Ft/l)" value={form.navFuelPriceFtPerLiter} onChange={(e) => setForm((prev) => ({ ...prev, navFuelPriceFtPerLiter: e.target.value }))} />
                  <button type="button" onClick={handleFetchNavPrice} disabled={navLoading} className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 disabled:opacity-50">
                    {navLoading ? '...' : 'NAV'}
                  </button>
                </div>
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Amortizáció (Ft/km)" value={form.amortizationFtPerKm} onChange={(e) => setForm((prev) => ({ ...prev, amortizationFtPerKm: e.target.value }))} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={handleAddEntry} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-emerald-400">
                  <Plus size={16} /> Tétel hozzáadása
                </button>
                <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-white/10">
                  <Download size={16} /> Export XLSX
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Intervallum kezdete" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20" placeholder="Intervallum vége" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
                <input className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/20 lg:col-span-2" placeholder="Dolgozó név szűrő" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} />
              </div>

              {navInfo ? <p className="text-xs text-white/70">{navInfo}</p> : null}
              {error ? <p className="text-sm text-rose-200">{error}</p> : null}

              <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-4">
                <div className="text-xs text-white/60">Összes km<div className="mt-1 text-sm font-black text-white">{hasFilter ? totals.distanceKm.toFixed(1) : '-'}</div></div>
                <div className="text-xs text-white/60">Üzemanyagköltség<div className="mt-1 text-sm font-black text-white">{hasFilter ? `${Math.round(totals.fuelCost)} Ft` : '-'}</div></div>
                <div className="text-xs text-white/60">Amortizáció<div className="mt-1 text-sm font-black text-white">{hasFilter ? `${Math.round(totals.amortization)} Ft` : '-'}</div></div>
                <div className="text-xs text-white/60">Számolt térítés<div className="mt-1 text-sm font-black text-emerald-300">{hasFilter ? `${Math.round(totals.total)} Ft` : '-'}</div></div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-white/80">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="px-2 py-2">Dolgozó</th>
                      <th className="px-2 py-2">Dátum</th>
                      <th className="px-2 py-2">Útvonal</th>
                      <th className="px-2 py-2">Km</th>
                      <th className="px-2 py-2">Térítés</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => {
                      const total = calculateFuelCost(entry) + calculateAmortization(entry, amortizationRate);
                      return (
                        <tr key={entry.id} className="border-b border-white/5 last:border-b-0">
                          <td className="px-2 py-2">{entry.employeeName}</td>
                          <td className="px-2 py-2">{entry.date}</td>
                          <td className="px-2 py-2">{entry.route}</td>
                          <td className="px-2 py-2">{entry.distanceKm}</td>
                          <td className="px-2 py-2 font-black text-emerald-300">{Math.round(total)} Ft</td>
                          <td className="px-2 py-2">
                            <button onClick={() => setEntries((prev) => prev.filter((row) => row.id !== entry.id))} className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/10 hover:text-rose-200">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-4 text-center text-sm text-white/40">
                          Még nincs rögzített tétel.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

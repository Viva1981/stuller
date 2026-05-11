import { NextResponse } from 'next/server';

const NAV_FUEL_PAGE_URL = 'https://nav.gov.hu/?contentid=5346007';
const HUNGARIAN_MONTHS = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
];

type NavFuelPrice = {
  month: string;
  esz95FtPerLiter: number;
};

function parseNavFuelPrices(text: string): NavFuelPrice[] {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean);

  const prices: NavFuelPrice[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const month = lines[index].toLowerCase();
    if (!HUNGARIAN_MONTHS.includes(month)) continue;

    const nextLines = lines.slice(index + 1, index + 12);
    const firstNumberLine = nextLines.find((line) => /^\d{2,4}$/.test(line));
    if (!firstNumberLine) continue;

    const esz95FtPerLiter = Number(firstNumberLine);
    if (Number.isNaN(esz95FtPerLiter)) continue;

    prices.push({ month: lines[index], esz95FtPerLiter });
  }

  return prices;
}

export async function GET() {
  try {
    const response = await fetch(NAV_FUEL_PAGE_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`NAV oldal hiba: ${response.status}`);
    }

    const html = await response.text();
    const sectionStart = html.indexOf('## Üzemanyagárak');
    const sectionEnd = html.indexOf('## Jegybanki alapkamat');
    const sectionText =
      sectionStart >= 0 && sectionEnd > sectionStart ? html.slice(sectionStart, sectionEnd) : html;

    const prices = parseNavFuelPrices(sectionText);
    if (prices.length === 0) {
      throw new Error('Nem sikerült kinyerni a NAV üzemanyagár adatokat.');
    }

    return NextResponse.json({
      sourceUrl: NAV_FUEL_PAGE_URL,
      fetchedAt: new Date().toISOString(),
      latest: prices[0],
      prices,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ismeretlen hiba történt.' },
      { status: 500 },
    );
  }
}


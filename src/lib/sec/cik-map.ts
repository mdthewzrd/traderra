/**
 * Ticker ↔ CIK map. Ported from Nexus-Terminal lib/sec/cik-map.ts.
 *
 * Hydrates the full SEC ticker map (sec.gov/files/company_tickers_exchange.json,
 * ~6–10k filers) into Postgres (SecTickerCik) and keeps an in-memory copy.
 * Refreshes from SEC every 24h; falls back to the stale DB copy on fetch failure.
 */
import { prisma } from '@/lib/prisma';
import { secFetchJson } from '@/lib/sec/client';

const CIK_MAP_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CikMapEntry {
  ticker: string; // uppercase, share-class hyphenated (e.g. "BRK-B")
  cik: string; // 10-digit zero-padded SEC CIK
  name: string;
  exchange: string | null;
}

interface CikMapResponse {
  fields: string[];
  data: Array<[number, string, string, string | null]>; // [cik, name, ticker, exchange]
}

let inMemoryMap: Map<string, CikMapEntry> | null = null;
let lastLoadAt = 0;
let inFlightLoad: Promise<Map<string, CikMapEntry>> | null = null;

export function normalizeTicker(input: string): string {
  return input.trim().toUpperCase().replace(/\./g, '-');
}

export function padCik(cik: string | number): string {
  return String(cik).padStart(10, '0');
}

async function fetchCikMapFromSec(): Promise<Map<string, CikMapEntry>> {
  const payload = await secFetchJson<CikMapResponse>(CIK_MAP_URL);
  const map = new Map<string, CikMapEntry>();
  for (const row of payload.data) {
    const [cikNum, name, ticker, exchange] = row;
    if (!ticker || typeof ticker !== 'string') continue;
    map.set(ticker.toUpperCase(), {
      ticker: ticker.toUpperCase(),
      cik: padCik(cikNum),
      name,
      exchange: exchange ?? null,
    });
  }
  return map;
}

// Chunked upsert so we never wipe the map if a refresh partially fails.
async function persistCikMap(map: Map<string, CikMapEntry>): Promise<void> {
  const entries = Array.from(map.values());
  const CHUNK = 500;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((e) =>
        prisma.secTickerCik.upsert({
          where: { ticker: e.ticker },
          create: { ticker: e.ticker, cik: e.cik, name: e.name, exchange: e.exchange },
          update: { cik: e.cik, name: e.name, exchange: e.exchange, fetchedAt: new Date() },
        }),
      ),
    );
  }
}

async function hydrateFromDb(): Promise<{
  map: Map<string, CikMapEntry>;
  fetchedAt: Date | null;
}> {
  const rows = await prisma.secTickerCik.findMany();
  const map = new Map<string, CikMapEntry>();
  let newest: Date | null = null;
  for (const row of rows) {
    map.set(row.ticker, {
      ticker: row.ticker,
      cik: row.cik,
      name: row.name,
      exchange: row.exchange,
    });
    if (!newest || row.fetchedAt > newest) newest = row.fetchedAt;
  }
  return { map, fetchedAt: newest };
}

async function loadCikMap(): Promise<Map<string, CikMapEntry>> {
  if (inFlightLoad) return inFlightLoad;

  inFlightLoad = (async () => {
    const { map: dbMap, fetchedAt } = await hydrateFromDb();
    const dbStale = !fetchedAt || Date.now() - fetchedAt.getTime() > REFRESH_INTERVAL_MS;

    if (dbMap.size > 0 && !dbStale) {
      inMemoryMap = dbMap;
      lastLoadAt = Date.now();
      return dbMap;
    }

    try {
      const freshMap = await fetchCikMapFromSec();
      inMemoryMap = freshMap;
      lastLoadAt = Date.now();
      await persistCikMap(freshMap).catch((err) =>
        console.warn('[sec-cik-map] persist failed:', err),
      );
      return freshMap;
    } catch (error) {
      if (dbMap.size > 0) {
        inMemoryMap = dbMap;
        console.warn('[sec-cik-map] SEC fetch failed; using stale db copy:', error);
        return dbMap;
      }
      throw error;
    }
  })();

  try {
    return await inFlightLoad;
  } finally {
    inFlightLoad = null;
  }
}

export async function getCikForTicker(rawTicker: string): Promise<CikMapEntry | null> {
  const normalized = normalizeTicker(rawTicker);
  if (!normalized) return null;

  const fresh =
    inMemoryMap && Date.now() - lastLoadAt < REFRESH_INTERVAL_MS
      ? inMemoryMap
      : await loadCikMap();
  return fresh.get(normalized) ?? null;
}

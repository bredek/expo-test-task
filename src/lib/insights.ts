import type { ActivityItem } from '../api/types';
import { type Fixed, formatUsd, sumFixed, usdValue } from './money';

// Activity amounts are signed decimal strings ("-0.5"). USD figures here use
// today's prices (the API has no historical prices), which the UI states.

export type DayBucket = { day: string; earned: Fixed; reversed: Fixed };

export type Insights = {
  days: DayBucket[]; // oldest first, one per calendar day (local time)
  earned: Fixed;
  reversed: Fixed;
  claimed: Fixed;
  byExchange: { exchange: string; earned: Fixed }[];
  count: number;
};

const ZERO: Fixed = { units: 0n, scale: 0 };

function absUsd(item: ActivityItem, prices: Record<string, string>): Fixed | null {
  const price = prices[item.asset];
  if (!price) return null;
  const abs = item.amount.startsWith('-') ? item.amount.slice(1) : item.amount;
  try {
    return usdValue(abs, price);
  } catch {
    return null; // malformed amount: leave it out of the totals rather than guess
  }
}

/**
 * Merges activity pages, keeping the first copy of each id. The API's cursor is an
 * offset, so items created between page loads shift later pages and repeat entries.
 */
export function mergePages(pages: { items: ActivityItem[] }[]): ActivityItem[] {
  const seen = new Set<string>();
  const out: ActivityItem[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function buildInsights(
  items: ActivityItem[],
  prices: Record<string, string>,
  now: Date,
  dayCount = 30,
): Insights {
  const keys: string[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(dayKey(d));
  }
  const buckets = new Map(keys.map((k) => [k, { earned: [] as Fixed[], reversed: [] as Fixed[] }]));
  const earned: Fixed[] = [];
  const reversed: Fixed[] = [];
  const claimed: Fixed[] = [];
  const exchanges = new Map<string, Fixed[]>();

  for (const item of items) {
    const usd = absUsd(item, prices);
    if (!usd) continue;
    const bucket = buckets.get(dayKey(new Date(item.createdAt)));
    if (item.type === 'accrual') {
      earned.push(usd);
      bucket?.earned.push(usd);
      const ex = item.exchange ?? 'Other';
      exchanges.set(ex, [...(exchanges.get(ex) ?? []), usd]);
    } else if (item.type === 'reversal') {
      reversed.push(usd);
      bucket?.reversed.push(usd);
    } else if (item.type === 'claim' && item.status === 'completed') {
      claimed.push(usd);
    }
  }

  return {
    days: keys.map((day) => ({
      day,
      earned: sumFixed(buckets.get(day)!.earned),
      reversed: sumFixed(buckets.get(day)!.reversed),
    })),
    earned: earned.length ? sumFixed(earned) : ZERO,
    reversed: reversed.length ? sumFixed(reversed) : ZERO,
    claimed: claimed.length ? sumFixed(claimed) : ZERO,
    byExchange: [...exchanges.entries()]
      .map(([exchange, v]) => ({ exchange, earned: sumFixed(v) }))
      .sort((a, b) => compareFixed(b.earned, a.earned)),
    count: items.length,
  };
}

export function compareFixed(a: Fixed, b: Fixed): number {
  const s = Math.max(a.scale, b.scale);
  const x = a.units * 10n ** BigInt(s - a.scale);
  const y = b.units * 10n ** BigInt(s - b.scale);
  return x === y ? 0 : x > y ? 1 : -1;
}

/** For chart geometry only (bar heights). Never used for a displayed amount. */
export function toChartNumber(v: Fixed): number {
  return Number(v.units) / 10 ** v.scale;
}

export { formatUsd };

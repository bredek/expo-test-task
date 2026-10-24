import { describe, expect, it } from 'vitest';
import type { ActivityItem } from '../api/types';
import { buildInsights, mergePages } from './insights';
import { formatUsd } from './money';

const item = (p: Partial<ActivityItem>): ActivityItem => ({
  id: Math.random().toString(36),
  type: 'accrual',
  asset: 'USDT',
  amount: '1',
  status: 'confirmed',
  exchange: 'Binance',
  createdAt: '2026-10-24T10:00:00.000',
  relatedId: null,
  ...p,
});

describe('activity insights', () => {
  const now = new Date('2026-10-24T12:00:00.000');
  const prices = { USDT: '1', BTC: '50000' };

  it('totals earned, reversed and completed claims in USD with signed amounts', () => {
    const r = buildInsights(
      [
        item({ amount: '9.81' }),
        item({ asset: 'BTC', amount: '0.0001', exchange: 'OKX' }),
        item({ type: 'reversal', amount: '-2.5', exchange: 'Binance' }),
        item({ type: 'claim', amount: '-10', status: 'completed', exchange: null }),
        item({ type: 'claim', amount: '-11', status: 'failed', exchange: null }),
      ],
      prices,
      now,
    );
    expect(formatUsd(r.earned)).toBe('$14.81');
    expect(formatUsd(r.reversed)).toBe('$2.50');
    expect(formatUsd(r.claimed)).toBe('$10.00'); // the failed claim is not counted
    expect(r.byExchange.map((e) => e.exchange)).toEqual(['Binance', 'OKX']);
  });

  it('buckets by local day, oldest first, and ignores items outside the window', () => {
    const r = buildInsights(
      [item({ amount: '1' }), item({ amount: '2', createdAt: '2026-10-23T09:00:00.000' }), item({ createdAt: '2026-08-01T00:00:00.000' })],
      prices,
      now,
      7,
    );
    expect(r.days).toHaveLength(7);
    expect(r.days[6].day).toBe('2026-10-24');
    expect(formatUsd(r.days[6].earned)).toBe('$1.00');
    expect(formatUsd(r.days[5].earned)).toBe('$2.00');
  });

  it('skips assets without a price instead of guessing', () => {
    const r = buildInsights([item({ asset: 'XYZ', amount: '5' })], prices, now);
    expect(formatUsd(r.earned)).toBe('$0.00');
  });
});

describe('activity paging', () => {
  it('drops items repeated across pages (offset cursor shifts when new items arrive)', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b' });
    const c = item({ id: 'c' });
    expect(mergePages([{ items: [a, b] }, { items: [b, c] }]).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

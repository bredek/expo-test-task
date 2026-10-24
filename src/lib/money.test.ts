import { describe, expect, it } from 'vitest';
import {
  addAmounts,
  checkClaimAmount,
  formatUsd,
  fromUnits,
  parseFixed,
  subtractAmounts,
  sumFixed,
  toUnits,
  usdValue,
} from './money';

describe('parsing', () => {
  it('accepts the API format', () => {
    expect(toUnits('0.5', 6)).toBe(500000n);
    expect(toUnits('12', 2)).toBe(1200n);
    expect(toUnits('0', 8)).toBe(0n);
    expect(toUnits('820.413207', 6)).toBe(820413207n);
  });

  it.each(['.5', '1.', '05', '1e-3', '-1', '1,5', ' 1', '', 'abc', '1.2.3'])('rejects %j', (s) => {
    expect(() => parseFixed(s)).toThrow();
  });

  it('rejects more places than the asset allows, unless they are trailing zeros', () => {
    expect(() => toUnits('0.1234567', 6)).toThrow();
    expect(toUnits('0.1000000', 6)).toBe(100000n);
  });

  it('keeps 18-decimal values exact (floats cannot)', () => {
    const v = '1.000000000000000001';
    expect(fromUnits(toUnits(v, 18), 18)).toBe(v);
    expect(addAmounts('0.1', '0.2', 18)).toBe('0.3');
  });

  it('formats canonically for the API', () => {
    expect(fromUnits(500000n, 6)).toBe('0.5');
    expect(fromUnits(1200n, 2)).toBe('12');
    expect(fromUnits(1n, 8)).toBe('0.00000001');
    expect(fromUnits(0n, 6)).toBe('0');
  });
});

describe('claim validation', () => {
  const rules = { decimals: 18, minAmount: '0.01', fee: '0.0012', available: '1.5' };

  it('accepts a valid amount and computes what the user receives', () => {
    expect(checkClaimAmount('0.5', rules)).toEqual({ ok: true, amount: '0.5', fee: '0.0012', receive: '0.4988' });
  });

  it('accepts exactly min and exactly available (Max)', () => {
    expect(checkClaimAmount('0.01', rules).ok).toBe(true);
    expect(checkClaimAmount('1.5', rules)).toMatchObject({ ok: true, receive: '1.4988' });
  });

  it('rejects below min and above available', () => {
    expect(checkClaimAmount('0.009', rules)).toMatchObject({ ok: false, error: expect.stringContaining('Minimum') });
    expect(checkClaimAmount('1.500000000000000001', rules)).toMatchObject({
      ok: false,
      error: expect.stringContaining('available'),
    });
  });

  it('rejects malformed input and too many places', () => {
    expect(checkClaimAmount('.5', rules).ok).toBe(false);
    expect(checkClaimAmount('05', rules).ok).toBe(false);
    expect(checkClaimAmount('', rules).ok).toBe(false);
    expect(checkClaimAmount('0.123', { ...rules, decimals: 2 })).toMatchObject({
      ok: false,
      error: 'At most 2 decimal places',
    });
  });

  it('normalises friendly input to the canonical string', () => {
    expect(checkClaimAmount(' 0,50 ', rules)).toMatchObject({ ok: true, amount: '0.5' });
  });

  it('rejects an amount that leaves nothing after the fee', () => {
    const r = { decimals: 6, minAmount: '0', fee: '1', available: '10' };
    expect(checkClaimAmount('1', r).ok).toBe(false);
    expect(checkClaimAmount('1.000001', r)).toMatchObject({ ok: true, receive: '0.000001' });
  });
});

describe('USD totals', () => {
  it('multiplies exactly and rounds half up only at display', () => {
    expect(formatUsd(usdValue('820.413207', '1.0002'))).toBe('$820.58');
    expect(formatUsd(usdValue('0.005', '1'))).toBe('$0.01');
    expect(formatUsd(usdValue('0.004999', '1'))).toBe('$0.00');
  });

  it('sums before rounding', () => {
    // Each is $0.004 (rounds to $0.00 alone); together $0.012 -> $0.01.
    const parts = ['0.004', '0.004', '0.004'].map((a) => usdValue(a, '1'));
    expect(formatUsd(sumFixed(parts))).toBe('$0.01');
  });

  it('formats thousands and handles an empty portfolio', () => {
    expect(formatUsd(usdValue('1234567.891', '1'))).toBe('$1,234,567.89');
    expect(formatUsd(sumFixed([]))).toBe('$0.00');
  });
});

describe('balance arithmetic', () => {
  it('subtracts exactly and never shows a negative balance', () => {
    expect(subtractAmounts('1.5', '0.5', 18)).toBe('1');
    expect(subtractAmounts('0.1', '0.2', 18)).toBe('0');
  });
});

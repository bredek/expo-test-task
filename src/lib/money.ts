// Exact amount math. Amounts travel as decimal strings (API, storage) and are
// computed as BigInt counts of an asset's smallest unit (10^-decimals).
// No amount ever goes through a JS number.

const AMOUNT_RE = /^(0|[1-9]\d*)(\.\d+)?$/;

export class AmountError extends Error {}

/** A non-negative decimal value: digits / 10^scale. */
export type Fixed = { units: bigint; scale: number };

/** Parses an API-format decimal string at its own precision. */
export function parseFixed(input: string): Fixed {
  if (!AMOUNT_RE.test(input)) throw new AmountError(`Not a valid amount: "${input}"`);
  const [whole, frac = ''] = input.split('.');
  return { units: BigInt(whole + frac), scale: frac.length };
}

/** Rescales without losing digits; throws if that would need rounding. */
function rescale(value: Fixed, scale: number): bigint {
  if (scale >= value.scale) return value.units * 10n ** BigInt(scale - value.scale);
  const factor = 10n ** BigInt(value.scale - scale);
  if (value.units % factor !== 0n) throw new AmountError(`More than ${scale} decimal places`);
  return value.units / factor;
}

/** Parses an amount into smallest units of an asset with `decimals` places. */
export function toUnits(input: string, decimals: number): bigint {
  return rescale(parseFixed(input), decimals);
}

/** Canonical API string for `units` at `decimals`: no trailing zeros, no trailing dot. */
export function fromUnits(units: bigint, decimals: number): string {
  if (units < 0n) return '-' + fromUnits(-units, decimals);
  const s = units.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

export type ClaimRules = {
  decimals: number;
  minAmount: string;
  fee: string;
  available: string;
};

export type ClaimCheck =
  | { ok: true; amount: string; fee: string; receive: string }
  | { ok: false; error: string };

/**
 * Validates what the user typed against the API rules:
 * format, at most `decimals` places, minAmount <= amount <= available,
 * and something left to receive after the fee.
 * Accepts "," as the decimal separator and surrounding spaces; returns the canonical string to send.
 */
export function checkClaimAmount(raw: string, rules: ClaimRules): ClaimCheck {
  const input = raw.trim().replace(',', '.');
  if (input === '') return { ok: false, error: 'Enter an amount' };
  if (!AMOUNT_RE.test(input)) return { ok: false, error: 'Use digits and one dot, e.g. 0.5' };

  const places = input.split('.')[1]?.replace(/0+$/, '').length ?? 0;
  if (places > rules.decimals) {
    return { ok: false, error: `At most ${rules.decimals} decimal places` };
  }

  const d = rules.decimals;
  const amount = toUnits(input, d);
  const min = toUnits(rules.minAmount, d);
  const fee = toUnits(rules.fee, d);
  const available = toUnits(rules.available, d);

  if (amount > available) return { ok: false, error: `More than your available ${fromUnits(available, d)}` };
  if (amount < min) return { ok: false, error: `Minimum claim is ${fromUnits(min, d)}` };
  if (amount <= fee) return { ok: false, error: `Amount must be more than the fee (${fromUnits(fee, d)})` };

  return { ok: true, amount: fromUnits(amount, d), fee: fromUnits(fee, d), receive: fromUnits(amount - fee, d) };
}

/** Exact USD value of `amount` at `usdPrice`, unrounded. */
export function usdValue(amount: string, usdPrice: string): Fixed {
  const a = parseFixed(amount);
  const p = parseFixed(usdPrice);
  return { units: a.units * p.units, scale: a.scale + p.scale };
}

/** Exact sum; rounding happens only when formatting. */
export function sumFixed(values: Fixed[]): Fixed {
  const scale = Math.max(0, ...values.map((v) => v.scale));
  return { units: values.reduce((acc, v) => acc + rescale(v, scale), 0n), scale };
}

/** Rounds half up to cents and formats as "$1,234.56". */
export function formatUsd(value: Fixed): string {
  let cents: bigint;
  if (value.scale <= 2) {
    cents = value.units * 10n ** BigInt(2 - value.scale);
  } else {
    const factor = 10n ** BigInt(value.scale - 2);
    cents = (value.units + factor / 2n) / factor;
  }
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (cents % 100n).toString().padStart(2, '0');
  return `$${whole}.${frac}`;
}

export function addAmounts(a: string, b: string, decimals: number): string {
  return fromUnits(toUnits(a, decimals) + toUnits(b, decimals), decimals);
}

/** a - b, floored at zero (a balance can't go negative on screen). */
export function subtractAmounts(a: string, b: string, decimals: number): string {
  const r = toUnits(a, decimals) - toUnits(b, decimals);
  return fromUnits(r > 0n ? r : 0n, decimals);
}

export function isZero(amount: string): boolean {
  return parseFixed(amount).units === 0n;
}

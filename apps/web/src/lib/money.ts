// Currency conversions used at the boundary between Drizzle (which returns
// numeric(14,2) as strings like "576622.00") and the domain layer's
// integer-cents math.

/**
 * Convert a dollar string from Drizzle (or a user form) into integer cents.
 * Throws on non-finite values. Rounds to handle 1234.56 → 123456 cleanly
 * even when float multiplication has trailing-precision noise.
 */
export function dollarsStringToCents(s: string): number {
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid money amount: ${s}`);
  }
  return Math.round(n * 100);
}

/** Convert integer cents back to a numeric(14,2)-compatible dollar string. */
export function centsToDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}

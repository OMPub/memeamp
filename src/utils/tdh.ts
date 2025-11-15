export function formatCompactTDH(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  if (amount === 0) return '0';

  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) {
    const mantissa = (abs / 1_000_000).toPrecision(3);
    return `${sign}${mantissa}M`;
  } else if (abs >= 1_000) {
    const mantissa = (abs / 1_000).toPrecision(3);
    return `${sign}${mantissa}K`;
  } else {
    const mantissa = abs.toPrecision(3);
    const trimmed = mantissa.replace(/\.0+$/, '');
    return `${sign}${trimmed}`;
  }
}

export function normalizeTDHToPattern(requested: number, max: number): number {
  if (!Number.isFinite(requested) || !Number.isFinite(max)) return 0;

  let maxInt = Math.max(0, Math.floor(max));
  let reqInt = Math.max(0, Math.round(requested));

  if (maxInt === 0) return 0;
  if (reqInt > maxInt) reqInt = maxInt;

  if (reqInt < 10000 || maxInt < 10000) {
    return reqInt;
  }

  const blockSize = 1000;
  const suffix = 67;
  const base = Math.floor(reqInt / blockSize);

  let down = base * blockSize + suffix;
  if (down > reqInt) {
    down = (base - 1) * blockSize + suffix;
  }
  if (down < 10000 || down > maxInt) {
    down = NaN as any;
  }

  let upBase = base;
  if (!Number.isNaN(down) && down < reqInt) {
    upBase = base + 1;
  }
  let up = upBase * blockSize + suffix;
  if (up < 10000 || up > maxInt) {
    up = NaN as any;
  }

  if (Number.isNaN(down) && Number.isNaN(up)) {
    return reqInt;
  }
  if (Number.isNaN(down)) return up;
  if (Number.isNaN(up)) return down;

  return Math.abs(up - reqInt) < Math.abs(reqInt - down) ? up : down;
}

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd'];

/** Kompakte Zahlendarstellung. `digits` = gewünschte Nachkommastellen des Mantiss. */
export function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  const n = Math.abs(value);

  if (n < 1000) {
    if (n === 0) return '0';
    if (n < 10) return sign + trim(n, Math.min(digits, n < 1 ? 2 : 1));
    return sign + Math.floor(n).toString();
  }

  let scaled = n;
  let tier = 0;
  while (scaled >= 1000 && tier < UNITS.length - 1) {
    scaled /= 1000;
    tier++;
  }

  const precision = Math.max(0, Math.min(digits, scaled < 10 ? 2 : 1));
  return sign + trim(scaled, precision) + UNITS[tier];
}

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.?0+$/, '');
}

export function fmtInt(value: number): string {
  return Math.floor(value).toLocaleString('de-DE');
}

export function fmtPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(/\.0$/, '')}%`;
}

export function fmtSigned(value: number, digits = 1): string {
  const s = fmt(Math.abs(value), digits);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return '0';
}

/** Sekunden als `1h 02m 03s` / `2m 05s` / `12s`. */
export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

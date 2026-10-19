/** Deterministischer 32-Bit-PRNG (mulberry32). Seed lebt im Spielstand. */
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  const value = Math.imul(t ^ (t >>> 15), 1 | t);
  const r = ((value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value >>> 14) >>> 0;
  return [r / 4294967296, (seed + 1) | 0];
}

export function random(state: { rngSeed: number }): [number, number] {
  const [value, seed] = nextRandom(state.rngSeed);
  state.rngSeed = seed;
  return [value, seed];
}

/** Gewichtete Auswahl aus `{ value: gewicht }`-Einträgen. */
export function weightedPick<T extends string>(roll: number, entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let acc = roll * total;
  for (const [value, weight] of entries) {
    acc -= weight;
    if (acc <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

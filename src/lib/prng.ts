// Deterministic pseudo-random number generator (mulberry32).
// Used ONLY for demo-data generation so the dataset is fully reproducible.
// The scoring engine itself never uses randomness.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  /** float in [0,1) */
  float() {
    return this.next();
  }
  /** integer in [min, max] inclusive */
  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  /** float in [min, max) */
  range(min: number, max: number) {
    return this.next() * (max - min) + min;
  }
  /** pick a random element */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** weighted pick: weights parallel to items */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  /** returns true with probability p */
  chance(p: number) {
    return this.next() < p;
  }
}

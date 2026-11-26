// Deterministic seeded random helpers (mulberry32 + smooth value noise).
// Written from scratch for Sky Courier.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// 1D smooth value noise from a seeded hash: stable across runs for one seed.
export function makeNoise1(seed) {
  const hash = (i) => {
    let h = (seed ^ Math.imul(i, 374761393)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise1(x) {
    const i = Math.floor(x);
    const f = x - i;
    return hash(i) * (1 - smooth(f)) + hash(i + 1) * smooth(f);
  };
}

// Fractal sum of two noise octaves, output roughly in [0, 1].
export function fbm1(noise, x) {
  return noise(x) * 0.65 + noise(x * 2.7 + 13.7) * 0.35;
}

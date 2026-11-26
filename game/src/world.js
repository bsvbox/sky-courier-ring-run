// World builder for Sky Courier: a 720-segment canyon course with
// procedural terrain, a river, a town, a runway and 12 ring gates.
// Deterministic per seed; written from scratch for this bounty.
import { CFG, zoneAt } from './config.js';
import { mulberry32, range, fbm1, makeNoise1 } from './random.js';

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const noise = makeNoise1(seed ^ 0x9e3779b9);
  const segments = [];
  let curve = 0;

  for (let i = 0; i < CFG.segments; i++) {
    const zone = zoneAt(i);
    // Gentle wandering curves: long S-bends, never a hairpin.
    const target = Math.sin(i * 0.011 + seed * 0.13) * 1.6 + Math.sin(i * 0.004 + 2.1) * 1.2;
    curve += (target - curve) * 0.02;
    // Terrain height in metres: flat near river/runway, hills elsewhere.
    let height = 0;
    if (zone.name === 'hills') height = 40 + fbm1(noise, i * 0.02) * 170;
    else if (zone.name === 'fields') height = fbm1(noise, i * 0.015) * 55;
    else if (zone.name === 'canyon') height = 25 + fbm1(noise, i * 0.03) * 90;
    else if (zone.name === 'town') height = 8 + fbm1(noise, i * 0.02) * 25;

    const seg = {
      index: i,
      curve,
      y: height,
      zone: zone.name,
      ground: zone.ground,
      alt: zone.alt,
      ring: null,
      sprites: [],
    };
    segments.push(seg);
  }

  // Ring gates: fixed slots with varied lateral offset and altitude.
  CFG.ringZ.forEach((z, k) => {
    const seg = segments[z];
    const ringRng = mulberry32(seed + 100 + k);
    seg.ring = {
      id: k + 1,
      x: range(ringRng, -0.55, 0.55), // lateral, in groundHalf units
      y: 150 + range(ringRng, 0, 260), // altitude above terrain, metres
      radius: CFG.ringRadius,
      state: 'pending', // pending | hit | missed
    };
  });

  // Sprites: trees on fields/hills, houses in town, rocks in the canyon.
  // Sizes are world metres now: landmarks must be big (30-85 m) to read
  // at 1280x720 from hundreds of metres away.
  for (let i = 10; i < CFG.segments; i += 1) {
    const seg = segments[i];
    if (seg.zone === 'fields' || seg.zone === 'hills') {
      if (rng() < 0.24) {
        seg.sprites.push({
          type: 'tree',
          offset: (rng() < 0.5 ? -1 : 1) * range(rng, 0.45, 1.2),
          size: range(rng, 30, 55),
        });
      }
    } else if (seg.zone === 'town') {
      if (rng() < 0.5) {
        seg.sprites.push({
          type: 'house',
          offset: (rng() < 0.5 ? -1 : 1) * range(rng, 0.4, 1.0),
          size: range(rng, 50, 85),
        });
      }
    } else if (seg.zone === 'canyon') {
      if (rng() < 0.18) {
        seg.sprites.push({
          type: 'rock',
          offset: (rng() < 0.5 ? -1 : 1) * range(rng, 0.85, 1.35),
          size: range(rng, 40, 85),
        });
      }
    }
  }
  // Control tower beside the runway threshold: the landing landmark.
  segments[CFG.runwayStart + 4].sprites.push({ type: 'tower', offset: -1.25, size: 60 });
  segments[CFG.runwayStart + 30].sprites.push({ type: 'tower', offset: 1.25, size: 55 });
  // Windsock row along the runway edges.
  for (let i = CFG.runwayStart + 8; i < CFG.segments; i += 24) {
    segments[i].sprites.push({ type: 'sock', offset: -1.05, size: 8 });
    segments[i].sprites.push({ type: 'sock', offset: 1.05, size: 8 });
  }

  // Clouds: fixed positions in the sky, parallax by heading.
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    clouds.push({
      x: rng(),
      y: range(rng, 0.03, 0.2),
      s: range(rng, 0.35, 0.95),
      speed: range(rng, 0.002, 0.008),
    });
  }

  return { segments, clouds, seed };
}

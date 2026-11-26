// Sky Courier — Canyon Ring Run: shared constants.
// All original code, written for the make.fun best-flight-game bounty.
export const CFG = {
  width: 1280,
  height: 720,
  // World geometry (1 unit = 1 metre).
  segLen: 25,
  segments: 720,
  groundHalf: 2600, // half-width of the terrain strip, world units
  cameraDepth: 0.84, // 1 / tan(fov / 2)
  drawDistance: 170, // segments rendered ahead of the camera
  // Flight model.
  maxSpeed: 300, // knots at full throttle, engine level 1
  minSpeed: 40, // knots; below this the plane stalls and sinks
  accel: 55, // knots per second toward throttle target
  climbRate: 95, // m/s of vertical speed at full pitch
  turnRate: 1.15, // lateral units per second at full bank
  maxLateral: 1.55, // lateral position, in groundHalf units
  // Resources.
  fuelStart: 100,
  fuelDrain: 0.42, // units per second at cruise throttle
  fuelRingBonus: 12,
  timeStart: 200, // seconds on the clock
  timeRingBonus: 8,
  // Rings: 12 gates, 4 per leg.
  ringZ: [55, 115, 175, 235, 295, 355, 415, 475, 535, 595, 640, 690],
  ringRadius: 55, // world units; pass tolerance
  ringScore: 100,
  // Runway.
  runwayStart: 660,
  // Upgrades (credits = score).
  upgrades: [
    { id: 'engine', name: 'ENGINE MK-II', desc: '+15% top speed', cost: 150 },
    { id: 'tank', name: 'FUEL TANK XL', desc: '+40 max fuel', cost: 200 },
    { id: 'handling', name: 'AGILE WINGS', desc: '+25% turn rate', cost: 250 },
  ],
  // Scoring.
  landingBonus: 500,
  timeScore: 5, // points per second left on landing
};

// Zone boundaries along the course (segment indices).
export const ZONES = [
  { from: 0, to: 199, name: 'fields', ground: '#5d8a3c', alt: '#547e36' },
  { from: 200, to: 299, name: 'hills', ground: '#4e7a34', alt: '#466e2f' },
  { from: 300, to: 339, name: 'river', ground: '#3f7fb5', alt: '#3a73a6' },
  { from: 340, to: 499, name: 'fields', ground: '#5d8a3c', alt: '#547e36' },
  { from: 500, to: 579, name: 'town', ground: '#8a8578', alt: '#7e796c' },
  { from: 580, to: 659, name: 'canyon', ground: '#9a6b43', alt: '#8a5f3b' },
  { from: 660, to: 719, name: 'runway', ground: '#5a5d63', alt: '#54575c' },
];

export function zoneAt(index) {
  for (const z of ZONES) if (index >= z.from && index <= z.to) return z;
  return ZONES[0];
}

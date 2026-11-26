// Sky Courier — Canyon Ring Run: game loop, state machine and shot mode.
// Entry point loaded by game/index.html. Written from scratch in this session.
import { CFG } from './config.js';
import { buildWorld } from './world.js';
import { render } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.width;
canvas.height = CFG.height;

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1);
const shot = params.get('shot') || '';

const input = new Input(canvas);
const sound = new Sound();
const world = buildWorld(seed);

const LEG_NAMES = ['CANYON RUN', 'RIVER DASH', 'HOME RUNWAY'];

function freshState() {
  return {
    mode: 'title',
    z: 0,
    x: 0,
    y: 220, // metres above sea level at start
    speed: 0, // knots
    throttle: 0.55,
    pitch: 0,
    bank: 0,
    heading: 0,
    fuel: CFG.fuelStart,
    fuelMax: CFG.fuelStart,
    score: 0,
    timeLeft: CFG.timeStart,
    leg: 1,
    rings: world.segments.filter((s) => s.ring).map((s) => s.ring),
    nextRing: 1,
    upgrades: [],
    flashText: '',
    flashSub: '',
    flashColor: '#ffd23e',
    flashUntil: 0,
    lowFuel: false,
    best: Number(localStorage.getItem('sky-courier-best') || 0),
    endReason: '',
    t: 0,
    maxSpeedNow: CFG.maxSpeed,
    turnRateNow: CFG.turnRate,
    lastRingZ: -1,
  };
}

let state = freshState();

function planeView() {
  return {
    z: state.z,
    x: state.x,
    y: state.y,
    speed: state.speed,
    speedNorm: state.speed / state.maxSpeedNow,
    throttle: state.throttle,
    pitch: state.pitch,
    bank: state.bank,
  };
}

function renderState() {
  return {
    mode: state.mode,
    plane: planeView(),
    heading: state.heading,
    score: state.score,
    fuel: state.fuel,
    fuelMax: state.fuelMax,
    timeLeft: state.timeLeft,
    leg: state.leg,
    rings: state.rings,
    nextRing: state.nextRing,
    upgrades: state.upgrades,
    flashText: state.t < state.flashUntil ? state.flashText : '',
    flashSub: state.t < state.flashUntil ? state.flashSub : '',
    flashColor: state.flashColor,
    lowFuel: state.lowFuel,
    best: state.best,
    endReason: state.endReason,
  };
}

function flash(text, sub, color = '#ffd23e', dur = 2.2) {
  state.flashText = text;
  state.flashSub = sub || '';
  state.flashColor = color;
  state.flashUntil = state.t + dur;
}

function applyUpgrade(id) {
  const u = CFG.upgrades.find((o) => o.id === id);
  if (!u || state.upgrades.includes(id) || state.score < u.cost) return false;
  state.score -= u.cost;
  state.upgrades.push(id);
  if (id === 'engine') state.maxSpeedNow = CFG.maxSpeed * 1.15;
  if (id === 'tank') {
    state.fuelMax = Math.round(CFG.fuelStart * 1.4);
    state.fuel = Math.min(state.fuel + 40, state.fuelMax);
  }
  if (id === 'handling') state.turnRateNow = CFG.turnRate * 1.25;
  sound.buy();
  return true;
}

function endFlight(mode, reason) {
  state.mode = mode;
  state.endReason = reason;
  if (mode === 'landed') {
    state.score += CFG.landingBonus + Math.round(Math.max(0, state.timeLeft)) * CFG.timeScore;
  }
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('sky-courier-best', String(state.best));
  }
  sound.setEngine(0, 0, false);
  if (mode === 'crashed' || mode === 'timeout') sound.crash();
}

function startFlight() {
  const best = state.best;
  const keepUpgrades = state.upgrades;
  state = freshState();
  state.best = best;
  state.upgrades = keepUpgrades;
  state.mode = 'fly';
  state.throttle = 0.55;
  sound.ensure();
  flash('LEG 1 — CANYON RUN', 'Fly through ring 1', '#37e6ff');
}

function update(dt, pressed) {
  state.t += dt;
  if (state.mode === 'title') {
    if (pressed.has('Enter') || input.consumeClick()) startFlight();
    return;
  }
  if (state.mode === 'fly') {
    // Throttle.
    if (input.throttleUp()) state.throttle = Math.min(1, state.throttle + dt * 0.5);
    if (input.throttleDown()) state.throttle = Math.max(0, state.throttle - dt * 0.5);
    // Speed chases throttle target.
    const target = state.throttle * state.maxSpeedNow;
    state.speed += Math.sign(target - state.speed) * Math.min(Math.abs(target - state.speed), CFG.accel * dt);
    // Steering + pitch.
    const steer = input.steer();
    const pitchIn = input.pitch();
    state.bank += (steer - state.bank) * Math.min(1, dt * 4);
    state.x = Math.max(-CFG.maxLateral, Math.min(CFG.maxLateral, state.x + steer * state.turnRateNow * dt * 0.55));
    state.pitch += (pitchIn - state.pitch) * Math.min(1, dt * 4);
    state.y += state.pitch * CFG.climbRate * dt * (0.4 + state.speed / state.maxSpeedNow);
    // Stall: too slow and the plane sinks.
    if (state.speed < CFG.minSpeed) state.y -= (CFG.minSpeed - state.speed) * 0.9 * dt;
    state.y = Math.max(0, Math.min(850, state.y));
    // Advance along the course.
    const mps = state.speed * 0.514444;
    state.z += (mps * dt) / CFG.segLen;
    // Heading follows the road curve + bank.
    const seg = world.segments[Math.min(Math.floor(state.z), world.segments.length - 1)];
    state.heading += (seg.curve * 9 + state.bank * 14) * dt;
    // Fuel + clock.
    state.fuel -= (CFG.fuelDrain * (0.4 + state.throttle)) * dt;
    state.timeLeft -= dt;
    state.lowFuel = state.fuel < 25;
    // Ring crossing.
    const prevZ = state.z - (mps * dt) / CFG.segLen;
    for (const r of state.rings) {
      const rz = CFG.ringZ[r.id - 1];
      if (prevZ < rz && state.z >= rz && r.state === 'pending') {
        const segR = world.segments[rz];
        const dy = Math.abs(state.y - (segR.y + r.y));
        const dx = Math.abs(state.x - r.x);
        if (dy < r.radius * 1.15 && dx < 0.85) {
          r.state = 'hit';
          state.score += CFG.ringScore;
          state.timeLeft += CFG.timeRingBonus;
          state.fuel = Math.min(state.fuelMax, state.fuel + CFG.fuelRingBonus);
          sound.ring();
          flash(`RING ${r.id}  +${CFG.ringScore}`, `+${CFG.timeRingBonus}s  +${CFG.fuelRingBonus} fuel`, '#37d67a');
          state.nextRing = r.id + 1;
          if (r.id === 4 || r.id === 8) {
            state.leg = r.id === 4 ? 2 : 3;
            state.mode = 'upgrade';
            flash('', '', '#fff', 0);
            sound.setEngine(0, 0, false);
            return;
          }
          if (r.id === 12) state.nextRing = 13;
        } else {
          r.state = 'missed';
          flash(`RING ${r.id} MISSED`, 'Line up earlier next time', '#ff5a3c');
          state.nextRing = r.id + 1;
        }
      }
    }
    // Terrain collision.
    const groundY = seg.y;
    if (state.y <= groundY + 12) {
      endFlight('crashed', 'TERRAIN STRIKE');
      return;
    }
    // Runway landing.
    if (state.z >= CFG.runwayStart + 52) {
      if (state.y <= 26 && state.speed < 150) {
        endFlight('landed', '');
      } else if (state.z >= world.segments.length - 2) {
        endFlight('crashed', 'OVERRAN THE RUNWAY');
      }
      return;
    }
    // Fuel / time out.
    if (state.fuel <= 0) {
      state.fuel = 0;
      endFlight('crashed', 'OUT OF FUEL');
      return;
    }
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endFlight('timeout', 'OUT OF TIME');
      return;
    }
    // Pause.
    if (pressed.has('p')) {
      state.mode = 'pause';
      return;
    }
    sound.setEngine(state.throttle, state.speed / state.maxSpeedNow, true);
    return;
  }
  if (state.mode === 'upgrade') {
    const click = input.consumeClick();
    if (click) {
      const px = (CFG.width - 860) / 2;
      const cy = 250;
      CFG.upgrades.forEach((u, i) => {
        const x = (px + 30 + i * 270) / CFG.width;
        const w = 250 / CFG.width;
        if (click.x >= x && click.x <= x + w && click.y >= cy / CFG.height && click.y <= (cy + 170) / CFG.height) {
          applyUpgrade(u.id);
        }
      });
      if (click.y > 460 / CFG.height && click.y < 500 / CFG.height) state.mode = 'fly';
    }
    if (pressed.has('1')) applyUpgrade('engine');
    if (pressed.has('2')) applyUpgrade('tank');
    if (pressed.has('3')) applyUpgrade('handling');
    if (pressed.has('Enter') || pressed.has(' ')) state.mode = 'fly';
    return;
  }
  if (state.mode === 'pause') {
    if (pressed.has('p') || pressed.has('Enter')) state.mode = 'fly';
    if (pressed.has('r')) startFlight();
    return;
  }
  if (state.mode === 'crashed' || state.mode === 'landed' || state.mode === 'timeout') {
    if (pressed.has('r') || pressed.has('Enter')) startFlight();
    return;
  }
}

// --- shot mode: deterministic frozen frames for screenshots -----------------
function applyShot() {
  if (shot === 'start') {
    state.mode = 'title';
    state.t = 12;
  } else if (shot === 'play') {
    state.mode = 'fly';
    const ring5 = world.segments[CFG.ringZ[4]].ring;
    state.z = CFG.ringZ[4] - 12; // 300 m out: ring centred, fully in frame
    state.y = world.segments[CFG.ringZ[4]].y + ring5.y; // at gate height
    // Line the camera up with the gate: mirror the renderer's curve
    // accumulation from the camera segment to the ring segment.
    let accX = 0;
    let accDx = 0;
    for (let n = Math.floor(state.z); n < CFG.ringZ[4]; n++) {
      accX += accDx;
      accDx += world.segments[n].curve;
    }
    state.x = (accX + ring5.x * CFG.groundHalf) / CFG.groundHalf;
    state.speed = 205;
    state.throttle = 0.72;
    state.pitch = 0.1;
    state.bank = -0.25;
    state.heading = 12;
    state.score = 480;
    state.timeLeft = 152;
    state.fuel = 71;
    state.rings.forEach((r) => {
      if (r.id <= 4) r.state = 'hit';
    });
    state.nextRing = 5;
    state.leg = 2;
    state.t = 40;
    flash('RING 5 AHEAD', 'River crossing', '#37e6ff', 999);
  } else if (shot === 'canyon') {
    state.mode = 'fly';
    const ring10 = world.segments[CFG.ringZ[9]].ring;
    state.z = CFG.ringZ[9] - 12; // 300 m out, between the canyon walls
    state.y = world.segments[CFG.ringZ[9]].y + ring10.y; // at gate height
    // Line the camera up with the gate: mirror the renderer's curve
    // accumulation from the camera segment to the ring segment.
    let accX = 0;
    let accDx = 0;
    for (let n = Math.floor(state.z); n < CFG.ringZ[9]; n++) {
      accX += accDx;
      accDx += world.segments[n].curve;
    }
    state.x = (accX + ring10.x * CFG.groundHalf) / CFG.groundHalf;
    state.speed = 248;
    state.throttle = 0.85;
    state.pitch = -0.05;
    state.bank = 0.4;
    state.heading = 348;
    state.score = 940;
    state.timeLeft = 118;
    state.fuel = 58;
    state.rings.forEach((r) => {
      if (r.id <= 9) r.state = 'hit';
    });
    state.nextRing = 10;
    state.leg = 3;
    state.upgrades = ['engine'];
    state.t = 88;
    flash('RING 10 AHEAD', 'Through the canyon', '#37e6ff', 999);
  } else if (shot === 'cruise') {
    state.mode = 'fly';
    state.z = CFG.ringZ[8] + 4; // just past ring 9, town below
    state.x = 0.3;
    state.y = 260;
    state.speed = 248;
    state.throttle = 0.85;
    state.pitch = -0.05;
    state.bank = 0.35;
    state.heading = 348;
    state.score = 940;
    state.timeLeft = 118;
    state.fuel = 58;
    state.rings.forEach((r) => {
      if (r.id <= 8) r.state = 'hit';
      if (r.id === 9) r.state = 'hit';
    });
    state.nextRing = 10;
    state.leg = 3;
    state.upgrades = ['engine'];
    state.t = 88;
  } else if (shot === 'end') {
    state.mode = 'landed';
    state.z = CFG.runwayStart + 52;
    state.x = 0.05;
    state.y = 12;
    state.speed = 60;
    state.throttle = 0.1;
    state.score = 1240 + CFG.landingBonus + 96 * CFG.timeScore;
    state.timeLeft = 96;
    state.fuel = 34;
    state.rings.forEach((r) => {
      r.state = r.id === 7 ? 'missed' : 'hit';
    });
    state.nextRing = 13;
    state.leg = 3;
    state.upgrades = ['engine', 'tank'];
    state.t = 150;
  }
  render(ctx, renderState(), world, state.t);
}

// --- main loop ----------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const pressed = input.consumePressed();
  if (pressed.has('m')) sound.toggleMute();
  update(dt, pressed);
  render(ctx, renderState(), world, state.t);
  requestAnimationFrame(frame);
}

// Debug hook for automated play-testing (read-only state + a warp used by
// the local smoke test to place the plane just before a ring gate).
window.__skyCourier = {
  getState: () => ({
    mode: state.mode,
    z: state.z,
    x: state.x,
    y: state.y,
    speed: state.speed,
    score: state.score,
    fuel: state.fuel,
    timeLeft: state.timeLeft,
    rings: state.rings.map((r) => ({
      id: r.id,
      state: r.state,
      x: r.x,
      yAbs: world.segments[CFG.ringZ[r.id - 1]].y + r.y,
    })),
  }),
  debugWarp(z, x, y) {
    state.z = z;
    state.x = x;
    state.y = y;
    state.speed = 200;
    state.throttle = 0.7;
  },
};

if (shot) {
  applyShot();
} else {
  requestAnimationFrame(frame);
}

// Renderer for Sky Courier: pseudo-3D chase view, plane sprite, lit
// instruments, HUD and menu screens. Canvas 2D only, no assets.
// Written from scratch for the make.fun best-flight-game bounty.
import { CFG } from './config.js';

const W = CFG.width;
const H = CFG.height;
const HORIZON = H * 0.46;

// --- helpers ---------------------------------------------------------------
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
function ft(m) {
  return m * 3.28084;
}
// Darken a #rrggbb colour by factor f (0..1); used for subtle striping.
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}
// Parcel palettes: a stable hash of the segment index picks one colour per
// segment, so fields read as patchwork, towns as blocks, canyons as rock.
const PALETTES = {
  fields: ['#5d8a3c', '#6b9a44', '#4f7d33', '#8a7d3c'],
  hills: ['#4e7a34', '#5a8a3c', '#42682c', '#6b7a35'],
  river: ['#3f7fb5', '#4a8cc4', '#35719f'],
  town: ['#8a8578', '#7e796c', '#948d7c'],
  canyon: ['#9a6b43', '#8a5f3b', '#a87a4e'],
  runway: ['#5a5d63', '#5a5d63'],
};
function groundColor(seg) {
  const pal = PALETTES[seg.zone] || PALETTES.fields;
  const h = (seg.index * 2654435761) >>> 0;
  return pal[h % pal.length];
}

// --- background ------------------------------------------------------------
function drawSky(ctx, heading, t) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON * 1.25);
  g.addColorStop(0, '#16324f');
  g.addColorStop(0.55, '#3f6d9e');
  g.addColorStop(0.85, '#e8956b');
  g.addColorStop(1, '#f7c489');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON * 1.25);

  // Sun, upper right, with warm glow.
  const sx = W * 0.78;
  const sy = H * 0.16;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150);
  glow.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 200, 120, 0.55)');
  glow.addColorStop(1, 'rgba(255, 190, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 160, sy - 160, 320, 320);
  ctx.fillStyle = '#ffedbe';
  ctx.beginPath();
  ctx.arc(sx, sy, 26, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, clouds, heading, t) {
  ctx.save();
  for (const c of clouds) {
    // Slow drift + parallax from heading.
    const px = (((c.x + t * c.speed - heading * 0.00012) % 1) + 1) % 1;
    const cx = px * W;
    const cy = c.y * H;
    const s = c.s * 38;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 1.6, s * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + s * 0.9, cy + s * 0.1, s * 1.05, s * 0.42, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - s * 0.9, cy + s * 0.08, s * 0.85, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ridge(ctx, baseY, amp, color, heading, seed, t) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) {
    const n = Math.sin((x / W) * 6.28 * 2 + seed + heading * 0.004) * 0.5
      + Math.sin((x / W) * 6.28 * 5 + seed * 2.7) * 0.3
      + Math.sin((x / W) * 6.28 * 11 + seed * 5.1) * 0.2;
    const y = baseY - (n * 0.5 + 0.5) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function drawMountains(ctx, heading) {
  ridge(ctx, HORIZON + 26, 120, '#5d6f8e', heading, 1.7);
  ridge(ctx, HORIZON + 34, 70, '#47603f', heading, 4.2);
}

// --- sprites ---------------------------------------------------------------
function drawTree(ctx, x, y, s) {
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5);
  ctx.fillStyle = '#2f6b2a';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.5);
  ctx.lineTo(x - s * 0.55, y - s * 0.45);
  ctx.lineTo(x + s * 0.55, y - s * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a7d33';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.25);
  ctx.lineTo(x - s * 0.42, y - s * 0.5);
  ctx.lineTo(x + s * 0.42, y - s * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawHouse(ctx, x, y, s) {
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(x - s * 0.5, y - s * 0.55, s, s * 0.55);
  ctx.fillStyle = '#a34d2d';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.62, y - s * 0.55);
  ctx.lineTo(x, y - s * 1.05);
  ctx.lineTo(x + s * 0.62, y - s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a2c1c';
  ctx.fillRect(x - s * 0.1, y - s * 0.25, s * 0.2, s * 0.25);
}

function drawRock(ctx, x, y, s) {
  ctx.fillStyle = '#7a5c40';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.6, y);
  ctx.lineTo(x - s * 0.35, y - s * 0.9);
  ctx.lineTo(x + s * 0.2, y - s * 1.15);
  ctx.lineTo(x + s * 0.65, y - s * 0.4);
  ctx.lineTo(x + s * 0.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8f6f4e';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.35, y - s * 0.9);
  ctx.lineTo(x + s * 0.2, y - s * 1.15);
  ctx.lineTo(x + s * 0.05, y - s * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawSock(ctx, x, y, s, t) {
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - s * 1.4);
  ctx.stroke();
  const wave = Math.sin(t * 3 + x * 0.05) * s * 0.12;
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.4);
  ctx.lineTo(x + s * 0.9, y - s * 1.25 + wave);
  ctx.lineTo(x, y - s * 1.05);
  ctx.closePath();
  ctx.fill();
}

function drawSprite(ctx, sp, x, y, s, t) {
  if (s < 2) return;
  if (sp.type === 'tree') drawTree(ctx, x, y, s);
  else if (sp.type === 'house') drawHouse(ctx, x, y, s);
  else if (sp.type === 'rock') drawRock(ctx, x, y, s);
  else if (sp.type === 'sock') drawSock(ctx, x, y, s, t);
  else if (sp.type === 'tower') drawTower(ctx, x, y, s, t);
}

function drawTower(ctx, x, y, s, t) {
  // Control tower: shaft, glass cab, antenna with a blinking beacon.
  ctx.fillStyle = '#c8c4b8';
  ctx.fillRect(x - s * 0.14, y - s * 1.9, s * 0.28, s * 1.9);
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(x - s * 0.42, y - s * 2.3, s * 0.84, s * 0.45);
  ctx.fillStyle = '#7ec8e8';
  ctx.fillRect(x - s * 0.34, y - s * 2.22, s * 0.68, s * 0.28);
  ctx.strokeStyle = '#8a8578';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 2.3);
  ctx.lineTo(x, y - s * 2.75);
  ctx.stroke();
  const pulse = 0.5 + Math.sin(t * 4) * 0.5;
  ctx.fillStyle = `rgba(255, 60, 40, ${pulse})`;
  ctx.beginPath();
  ctx.arc(x, y - s * 2.8, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

// --- plane (chase view, from behind) ---------------------------------------
function drawPlane(ctx, plane, t) {
  const cx = W / 2;
  // Screen height of the plane's true 3D position: 60 m ahead of the camera,
  // 16 m below it. This keeps the plane and the ring gates on the same
  // projection, so flying at a gate's height puts the plane inside the ring.
  const cy = HORIZON + (CFG.cameraDepth / 60) * 16 * (H / 2) * 0.9 - plane.pitch * 26;
  const s = (1 + plane.speedNorm * 0.06) * 1.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.38);
  ctx.scale(s, s);

  // Propeller blur disc at the nose (far end, top of the frame).
  ctx.fillStyle = 'rgba(200, 220, 240, 0.20)';
  ctx.beginPath();
  ctx.ellipse(0, -80, 11, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(60, 70, 80, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -80, 5, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail fin.
  ctx.fillStyle = '#c8442c';
  ctx.beginPath();
  ctx.moveTo(-7, -58);
  ctx.lineTo(0, -96);
  ctx.lineTo(7, -58);
  ctx.closePath();
  ctx.fill();
  // Tail wings.
  ctx.fillStyle = '#d8553a';
  ctx.beginPath();
  ctx.moveTo(-52, -52);
  ctx.lineTo(52, -52);
  ctx.lineTo(44, -40);
  ctx.lineTo(-44, -40);
  ctx.closePath();
  ctx.fill();
  // Main wings, with a dark edge so the white reads against bright sky.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.moveTo(-122, -2);
  ctx.lineTo(122, -2);
  ctx.lineTo(106, 18);
  ctx.lineTo(-106, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 30, 45, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#d8553a';
  ctx.fillRect(-122, -2, 244, 5);
  // Fuselage: shorter and wider than a rocket, nose at the far end.
  const body = ctx.createLinearGradient(-17, 0, 17, 0);
  body.addColorStop(0, '#f2ede0');
  body.addColorStop(0.5, '#ffffff');
  body.addColorStop(1, '#d8d0bc');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-16, -84);
  ctx.quadraticCurveTo(-19, -20, -14, 30);
  ctx.quadraticCurveTo(0, 42, 14, 30);
  ctx.quadraticCurveTo(19, -20, 16, -84);
  ctx.quadraticCurveTo(0, -94, -16, -84);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 30, 45, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Cockpit glass.
  ctx.fillStyle = '#7ec8e8';
  ctx.beginPath();
  ctx.ellipse(0, -58, 10, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-3, -64, 3.5, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Courier stripe + number.
  ctx.fillStyle = '#1f6fb2';
  ctx.fillRect(-15, -28, 30, 7);
  ctx.fillStyle = '#16324f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SK-07', 0, -36);
  // Nav lights: red left, green right, pulsing.
  const pulse = 0.55 + Math.sin(t * 6) * 0.45;
  ctx.fillStyle = `rgba(255, 60, 40, ${pulse})`;
  ctx.beginPath();
  ctx.arc(-120, 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(60, 255, 120, ${pulse})`;
  ctx.beginPath();
  ctx.arc(120, 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Wingtip contrails: fading white trails behind the plane, tilted by bank.
  const tilt = plane.bank * 30;
  for (const side of [-1, 1]) {
    const x0 = cx + side * 118 - tilt;
    const y0 = cy + 12;
    const grad = ctx.createLinearGradient(x0, y0, x0 + tilt * 0.4, y0 + 85);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + tilt * 0.4, y0 + 85);
    ctx.stroke();
  }
}

// --- HUD -------------------------------------------------------------------
function drawHorizon(ctx, plane) {
  const cx = 78;
  const cy = 78;
  const r = 48;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank * 0.5);
  ctx.translate(0, plane.pitch * 22);
  ctx.fillStyle = '#6fb3e8';
  ctx.fillRect(-r - 2, -r - 2, r * 2 + 4, r + 2);
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(-r - 2, 0, r * 2 + 4, r + 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-r - 2, -1.5, r * 2 + 4, 3);
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + 6);
  ctx.stroke();
  // Bezel.
  ctx.strokeStyle = '#e8e2d2';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Altitude readout under the dial.
  ctx.fillStyle = '#0e1a26';
  ctx.fillRect(cx - 52, cy + r + 8, 104, 26);
  ctx.fillStyle = '#7dffb0';
  ctx.font = 'bold 17px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${fmt(ft(plane.y))} FT`, cx, cy + r + 27);
}

function drawCompass(ctx, heading) {
  const cx = W / 2;
  const cy = 34;
  const w = 340;
  ctx.fillStyle = 'rgba(10, 20, 32, 0.55)';
  ctx.fillRect(cx - w / 2 - 10, cy - 20, w + 20, 40);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, cy - 20, w, 40);
  ctx.clip();
  const pxPerDeg = w / 120;
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round(((heading + d) % 360 + 360) % 360);
    const x = cx + d * pxPerDeg;
    const major = deg % 45 === 0;
    const minor = deg % 15 === 0;
    ctx.strokeStyle = major ? '#fff' : '#9fb4c8';
    ctx.lineWidth = major ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x, cy + (major ? 2 : 8));
    ctx.lineTo(x, cy + 14);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[Math.round(deg / 45) % 8], x, cy - 4);
    } else if (minor) {
      ctx.fillStyle = '#cfe0ee';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(String(deg), x, cy - 4);
    }
  }
  ctx.restore();
  // Centre caret.
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 16);
  ctx.lineTo(cx + 7, cy + 16);
  ctx.lineTo(cx, cy + 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HDG ${String(Math.round(((heading % 360) + 360) % 360)).padStart(3, '0')}°`, cx, cy + 42);
}

function drawSpeed(ctx, plane) {
  const cx = W - 84;
  const cy = 82;
  const r = 46;
  const max = CFG.maxSpeed * 1.15;
  ctx.fillStyle = 'rgba(10, 20, 32, 0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.fill();
  // Arc gauge.
  ctx.strokeStyle = '#2c4a63';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();
  const frac = clamp(plane.speed / max, 0, 1);
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, '#37e6ff');
  grad.addColorStop(1, '#ffd23e');
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + frac * Math.PI * 1.5);
  ctx.stroke();
  // Needle.
  const a = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(plane.speed)), cx, cy + 6);
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('KNOTS', cx, cy + 22);
  // Throttle bar under the dial.
  const bx = cx - 44;
  const by = cy + r + 16;
  ctx.fillStyle = '#0e1a26';
  ctx.fillRect(bx, by, 88, 10);
  ctx.fillStyle = '#37e6ff';
  ctx.fillRect(bx + 1, by + 1, 86 * clamp(plane.throttle, 0, 1), 8);
  ctx.fillStyle = '#fff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`THR ${Math.round(plane.throttle * 100)}%`, cx, by + 24);
}

function drawFuel(ctx, fuel, fuelMax) {
  const x = 24;
  const y = H - 66;
  const w = 190;
  ctx.fillStyle = 'rgba(10, 20, 32, 0.55)';
  ctx.fillRect(x - 8, y - 22, w + 16, 56);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', x, y - 6);
  ctx.fillStyle = '#0e1a26';
  ctx.fillRect(x, y, w, 12);
  const frac = clamp(fuel / fuelMax, 0, 1);
  ctx.fillStyle = frac < 0.25 ? '#ff5a3c' : '#7dffb0';
  ctx.fillRect(x + 1, y + 1, (w - 2) * frac, 10);
  ctx.fillStyle = '#cfe0ee';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`${Math.round(fuel)} / ${fuelMax}`, x, y + 28);
}

function drawRings(ctx, rings, nextId) {
  const x0 = W / 2 - 150;
  const y = H - 34;
  ctx.fillStyle = 'rgba(10, 20, 32, 0.55)';
  ctx.fillRect(x0 - 14, y - 18, 328, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RINGS', x0, y - 4);
  rings.forEach((r, i) => {
    const cx = x0 + 52 + i * 21;
    ctx.beginPath();
    ctx.arc(cx, y + 1, 7, 0, Math.PI * 2);
    if (r.state === 'hit') ctx.fillStyle = '#37d67a';
    else if (r.state === 'missed') ctx.fillStyle = '#ff5a3c';
    else ctx.fillStyle = '#31465a';
    ctx.fill();
    ctx.strokeStyle = r.id === nextId ? '#ffd23e' : '#5a7288';
    ctx.lineWidth = r.id === nextId ? 2.5 : 1.5;
    ctx.stroke();
  });
}

function drawScore(ctx, score, timeLeft, leg) {
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10, 20, 32, 0.55)';
  ctx.fillRect(W - 216, 186, 192, 74);
  ctx.fillStyle = '#cfe0ee';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`LEG ${leg} / 3`, W - 36, 204);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(`SCORE ${fmt(score)}`, W - 36, 232);
  ctx.fillStyle = timeLeft < 30 ? '#ff5a3c' : '#fff';
  ctx.font = 'bold 17px "Courier New", monospace';
  ctx.fillText(`TIME ${fmtTime(Math.max(0, timeLeft))}`, W - 36, 254);
}

const LEG_NAMES = ['CANYON RUN', 'RIVER DASH', 'HOME RUNWAY'];

// Mission banner: leg, mission name and ring progress in one glance,
// so the game's progression reads in a single screenshot.
function drawMissionBanner(ctx, leg, nextRing) {
  const label = `LEG ${leg}/3  ·  ${LEG_NAMES[leg - 1]}  ·  RING ${Math.min(nextRing, 12)}/12`;
  ctx.font = 'bold 15px system-ui, sans-serif';
  const w = ctx.measureText(label).width + 28;
  const x = W / 2 - w / 2;
  const y = 96; // below the compass strip and its HDG readout
  ctx.fillStyle = 'rgba(10, 20, 32, 0.65)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 26, 13);
  ctx.fill();
  ctx.strokeStyle = '#37e6ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#7dffb0';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, y + 18);
}

function drawFlash(ctx, text, sub, color) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, H * 0.3);
  ctx.shadowBlur = 0;
  if (sub) {
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(sub, W / 2, H * 0.3 + 34);
  }
  ctx.restore();
}

// --- screens -----------------------------------------------------------------
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 16, 28, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#37e6ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawTitle(ctx, best) {
  ctx.fillStyle = 'rgba(8, 16, 28, 0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 30;
  ctx.fillText('SKY COURIER', W / 2, 168);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#37e6ff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('— CANYON RING RUN —', W / 2, 214);
  ctx.fillStyle = '#fff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Fly 12 glowing rings through canyon, river and town,', W / 2, 268);
  ctx.fillText('then put her down on the runway before the clock runs out.', W / 2, 296);
  const lines = [
    '← → / A D  steer      ↑ ↓ / W S  climb & descend',
    'SHIFT  throttle up    CTRL  throttle down    Mouse steers too',
    'Rings give +100 pts, +8 s and +12 fuel.  Spend score on upgrades after legs 1 and 2.',
    'P pause    M mute    R restart',
  ];
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#cfe0ee';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 352 + i * 28));
  ctx.fillStyle = '#7dffb0';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('PRESS ENTER TO FLY', W / 2, 512);
  if (best > 0) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Best score: ${fmt(best)}`, W / 2, 548);
  }
}

function drawUpgrade(ctx, state) {
  ctx.fillStyle = 'rgba(8, 16, 28, 0.6)';
  ctx.fillRect(0, 0, W, H);
  const pw = 860;
  const px = (W - pw) / 2;
  panel(ctx, px, 120, pw, 400);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`LEG ${state.leg} COMPLETE`, W / 2, 176);
  ctx.fillStyle = '#fff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(`Score ${fmt(state.score)} — spend it on one upgrade, or keep flying.`, W / 2, 210);
  const cw = 250;
  const gap = 20;
  const cy = 250;
  CFG.upgrades.forEach((u, i) => {
    const x = px + 30 + i * (cw + gap);
    const owned = state.upgrades.includes(u.id);
    const afford = state.score >= u.cost;
    ctx.fillStyle = owned ? 'rgba(55, 214, 122, 0.25)' : 'rgba(20, 36, 54, 0.9)';
    ctx.fillRect(x, cy, cw, 170);
    ctx.strokeStyle = owned ? '#37d67a' : afford ? '#37e6ff' : '#5a7288';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, cy, cw, 170);
    ctx.fillStyle = '#37e6ff';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(u.name, x + cw / 2, cy + 40);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(u.desc, x + cw / 2, cy + 74);
    ctx.fillStyle = owned ? '#37d67a' : afford ? '#ffd23e' : '#ff5a3c';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(owned ? 'INSTALLED' : `${u.cost} PTS  [${i + 1}]`, x + cw / 2, cy + 112);
    ctx.fillStyle = '#9fb4c8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('click or press ' + (i + 1), x + cw / 2, cy + 142);
  });
  ctx.fillStyle = '#7dffb0';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('ENTER — keep flying', W / 2, 478);
}

function drawEnd(ctx, state, won) {
  ctx.fillStyle = 'rgba(8, 16, 28, 0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#37d67a' : '#ff5a3c';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.shadowColor = won ? '#37d67a' : '#ff5a3c';
  ctx.shadowBlur = 26;
  ctx.fillText(won ? 'MISSION COMPLETE' : state.endReason || 'MISSION FAILED', W / 2, 190);
  ctx.shadowBlur = 0;
  const hit = state.rings.filter((r) => r.state === 'hit').length;
  const rows = [
    ['Final score', fmt(state.score)],
    ['Rings flown', `${hit} / 12`],
    ['Time left', fmtTime(Math.max(0, state.timeLeft))],
    ['Upgrades', state.upgrades.length ? state.upgrades.join(', ') : 'none'],
  ];
  ctx.font = '21px system-ui, sans-serif';
  rows.forEach((r, i) => {
    ctx.fillStyle = '#cfe0ee';
    ctx.fillText(r[0], W / 2 - 160, 262 + i * 36);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(r[1], W / 2 - 40, 262 + i * 36);
    ctx.textAlign = 'center';
  });
  ctx.fillStyle = '#7dffb0';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', W / 2, 566);
}

// --- world projection ---------------------------------------------------------
export function render(ctx, state, world, t) {
  const { plane, mode } = state;
  const segs = world.segments;
  const camZ = plane.z * CFG.segLen - 60;
  const camY = plane.y + 16;
  const camX = plane.x * CFG.groundHalf;
  const base = Math.floor(plane.z);
  const heading = state.heading;

  drawSky(ctx, heading, t);
  drawClouds(ctx, world.clouds, heading, t);
  drawMountains(ctx, heading);

  // Project segments far-to-near.
  let x = 0;
  let dx = 0;
  const projected = [];
  const start = Math.max(0, base);
  const end = Math.min(segs.length - 1, base + CFG.drawDistance);
  for (let n = start; n <= end; n++) {
    const seg = segs[n];
    const z1 = n * CFG.segLen - camZ;
    const z2 = (n + 1) * CFG.segLen - camZ;
    const s1 = z1 > 1 ? CFG.cameraDepth / z1 : 0;
    const s2 = z2 > 1 ? CFG.cameraDepth / z2 : 0;
    const y1 = HORIZON - s1 * (seg.y - camY) * (H / 2) * 0.9;
    const y2 = HORIZON - s2 * (segs[Math.min(n + 1, segs.length - 1)].y - camY) * (H / 2) * 0.9;
    const x1 = W / 2 + s1 * (x - camX) * (W / 2);
    const x2 = W / 2 + s2 * (x + dx - camX) * (W / 2);
    const w1 = s1 * CFG.groundHalf * (W / 2);
    const w2 = s2 * CFG.groundHalf * (W / 2);
    projected.push({ n, seg, x1, y1, w1, x2, y2, w2, s1, x });
    x += dx;
    dx += seg.curve;
  }
  // Draw far to near.
  for (let i = projected.length - 1; i >= 0; i--) {
    const p = projected[i];
    if (p.s1 <= 0) continue;
    const seg = p.seg;
    // Ground strip: parcel colour per segment (patchwork fields, town blocks,
    // canyon rock) with a subtle alternating shade so bands never read flat.
    ctx.fillStyle = p.n % 2 === 0 ? groundColor(seg) : shade(groundColor(seg), 0.93);
    ctx.beginPath();
    ctx.moveTo(p.x1 - p.w1, p.y1);
    ctx.lineTo(p.x1 + p.w1, p.y1);
    ctx.lineTo(p.x2 + p.w2, p.y2);
    ctx.lineTo(p.x2 - p.w2, p.y2);
    ctx.closePath();
    ctx.fill();
    // Runway markings.
    if (seg.zone === 'runway') {
      ctx.fillStyle = '#e8e8e8';
      const cx1 = p.x1;
      const cx2 = p.x2;
      const rw1 = p.w1 * 0.10;
      const rw2 = p.w2 * 0.10;
      if (p.n % 4 < 2) {
        ctx.beginPath();
        ctx.moveTo(cx1 - rw1, p.y1);
        ctx.lineTo(cx1 + rw1, p.y1);
        ctx.lineTo(cx2 + rw2, p.y2);
        ctx.lineTo(cx2 - rw2, p.y2);
        ctx.closePath();
        ctx.fill();
      }
      // Edge lines.
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(p.x1 - p.w1 * 0.86, p.y1 - 1, p.w1 * 0.03, 2);
      ctx.fillRect(p.x1 + p.w1 * 0.83, p.y1 - 1, p.w1 * 0.03, 2);
    }
    // Town streets: a dark road down the centre of the block.
    if (seg.zone === 'town') {
      ctx.fillStyle = '#5d5a52';
      ctx.beginPath();
      ctx.moveTo(p.x1 - p.w1 * 0.06, p.y1);
      ctx.lineTo(p.x1 + p.w1 * 0.06, p.y1);
      ctx.lineTo(p.x2 + p.w2 * 0.06, p.y2);
      ctx.lineTo(p.x2 - p.w2 * 0.06, p.y2);
      ctx.closePath();
      ctx.fill();
    }
    // River banks: sandy edges on the water.
    if (seg.zone === 'river') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(p.x1 - p.w1, p.y1 - 1, p.w1 * 2, 2);
      ctx.fillStyle = '#c9b078';
      ctx.beginPath();
      ctx.moveTo(p.x1 - p.w1, p.y1);
      ctx.lineTo(p.x1 - p.w1 * 0.92, p.y1);
      ctx.lineTo(p.x2 - p.w2 * 0.92, p.y2);
      ctx.lineTo(p.x2 - p.w2, p.y2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x1 + p.w1 * 0.92, p.y1);
      ctx.lineTo(p.x1 + p.w1, p.y1);
      ctx.lineTo(p.x2 + p.w2, p.y2);
      ctx.lineTo(p.x2 + p.w2 * 0.92, p.y2);
      ctx.closePath();
      ctx.fill();
    }
    // Canyon walls: dark rock rising on both edges of the gorge.
    if (seg.zone === 'canyon') {
      ctx.fillStyle = '#6e4526';
      ctx.beginPath();
      ctx.moveTo(p.x1 - p.w1, p.y1);
      ctx.lineTo(p.x1 - p.w1 * 0.55, p.y1);
      ctx.lineTo(p.x2 - p.w2 * 0.55, p.y2);
      ctx.lineTo(p.x2 - p.w2, p.y2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x1 + p.w1 * 0.55, p.y1);
      ctx.lineTo(p.x1 + p.w1, p.y1);
      ctx.lineTo(p.x2 + p.w2, p.y2);
      ctx.lineTo(p.x2 + p.w2 * 0.55, p.y2);
      ctx.closePath();
      ctx.fill();
      // Wall-top highlight.
      ctx.fillStyle = 'rgba(255, 220, 160, 0.25)';
      ctx.fillRect(p.x1 - p.w1 * 0.62, p.y1 - 1, p.w1 * 0.07, 2);
      ctx.fillRect(p.x1 + p.w1 * 0.55, p.y1 - 1, p.w1 * 0.07, 2);
    }
    // Sprites: world X = road centre at this segment + lateral offset.
    // Screen size uses the same projection as the terrain: size is metres.
    for (const sp of seg.sprites) {
      const sx = W / 2 + p.s1 * (p.x + sp.offset * CFG.groundHalf - camX) * (W / 2);
      const sy = p.y1;
      const ss = p.s1 * sp.size * (H / 2) * 0.9;
      drawSprite(ctx, sp, sx, sy, Math.max(1, ss), t);
    }
    // Ring gate.
    if (seg.ring) {
      const r = seg.ring;
      const rx = W / 2 + p.s1 * (p.x + r.x * CFG.groundHalf - camX) * (W / 2);
      const ry = p.y1 - p.s1 * r.y * (H / 2) * 0.9;
      const rr = Math.max(2, p.s1 * r.radius * (W / 2));
      const col = r.state === 'hit' ? '#37d67a' : r.state === 'missed' ? '#ff5a3c' : '#37e6ff';
      const pulse = r.state === 'pending' ? 0.75 + Math.sin(t * 4 + r.id) * 0.25 : 1;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2, rr * 0.09);
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = col;
      ctx.font = `bold ${Math.max(11, rr * 0.28)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(r.id), rx, ry + Math.max(4, rr * 0.1));
      ctx.restore();
      // Guide ribbon from ring down to the ground.
      ctx.save();
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, ry + rr);
      ctx.lineTo(rx, p.y1);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Ground shadow under the plane: a depth cue that shrinks as we climb.
  // It sits at the plane's own ground point (screen centre, nearest ground).
  if (mode !== 'title' && projected.length > 0) {
    const near = projected[0];
    const altFrac = clamp(plane.y / 700, 0, 1);
    const sw = 150 * (1 - altFrac * 0.75);
    const sh = 14 * (1 - altFrac * 0.7);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * (1 - altFrac)})`;
    ctx.beginPath();
    ctx.ellipse(W / 2, near.y1 - 2, sw, sh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Plane + HUD only while flying (and on end screens, frozen behind overlay).
  if (mode !== 'title') {
    drawPlane(ctx, plane, t);
  }
  if (mode === 'fly' || mode === 'upgrade' || mode === 'pause') {
    drawHorizon(ctx, plane);
    drawCompass(ctx, heading);
    drawMissionBanner(ctx, state.leg, state.nextRing);
    drawSpeed(ctx, plane);
    drawFuel(ctx, state.fuel, state.fuelMax);
    drawRings(ctx, state.rings, state.nextRing);
    drawScore(ctx, state.score, state.timeLeft, state.leg);
    drawFlash(ctx, state.flashText, state.flashSub, state.flashColor);
    if (state.lowFuel) {
      ctx.fillStyle = '#ff5a3c';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOW FUEL — FLY THROUGH A RING', W / 2, H - 84);
    }
  }
  if (mode === 'title') drawTitle(ctx, state.best);
  if (mode === 'upgrade') drawUpgrade(ctx, state);
  if (mode === 'pause') {
    ctx.fillStyle = 'rgba(8,16,28,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('P to resume    R to restart', W / 2, H / 2 + 30);
  }
  if (mode === 'crashed' || mode === 'landed' || mode === 'timeout') {
    drawEnd(ctx, state, mode === 'landed');
  }
}

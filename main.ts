// Sky Courier — Canyon Ring Run (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request). This program hands it in: it copies game/ and
// screenshots/ from beside this file into the output directory and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The output directory itself is never removed (the grader mounts it);
// only its previous contents are cleared, one entry at a time.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight validation: refuse to hand in a broken entry instead of
// letting the grader reject it. These mirror the scorer's own caps.
function fail(msg) {
  throw new Error(`Sky Courier hand-in refused: ${msg}`);
}
const gameDir = join(here, 'game');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
const shots = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
if (shots.length < 3 || shots.length > 4) fail(`need 3 or 4 screenshots, found ${shots.length}`);
for (const f of shots) {
  const size = statSync(join(shotsDir, f)).size;
  if (size > 262144) fail(`screenshot ${f} is ${size} bytes, over the 256 KiB cap`);
}
let gameFiles = 0;
const textExts = new Set(['.html', '.js', '.mjs', '.css', '.json', '.txt', '.md']);
(function count(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) count(join(dir, e.name));
    else {
      if (++gameFiles > 993) fail('game/ holds more than 993 files');
      // The game must run offline: no file it ships may fetch the network.
      if (textExts.has(extname(e.name).toLowerCase())) {
        const text = readFileSync(join(dir, e.name), 'utf8');
        const hit = text.match(/https?:\/\/[^\s"'`]+/);
        if (hit) fail(`${e.name} references an external URL (${hit[0]}); the game must load no network`);
      }
    }
  }
})(gameDir);

// Clear previous contents of the output directory, never the directory itself.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) {
  rmSync(join(out, entry), { recursive: true, force: true });
}

cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Sky Courier handed in to ${out}`);

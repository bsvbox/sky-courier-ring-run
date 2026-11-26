# sky-courier-ring-run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/bsvbox/sky-courier-ring-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/bsvbox/sky-courier-ring-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Sky Courier — Canyon Ring Run: a complete flight game in a desktop browser. Fly the courier plane SK-07 through 12 glowing ring gates over procedural canyon, river and town terrain, then put her down on the runway before the clock runs out. Three legs, three upgrade choices, live instruments (artificial horizon, compass, speed gauge, fuel), fuel and time pressure, and a deterministic seeded world.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Or open `game/index.html` directly as a static file. No build step, no network requests, no libraries.

## Controls

- Arrow Left/Right or A/D: steer and bank
- Arrow Up/Down or W/S: climb and descend
- Shift: throttle up, Ctrl: throttle down (mouse steers too)
- P: pause, M: mute, R: restart, Enter: start / continue
- After legs 1 and 2: buy an upgrade with keys 1-3 or click, Enter to keep flying

## How it works

`main.ts` (Node 22) copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with the vendored make.fun library. The game itself is plain Canvas 2D: a pseudo-3D segment renderer projects a seeded 720-segment course (fields, hills, river, town, canyon, runway) with a chase-view prop plane, ring gates, and a full HUD. Sounds are synthesised with WebAudio; nothing is downloaded.

Screenshots are real renders of the game's own code, taken with `?shot=start|play|cruise|end&seed=1`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=4eqvbahr&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

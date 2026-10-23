# Map rebuild: progress and final report

This file tracks the map, office, collision and immersion overhaul spec (the "100K codex" document). It records
what shipped, the proof for each part, and what didn't ship. Nothing here is marked done without a test or a
capture from the real built game behind it.

Companion documents:

- `docs/MAP_INVENTORY.md`: room-by-room visual-to-collider inventory, generated from the live level data
  (`npm run map:inventory`).
- `docs/reference/MAP_REFERENCE_MATRIX.md`: the eleven 2014 cameras and the office mapped onto this building,
  with confidence and close/interpreted/original labels.
- `docs/screenshots/map/`: office hero views and close-ups, overlay frames, the seated office, every room by day
  (`rooms/`) and unpowered (`rooms-night/`), and before/after/night contact sheets of the canonical rooms
  (`compare/`).

## Baseline (commit `008ad87`, before any of this work)

- Typecheck and lint were clean. Unit tests: 94 passed and 14 skipped, and the two server suites failed only
  because no Postgres was running; with Postgres the suite passed.
- `e2e/freeRoam.spec.ts` was already failing at the main-breaker step (see P0 below).
- Free-roam office: one wooden block for a desk and a two-box chair, nothing else. The halls were purple
  confetti, and most lit rooms washed out to white.

## What shipped, by phase

### P0: baseline and the broken e2e

The free-roam e2e was written before the breaker puzzle existed. It threw the master lever with every breaker
off, so the load sat below the band, and then tried to light the Dining Hall, whose fuse is always blown on
Night 1. The test now solves the night: it picks a breaker set inside the band that includes a zone with a good
fuse, then lights that zone. It passes with four browsers.

### P2/P3: collision, doors and routes

- **Doors collide by their animated shape** (`doorBoxes`, `doorLeaves` in `shared/src/sim/fr/collision.ts`).
  Shutters keep their footprint with a rising underside, so you can crawl under a half-open shutter but never
  walk under one at 75%. Hinged doors become a chain of boxes along the swung leaf. The renderer poses door
  meshes with the same `doorLeaves`. The old rule switched the collider off at 70% open.
- **Doors stop against people**: a hinged door halts mid-swing rather than shoving a guard into a wall, and
  resumes once clear.
- **No vaulting through walls**: the vault path is swept above the obstacle top.
- **Recovery**: a body that ends up below the world or inside geometry returns to its last good standing spot.
  Before, it was dropped at y 0, which is wrong in the basement.
- **Layout bugs the new tests caught and fixed**: basement doors swung into and nearly sealed the 3 m hall; the
  lounge vending machine and the kitchen ovens sat in double doors' sweeps; nine wall controls were buried in
  0.35 m exterior walls (now snapped onto the face at build time); the Pirate Cove switch was only reachable by
  jumping onto the deck; the Camera Server Room fuse spawned at world y 2.05, inside the ground floor; the
  supply-closet fuses and batteries floated with no shelf under them.

### P4–P6: canonical rooms, office, extensions and basement

- **`OFFICE_KIT`** (`shared/src/world/officeKit.ts`): a single catalogue drives both the free-roam office and
  the seated classic office's desk set. It holds the desk with an open footwell (the crawl-under hiding spot is
  physically real), three CRTs, the caged fan that coasts down with the power, the phone, cups, papers, the group
  poster on the honk hotspot, drawings, live door/light panels, shutter frames, cables, the ceiling grid and a
  single warm bulb. New office wall (checker band, red trim, grey block) and floor textures.
- **`ROOM_KITS`** (`shared/src/world/roomKits.ts`): set dressing for every other room, with a collision policy
  on each part. Canonical rooms get posters, drawings and cable runs in the halls and corners, bunting and
  posters in the dining hall, stars, banner, truss and wedges on the stage, and the "out of order" sign at the
  cove. The supply closet gets stocked shelves, a cleaning cabinet (the hiding spot) and a mop bucket. Backstage
  gets the shelf of spare heads, the endoskeleton and a pegboard. The kitchen gets a hood, fridge and pots, and
  the restrooms get toilets, sinks, mirrors and signage. Extensions and the basement get noticeboards, a punch
  clock, coats, lockers, a keypad, bunting, signs, crates, barrels, pipes and puddles.
- Labelled blocks get modelled stand-ins inside their colliders: sheeted animatronics, the ball pit and its
  balls, the boiler, generator, server racks, pipes and shoe cubbies.
- The halls, corners and dining hall use the 2014 wall look (a 6 m variant for tall rooms, so the band appears
  once). Stalls are painted steel partitions.

### P7: lighting and culling

- Real lights go to the room you're in first, then linked rooms, never to culled ones. Pure distance had lit
  rooms through their walls from the neighbour's lamp.
- Light intensities lowered so lit rooms stop washing out (fluoro 34 to 15, pendant 80 to 36, and so on).
- Flicker uses a seeded hash, never `Math.random`; photosensitivity mode holds fixtures steady.
- Culling walks the opening graph three openings deep and stops at closed doors, keeping the room just behind a
  closed door so the door never vanishes. It re-culls when doors change state.
- Static props and kits are baked per room into one mesh per material.

### P8/P9: interactions and multiplayer

- The server checks reach for items, switches, breakers, doors and pickups: walls, doors and glass may not
  cross the line, and other furniture is allowed only within the last 0.45 m. Furniture that holds the target
  doesn't count. The client prompt calls the same function, so what highlights is what the server accepts.
- `levelChecksum()` goes out in `fr:start`; a client whose bundle differs reloads instead of predicting against
  walls the server no longer has.
- Reconciliation snaps instead of smoothing when anything solid lies between the predicted and corrected
  position.
- F9 collider overlay (localhost or test-hook builds only): live collider shapes, the body cylinder, the server
  position and the interaction ray.

## Tests and verification

- `npm run typecheck`, `npx eslint .`: clean.
- `vitest run` with Postgres: **145 passed** across 12 files (including the net shaper suite). New suites: `shared/test/collision.test.ts`
  (27) and `shared/test/roomKits.test.ts` (7), plus a layout-checksum assertion in the four-client server test.
  Highlights:
  - sprint square into more than 300 internal wall spans from both sides;
  - room-link consistency at 0.25 m (no gaps at junctions);
  - half-second frames;
  - four simulated players weaving for 8 s with no wall overlap and identical replays;
  - every interactable and item spawn reachable;
  - every decal backed by a real wall face, never across an opening;
  - every solid kit part clear of walls, furniture and a 0.7 m doorway apron;
  - all heights inside their room.
- Ten of the first collision tests fail on the baseline code, so they catch real regressions.
- Playwright, run the way CI runs it (`npx playwright test fourPlayers freeRoam netLag mobile`). In the first
  pass the two original specs both passed:
  four-station classic in 1.7 min, four-browser free roam to 6 AM in 2.1 min. Earlier runs of the
  classic test failed intermittently. The cause turned out to be that both specs left their four WebGL browser
  contexts open after finishing, so the next test ran starved of CPU. Both specs now close their contexts in
  `afterEach`. `mapShots` (hero views, room tours by day and unpowered, seated office) passes and produced every
  image under `docs/screenshots/map/`.

## Performance (measured, software rendering)

This container has no GPU, so every number below comes from SwiftShader, Chromium's CPU rasterizer. Frame
rates here say nothing about a real graphics card. They are useful only for comparing builds.

| Metric (38 rooms, standing view, high preset) | Value |
| --- | --- |
| Frame rate, min / median / max | 10.7 / 11.3 / 12.7 fps (CPU raster bound) |
| Draw calls per frame (all passes), min / median / max | 50 / 316 / 674 (office) |
| Draw calls before mesh merging, dining / West Hall | 1085 / 922; after: 648 / 601 |
| Peak triangles per frame | 140,945 (Kids' Play Zone) |
| Live geometries / textures after touring everything | 1,926 / 152 |
| Collider boxes in the built level | 526 |

Merging cut draw calls by 35–40% without changing frame rate here, which is what a CPU rasterizer that is
limited by pixel filling should show. A GPU should feel the draw-call cut directly. Per-room numbers are in
`docs/screenshots/map/rooms/perf.json`.

## Intentional differences from the 2014 game

- The office is 6 x 8 m rather than the cramped 2014 room, to fit four co-op players, the rear door and the
  crawl-under desk hiding spot. The desk wall is composed to match the 2014 look from the seat.
- Room sizes, the kitchen interior, the restroom interiors and the cove interior are interpretations; the 2014
  game never shows them. All extension rooms and the basement are original.
- All art is original canvas and geometry code. No 2014 asset is stored or copied.

## Follow-up pass: diagonal props, bad networks, missing objects, phones

Oriented colliders. A collider can now carry `rot` (centre, half extents, cosine and sine, rounded to 1e-9 so
browser and server agree bit for bit). The broad phase still uses the axis-aligned bounds; circle push-out, ray
casts, ground probes and vault checks work in the box's own frame. Quarter turns stay plain boxes. Three props
now sit at real angles: a lounge sofa at 25 degrees, a dock pallet at -18 and a backstage road case at 35, and the
restroom stall doors hang open at 65 degrees. A test drives a body into each face of a rotated box from nine
directions and checks it stops flush (within 1 cm) and that rays hit the true outline, not the bounds.

Lag and packet loss. A test-only server shaper (`fr:net`, TEST_HOOKS builds only) delays one player's inbound
commands and outbound snapshots with seeded jitter and periodic stalls, keeping per-direction order the way TCP
does. `e2e/netLag.spec.ts` walks a guard into walls and doorframes at 50, 120 and 250 ms one way, then 120 ms with
450 ms stalls every 2.5 s, then drops and reconnects the socket. At every 100 ms sample the predicted body was
outside all solids, the predicted and server positions ended within 0.15 m, and the second browser saw the guard
within 0.6 m of the server. Prediction ran 0.5, 0.5, 1.0 and 0.7 m ahead of the server while walking, which is
the round trip showing up as expected and proves the shaping was live.

Objects the first pass skipped: the clock-in tablet on the staff-room wall, a stage truss whose two cans sweep
while the stage circuit is lit, grease on the kitchen floor and wall, steam over the fryer, and stall doors in
both restrooms.

Phones and tablets. Touch controls switch on for coarse pointers (or `?touch=1`, or Settings > Accessibility >
Touch controls). Free roam gets a floating joystick under the left thumb (push to the rim to run), drag-to-look
anywhere else, and buttons that change with context: walking, seated at the office, on the cameras, hiding. The
classic office gets door, light and camera buttons, drag panning in place of edge panning, and a tappable tablet
bar. Phones start on the low preset, the page no longer pinch-zooms, and the HUD and menus shrink on short
screens. `e2e/mobile.spec.ts` runs both modes on an emulated 915 x 412 landscape phone with real Chrome touch
events: the joystick moved the guard more than 2 m, a drag turned the view, every button did its job, a held
light stayed on only while held, and no screen scrolled sideways.

## Not done (honest list)

- No measurements on a real GPU, a laptop iGPU or a real phone. This container has no GPU and no device, so
  every frame number above is SwiftShader and the phone runs are Chrome device emulation. Real-device feel
  (thumb reach, heat, frame pacing on a mid-range phone) still needs a person holding one.
- Swing doors stop for players, not for animatronics. Agents still open doors through the AI's own door rule
  (doorOpen 0.7), as before.
- Room kits are a strong art pass, not every last object in each spec chapter.
- Seated-office parity covers the desk set only; the seated room keeps its own walls, doors and posters.
- No volumetric dust beyond what already existed, and no new SSAO.
- Touch controls cover free roam and the classic office. The puppeteer (versus) map already works by tap, but it
  has no dedicated phone layout.

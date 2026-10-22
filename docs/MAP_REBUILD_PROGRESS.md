# Map rebuild progress

Tracks the map, office, collision and immersion overhaul spec (the "100K codex" document). That spec is far
larger than one change, so this file says what has actually shipped, with its proof, and what has not. Nothing
is marked done without a test or a real in-game capture behind it.

## Baseline (before any change on this branch)

- `npm run typecheck`, `npm run lint`: clean.
- `vitest run`: 94 passed, 14 skipped, and the two server suites failed only because no Postgres was running.
  With Postgres up (`postgres://postgres:postgres@localhost:5432/fnaf_test`), the whole suite passes.
- Free-roam office: a single 3.4 x 0.9 x 0.78 wooden block for the desk, a two-box chair, no monitors, fan,
  posters, door panels or shutter hardware. The honk hotspot at (24.5, 1.9, 48.15) had nothing drawn behind it.
  Floor was the light-wood office style and the walls were plain dirt-tinted beige.

## Verification run on this branch

- `npm run typecheck`, `npx eslint .`: clean. `vitest run` with Postgres: 125/125.
- `e2e/freeRoam.spec.ts` (four browsers, free roam): fails at line 78 (the main breaker doesn't come on within
  10 s). It fails at the same line on the untouched baseline commit `008ad87`, so it predates this work and still
  needs its own fix.
- `e2e/fourPlayers.spec.ts` (classic four stations, which uses none of the changed code): passed 1 of 4 runs on
  this branch and 1 of 1 on baseline. Every failure was the tablet's camera button not appearing within 12 s,
  with four swiftshader browsers sharing one container. Treat it as load-flaky, not as proof either way.
- Office captures: `MAP_SHOTS=1 npx playwright test mapShots` passes and writes the images below.

## Phase P2/P3: collision and doors (done)

Shipped in `shared/src/sim/fr/collision.ts`, `shared/src/sim/fr/controller.ts`, `shared/src/world/layout.ts`.

**Doors block by their animated shape.** Doors used to be an on/off box that switched off at 70% open, so you
could walk through a shutter whose slab still hung at chest height, or through the open leaf of any swing door.
Now `doorBoxes(def, closed, open)` poses every door from the same openness value the sim already replicates:

- Shutters and the dock roller keep their footprint but their underside rises with the slab
  (`open * (height - SHUTTER_HEADROOM)`), so at 50% you can crawl under the Security shutter but not walk under
  it, and at 75% it still stops a standing 1.75 m guard.
- Swing, exit, glass and double doors become a chain of 0.2 m boxes along each swung leaf. The open leaf is solid,
  the doorway beside it is clear.
- Curtains stay cloth: solid until 70% drawn, then nothing.
- `doorLeaves(def, open)` is the one source for leaf angles. `WorldRender.poseDoor` now uses it too, so the blade
  you see is the blade you hit. The spatial hash registers each hinged door over its whole sweep.
- Everything still reads `CollisionWorld.doorOpen` directly, so the server, client prediction, nav (which opens
  every door while it builds its grid) and snapshot code needed no protocol change. AI and nav still treat a door
  as passable from 0.7, unchanged.

**Real layout bugs the new door shapes exposed:**

- The four 2 m basement doors swung their leaves into the 3 m Basement Hall, nearly sealing it (the reachability
  test caught it). They now swing into their rooms.
- The West Hall double doors swung through the lounge vending machine; the machine moved 1.6 m south.
- The kitchen front doors swung into the ovens, which also stood squarely in front of the way in. The ovens now sit
  south of the doors (z 48.95..51.85).

**Vaulting can no longer carry you through a wall.** `tryVault` used to search up to 2.4 m for a landing spot
and skip anything blocked on the way, so a low table against a wall let you vault into the next room. The path is
now swept above the obstacle top and any taller blocker ends the vault.

**Tests** (`shared/test/collision.test.ts`, 17 tests; 10 of them fail on the old code):
security shutter blocks both ways; half shutter blocks standing but not crawling; 75% shutter still blocks;
open leaf solid but doorway clear; 40% door blocks; no open leaf overlaps a prop, interactable or other door;
direct `doorOpen` writes (fill/set) re-pose the colliders; no vaulting through a wall; quarter-turn prop rotations
only; spawns start clear; office kit checks below.

## Phase P5: Security Office hero pass (first pass done)

**Shared catalogue.** `shared/src/world/officeKit.ts` (`OFFICE_KIT`) lists every office part with a stable id,
world transform, bounds, a collision policy (`solid`, `surface`, `flat`, `overhead`) and its colliders. The
level build adds the solid boxes and the client builds meshes from the same list
(`client/src/render/world/officeKit.ts`), so render and collision cannot drift apart.

| Part | Policy | Collision |
| --- | --- | --- |
| Desk (`office.desk`) | solid | Top slab 0.72..0.78, two drawer pedestals, modesty panel. The footwell stays open: a crawling guard fits under, a standing one can't stand up there. That is the existing desk hiding spot. |
| CRTs x3 | solid | One box each, sitting on the desk top (the third stacks on the first). |
| Chair | solid | Seat/column box plus backrest slab on the south side. Standing up from the seat puts you clear of everything (tested). |
| Bin, filing cabinet | solid | Exact boxes. The cabinet is in the back corner, away from the rear door. |
| Fan, cups, papers | surface/flat | Rest on the desk top (tested at exactly `DESK_TOP`). |
| Poster, 7 drawings, panels, shutter frames, cobwebs | flat | None. Panels and frames sit on wall faces outside the openings, so nothing narrows a doorway the colliders leave open. |
| Cables, ceiling grid, lamp | overhead | None; the lowest point is the lamp at about 2.3 m. |

**What's modeled.** Built-in desk with laminate top (grain, forearm wear, coffee rings, scratches), chipped
edge banding, three drawers per pedestal with steel pulls, a dust shelf and a cable grommet. Three different CRTs
with curved glass, deep bezels, tapered tube housings, vent slots, screws and power LEDs; one shows a green camera
raster, one static, one is off. The feed brightens while the monitor is up and the screens go dark with no
power. Pedestal fan with a heavy base, motor housing, four pitched blades spinning inside a wire cage (front and
back rings, inner rings, 16 spokes, side wires), a slight vibration, a 3 s coast-down when office power dies, and a
fan audio loop that fades with distance and speed. Five-star chair with a split seat. A red-and-white soda cup
with lid and straw, a coffee cup, logbook pages and crumpled memos. The "Celebrate!" group poster (original canvas
art) centred on the honk hotspot, taped, with a curled corner. Seven children's drawings at uneven tilts. Door
control plates on each jamb wall with a red DOOR and white LIGHT button, lamps that follow live door, light and
power state, screws and a wiring sheath to the ceiling. Shutter guide channels, a hazard-striped header housing,
a red warning strip and a rusted sill track for both shutters. Sagging cable runs from a ceiling junction box
down to the CRTs, routed left of the poster so they never cross it. An exposed T-bar ceiling grid with two
sagging, stained tiles, a single warm bulb in a tin shade (replacing the ceiling tube), and corner cobwebs.

**Room surfaces.** New `officeWall` texture: dark skirting, grey lower tiles, a two-row black-and-white checker
band with a thin red trim, and mottled grey block above, with water marks from the ceiling and grime along the
skirting. It's authored at world scale (one repeat = 3 m) so the band sits at the same height on every wall.
New `officeFloor`: 0.3 m speckled grey tiles with dirt in the grout. The Manager's Office shares the `office`
style, so it picked these up too.

**Captures** (`docs/screenshots/map/`, taken from the real built game by `e2e/mapShots.spec.ts`, run with
`MAP_SHOTS=1 npx playwright test mapShots`): west hall through the left shutter, east hall through the right
shutter, rear of the office toward the desk, seated eye, seated looking left, crouched at the desk, fan, CRTs,
poster, left panel and track, shutters closed, power out.

## Intentional differences from the 2014 office

- The free-roam office is 6 x 8 m, deeper than the cramped 2014 room, because four co-op players, the rear keycard
  door and the hiding spot need the floor space. The desk and the north wall are composed to match the 2014 look
  from the seat.
- The desk is a long built-in with pedestals rather than the 2014 game's low table, so the crawl-under hiding spot
  is physically real.
- All art (poster, drawings, CRT rasters) is original canvas drawing. No 2014 asset is copied.
- The poster is the existing `celebrate` design; the seated scene still uses the leader poster for its honk nose.

## Not done yet (honest list)

- Seated office scene (`client/src/render/scenes/office.ts`) does not read `OFFICE_KIT` yet; the two offices still
  share only textures. Driving both from one catalogue is the next office step.
- Rooms other than the office have had no art pass (spec Part II room chapters 01 onward). No reference matrix
  (`docs/reference/MAP_REFERENCE_MATRIX.md`) yet.
- No oriented-box colliders: props stay on quarter turns, and a test now enforces that.
- Swing doors still push a player standing in their sweep rather than refusing to move; shutters already refuse
  to close on a player.
- No world-layout checksum in the join handshake yet. Client and server load the same shared bundle, but a stale
  cached client would predict against old door shapes until it reloads.
- No collider debug overlay, no flashlight wall-occlusion work, no light-pool priority changes, no performance
  budget capture.
- Latency and packet-loss tests at 50/120/250 ms have not been run.

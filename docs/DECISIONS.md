# Decisions

One line per call the prompt didn't make for me, or where I deviated from it and why.

- Railway: there's no project literally named "Open Arcade"; the `arcade` project (which already holds the hub and other games) is the Open Arcade, so `fnaf-replica` lives there.
- Branches: the session was assigned `claude/new-session-v3io1s`; work lands there first and is merged to `main`, which Railway deploys.
- Shared code: `shared/` is consumed as TypeScript source by Vite and Vitest (alias) and bundled with esbuild for the server. No project references, no `.js` import suffixes.
- Bots live in `shared/src/bots.ts` rather than `server/src/game/bots.ts` so the balance script, unit tests and the server all use the same honest bot (it only reads `viewFor()` and its own events).
- Passive power drain: the prompt's table (1% per 3 s on Night 5) drains 178% over a night by itself. Both modes scale it (`CLASSIC_PASSIVE_SCALE`, `CO_OP_PASSIVE_SCALE`) and the tuned values are in `docs/BALANCE.md`.
- Netcode: the server sends a full per-player view only when it changed (or once a second), plus that tick's events. A view is ~1 KB of JSON and changes a few times a second, which keeps traffic well under 5 KB/s without a delta codec.
- In-office attack timing: if the guard had the tablet up at any point after the animatronic entered, lowering it triggers the 0.2 s strike; if they never raised it, the 1.5 to 3 s delay applies.
- Freddy at a closed door: 50% chance per opportunity to keep waiting, otherwise he retreats like the others. Pure waiting made him a permanent door-locker.
- Rate limits are in memory (single instance). Outside production the sign-up and guest limits are relaxed so tests and local multi-tab play work.
- One replica only. Lobbies live in server memory; scaling out would need Redis and sticky sessions, which is out of scope.
- Retro 1987 uniform: granted for beating Night 6, or for finding the backstage secret and surviving that night (the prompt lists both sources).
- `archive_unlocks` table added (not in the prompt's schema) to track newspapers, minigames and characters seen for the Archives and the related achievements. `stats.skin_changes` added for "Dressed To Kill".
- Railway build: Nixpacks runs `npm ci` itself in its install phase (dev deps included); running it again in buildCommand collides with the cached node_modules mount (EBUSY), so the build command is just `npm run build`.
- Build tools (esbuild, vite) are regular dependencies: Railway sets NODE_ENV=production during install, which skips devDependencies.
- Camera rooms are separate small scenes (one per node, built on first view and cached) rather than one building-wide scene. Same visual result, far simpler culling, and each room renders at 15 fps into a 640x480 target.
- Post-processing uses Three's own EffectComposer passes (RenderPass, UnrealBloomPass, a custom grain/vignette/aberration/hallucination ShaderPass, SMAAPass on High, OutputPass) instead of the pmndrs `postprocessing` package. Same effects, one fewer dependency.
- Generated textures are cached in memory per session, not in IndexedDB; generating all of them takes well under a second.
- Lights are in physical units. Camera rooms use a single `LUX` multiplier so the authored numbers stay readable, and every security camera carries a weak IR lamp so silhouettes read on the feed (the prompt's "cheap IR camera" look).
- Character heads and arms hang off the endoskeleton's joints but are re-parented to the body, so hiding the endo metal (intact costumes) never hides the head.
- Eye glow is emissive plus bloom rather than a point light per eye: adding and removing lights at runtime recompiles shaders, which would stutter on camera switches.
- Classic and co-op passive drain, co-op power scale and Night 6 Freddy were tuned with the balance script; see BALANCE.md for the before/after and the bot caveats.
- Bots treat "heard footsteps at the door but the light shows nothing" as Freddy and hold the door, the same lesson a human learns.
- Callouts, presets and achievement descriptions carry `{golden}`/`{fox}`/`{leader}` placeholders filled through the roster, so original mode never leaks a tribute name.
- Ghosts get free cameras and pings; the read-only "station view" of a living guard's office isn't built.
- `?perf=low` forces the low preset (half render scale, 30 fps). The four-player Playwright test uses it because four software-rendered WebGL tabs are slow in CI.
- Localhost-only dev aids: `?gallery=<node>` renders one scene, F9 toggles a node-graph overlay of what this client can see.
- First-seen characters, zoomed newspapers and played minigames are recorded through `POST /api/me/archive` (an endpoint beyond the prompt's REST table) to drive the Archives and their achievements.

## Security checklist (Part 12.6)

- Passwords: Argon2id via `@node-rs/argon2` (19 MiB, 2 iterations, parallelism 1). Prebuilt binary installs on Railway; no bcrypt fallback needed.
- Sessions: 32 random bytes, stored as HMAC-SHA256 with `SESSION_SECRET`, `httpOnly`, `Secure` in production, `SameSite=Lax`, 30-day rolling expiry refreshed at most hourly. Logout deletes the row.
- CSRF: state-changing `/api` calls must be `application/json` and carry a same-origin `Origin` (required in production).
- Validation: zod on every REST body and every socket message; three malformed socket messages disconnect.
- Rate limits: login (10/15 min per IP, 5/15 min per username), sign-up (5/hour per IP in production), guest creation, forgot-password, lobby creation (10/10 min per user), chat and callouts (1/s), inputs (20/s per client).
- Forgot-password always answers the same way when SMTP is configured (no user enumeration).
- SQL only through Drizzle's parameterised queries (and two `sql` template fragments with bound parameters).
- No secrets in the repo: `SESSION_SECRET` lives only in Railway variables; `.env` is gitignored.
- The server owns all randomness, timers, AI, power maths and rewards; the client sends intents.
- Headers: Content-Security-Policy (self scripts, Google Fonts styles and fonts, `ws:`/`wss:` connect, `blob:`/`data:` media), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`.
- User text (names, chat) is always set with `textContent`; the client never uses `innerHTML` with user content.

## Free-roam rebuild

- Kept: repo tooling, CI, Railway setup, accounts and sessions, lobbies and the Socket.IO layer, the cosmetics catalogue, procedural character builders, audio synthesis, voice, the CRT shader, achievements, Archives. The classic office and four-station Night Shift stay playable until free-roam replaces them. New code lives in `shared/src/world`, `shared/src/sim/fr` and `client/src/render/world`.
- Free-roam config is `FR` in `shared/src/frConfig.ts` rather than editing `CONFIG`, so the classic sim keeps its tuned numbers. Types that clash with the classic sim are prefixed (`FrDoorDef`, `FrInput`).
- Level layout: rooms are unions of integer 1 m rectangles; walls are derived from where two rooms (or a room and the outside) meet, and openings are intervals on those walls. This catches overlapping rooms and bad door coordinates at build time. The prompt's hand-written coordinates overlapped (for example a 34 m dining hall with halls under it and a play zone between them), so the layout was re-planned keeping the connection graph: front of house north, back of house south, stage east, cove west, office at the south junction of the two halls. Footprint is about 84 x 67 m instead of 96 x 64. West Hall runs along the dining hall's west wall (x 10..14) with the four party rooms on its west side; the cove opens onto its north end for Foxy's sprint lane. `docs/map.svg` is the source of truth.
- Basement: stairs are real step geometry (15 steps of 0.3 m), a two-part room (`stairTop` at ground level, `stairBot` below) so each floor level has its own wall map. The Maintenance Tunnel loop, vents and crawlspace come in FR 10.
- Controller: cylinder vs axis-aligned boxes, substepped to half a radius, step-up as ground detection (anything within 0.35 m is walkable surface, not an obstacle). Vaulting is a scripted 0.55 s arc over a low obstacle to the first free ground within 2.4 m.
- Interaction keys: E interact, F flashlight, C crouch toggle (Ctrl hold), X crawl toggle, Q/R lean, M map. Ping moves to another key when the multiplayer HUD lands.
- Lighting: every fixture is data (circuit, kind, flicker). Only the nearest handful get a real Three.js light (5/8/12 by quality) with fade in and out; emissive fixture meshes carry the rest, and a per-room ambient term stands in for bounce light. Only the flashlight casts shadows for now.
- Zone culling: room groups beyond two door-hops of the camera's room are hidden.
- Dev aids: `window.__fr` (teleport, power, state) only exists with `?debug` on localhost, or when the server runs with `TEST_HOOKS=1` outside production (`/api/config` reports it).

# Progress

## Free-roam rebuild (docs/PROMPT_FREEROAM.md)

The office build below is complete and still playable. The free-roam game is being built on top of it in
the milestones of Part 12 of the free-roam prompt. The old modes stay until their replacements ship.

- [x] FR 1: Skeleton verified (builds, typechecks, 49 tests green with a local Postgres); `three-mesh-bvh`, `recast-navigation`, `socket.io-msgpack-parser` pinned
- [x] FR 2: Railway pipeline verified (project `arcade`, service `fnaf-replica`); see docs/DEPLOY.md for the GitHub App note
- [~] FR 3: Walkable building: level data (39 rooms, ground + basement), generator, `docs/map.svg`, collision, first-person controller (walk, sprint, crouch, crawl, lean, jump, vault, steps, stairs), doors, flashlight, zone lighting and power model, footsteps and ambience, Day Shift and a solo Night Shift preview. Remaining for M3: ladders, more props and posters
- [ ] FR 4: Accounts extension (stats columns, collectibles, photos) and the live 3D title scene
- [~] FR 5: Shared sim + first threat: `FrSim` (players, doors, power, noise, clock, hiding, catch, downed/revive/ghost, solo free get-up), 0.5 m walk grid with A* and doors, AI framework (sight with light/posture/motion/exposure, hearing through walls, PATROL/INVESTIGATE/CHASE/SEARCH/CHECK/SATISFIED, check warning and head start, anti-recatch), Bonnie with relocation, 34 hiding spots with view overlays, jumpscare and downed state, F9 debug overlay; 15 AI tests. Runs locally for solo play; it moves to the server in FR 6
- [~] FR 6: Multiplayer: `freeroam` lobby mode, server-authoritative `FrMatch` (30 Hz sim, capped input queue that also stops speed hacks, per-client 20 Hz snapshots with interest management, acks), client prediction with reconciliation and smoothed corrections, interpolated remote guards with skins, nameplates and flashlight beams, revives (hold E), ghosts (only visible to ghosts, pass through doors), ghost-aware chat, reconnection via `fr:start` resend, paycheck through the existing rewards. Integration test with four sockets; Playwright test with four browsers (spawn together, see each other, breaker and Dining switch sync, 6 AM, paycheck, nights_survived). Remaining: pings, callout wheel, lag-compensated catches, third-person limb animation
- [ ] FR 7: Objectives and the full core night (power grid, breaker puzzle, fuses, music box, cupcakes, remaining animatronics, Nights 1 to 6, Director)
- [ ] FR 8: Proximity voice and walkies
- [ ] FR 9: Skins and economy for free-roam
- [ ] FR 10: Remaining map content (vents, crawlspace, flooded tunnel, hiding spot types, tapes, notes)
- [ ] FR 11: Custom Night, stars, achievements, Archives for free-roam
- [ ] FR 12: Full roster in waves
- [ ] FR 13: Showtime in 3D
- [ ] FR 14: The Office (Mode D)
- [ ] FR 15: Polish, balance, performance, accessibility

---

## Office build (original spec, docs/PROMPT.md)

- [x] Milestone 1: Skeleton (workspaces, TS strict, ESLint flat config, Prettier, Vitest, CI, railway.json, /healthz)
- [x] Milestone 2: Railway pipeline live (`arcade` project, `fnaf-replica` service, Postgres, public domain, deploys from `main`)
- [x] Milestone 3: Database and accounts (Drizzle schema + migrations, Argon2id, hashed sessions, guest + claim, rate limits, zod)
- [x] Milestone 4: Shared simulation, Classic Office headless (pure deterministic `step()`, 28 rule tests, `npm run sim:classic`)
- [x] Milestone 5: Networking and lobbies (Socket.IO, room codes, per-player view filtering, acks, reconnect, graceful shutdown)
- [x] Milestone 6: First playable Classic Office in 3D (renderer, post, office, camera rooms, characters, CRT, audio, jumpscares, calls)
- [x] Milestone 7: Night Shift co-op (four stations and tools, shared power, Puppet, maintenance, hallucinations, ghosts, pings, callouts, chat, scaling, Night 1 to 6, paycheck, four-player Playwright test)
- [x] Milestone 8: Voice radio (WebRTC mesh, Socket.IO signalling, push-to-talk, radio filter chain, ghost rules, mic selection, speaking indicators)
- [x] Milestone 9: Skins and economy (68 cosmetics, Locker Room turntable, live lobby broadcast, daily shop, token rewards, sleeves, decor, tablet themes, death card guard)
- [x] Milestone 10: Custom Night, stars, achievements (32), Archives (gallery with x-ray, newspapers, calls, minigames, soundtrack, leaderboards), easter eggs, three death minigames
- [~] Milestone 11: Full roster: all 70 characters modelled and in the Archives with x-ray; 8 extended rules shipped as sim plugins with tests (see below)
- [x] Milestone 12: Showtime mode (Puppeteer map, cooldown rings, fog of war, AI fallback, Lights Out and Static, rewards, leaderboard)
- [x] Milestone 13: Polish and balance (balance script and tuned config, quality presets with auto benchmark, accessibility toggles)

## Extended roster

Shipped with a Custom Night rule, a model and a test: Endo-01, Toy Freddy, Tangle (Mangle), Balloon Kid,
Shadow Bear, Spring Rabbit (Springtrap), Phantom Fox, The Hollow (Nightmare). Night 6 adds The Hollow and
Balloon Kid by default.

Modelled and browsable in the Archives (procedural model, x-ray endo view, description and counter text),
marked "coming soon" because their night rule isn't written yet: Toy Bonnie, Toy Chica, Jay-Jay, the
Withered five, Shadow Bonnie (as a rule; she's in as the Party Room easter egg), Endo-02, Paperpals,
the other Phantoms, the Nightmare crew, Plushtrap, Nightmare BB, Nightmarionne, Circus Baby, Ballora,
Funtime Freddy, Bon-Bon, Funtime Foxy, Minireenas, Bidybabs, Ennard, Electrobab, Yenndo, Lolbit, Molten
Freddy, Scrap Baby, Scraptrap, Lefty, the Rockstars, the Mediocre Melodies, Music Man, El Chip, Helpy,
Old Man Consequences, Dee Dee, XOR, Glitchtrap, Vanny, the Glamrocks, the Daycare Attendant, Burntrap,
The Mimic, STAFF bots and the Into the Pit rabbit.

## Not done or changed

- Ghost "station view" (watching a living guard's office) isn't built; ghosts get free cameras and pings.
- The `look` message is accepted but unused (it only fed station view).
- Characters are built per camera room rather than in one building-wide scene, and texture caching is in
  memory rather than IndexedDB. Both are in DECISIONS.md.
- Character jumpscares share one lunge animation with per-character timing and scream recipes; Foxy's
  runs in from the side, Golden Freddy fakes a crash, the Puppet rises then snaps.

## Map rebuild

See `docs/MAP_REBUILD_PROGRESS.md` (report), `docs/MAP_INVENTORY.md` (generated visual-to-collider inventory) and `docs/reference/MAP_REFERENCE_MATRIX.md` (2014 camera mapping).

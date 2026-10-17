# Progress

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

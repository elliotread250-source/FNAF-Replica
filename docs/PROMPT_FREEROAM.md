# FNAF REPLICA: THE MASTER BUILD PROMPT (FREE-ROAM 3D CO-OP EDITION)

You are Claude Code. You're about to build, test, commit, push and deploy a complete online multiplayer survival horror game called FNAF Replica. It's an unofficial, non-commercial fan tribute to Scott Cawthon's Five Nights at Freddy's series, played in full first-person 3D. Up to four friends join a lobby over the internet, sign into real accounts, pick and change skins, and then physically walk into a haunted family pizzeria after closing. They split up, explore a big multi-room building with a basement and a vent network, restore the power, flip the lights back on zone by zone, wind the music box before something climbs out of its gift box, collect and deliver the cupcakes, fix the fuse boxes, find keycards, hide in lockers and under tables when an animatronic comes round the corner, crawl through vents to escape, revive each other, and try to make it to 6 AM. The animatronics walk the halls too, and they hunt by sight and sound.

You are not building the "sit in one office and click doors" version. That exists in this spec only as a small bonus room inside the building and a bonus mode. The heart of this game is exploration: a real 3D map you can walk, run, crouch and crawl through, with real hiding spots, real vents, real tasks scattered around the map, and real animatronics moving through the same space as you.

This document is very long on purpose. It's over fifty thousand words, because a vague spec produces a vague game and an open map multiplies every vague sentence by every room. Read the whole thing before you write a single file. Then work through the build plan in Part 12 in order. When this prompt gives you an exact number, use it. When it gives you a range or says "tune", pick a sensible value, put it in the central config file, and move on. When something isn't covered, make the call a seasoned indie horror developer would make and write a one-line note about it in `docs/DECISIONS.md`.

Don't stop to ask me questions unless you're truly blocked (for example, a credential is missing and there's no way around it). I want to come back to a deployed, playable game with a live URL.

---

## PART 0: THE MISSION, THE TARGETS, THE RULES

### 0.1 What "done" means

You're done when all of the following are true, and not before.

1. The code lives in the GitHub repository `elliotread250-source/FNAF-Replica` on the `main` branch. That repository already exists and already contains a working, deployed office-style version of the game built from an earlier spec (`docs/PROMPT.md`). This document lives at `docs/PROMPT_FREEROAM.md` and supersedes that earlier spec. Read Part 0.5 before touching any code: you're evolving an existing codebase, not starting from an empty folder.
2. The game is deployed on Railway inside my existing Railway project called **Open Arcade**, as its own service named `fnaf-replica`, wired to auto-deploy from the GitHub repository's `main` branch. This is my standard pipeline: GitHub is the source of truth and Railway deploys from GitHub on every push. Never deploy by uploading a local folder with `railway up` as the permanent setup; that's acceptable only as a one-off smoke test, and the final state must be GitHub-connected.
3. A Railway PostgreSQL database is attached to that service (inside the Open Arcade project) and the game's accounts, skins, stats and unlocks persist across redeploys.
4. The service has a public Railway domain (generate one, something like `fnaf-replica-production.up.railway.app`) and the health check at `/healthz` returns `200`.
5. I can open the URL on a desktop browser, create an account, log in, change my skin, create a lobby, share a four-letter room code with three friends, and all four of us spawn together in the pizzeria's staff entrance. We can each walk around freely in first person, see each other's skinned characters moving and animating, talk over proximity voice, split up, complete the Night 1 objectives (restore power, turn on the lights, wind the music box, deliver the cupcakes), hide from animatronics in lockers and under tables, crawl through vents, get caught, get revived, and reach 6 AM, all in sync.
6. The README explains how to run it locally, how the deployment works, and what each environment variable does.
7. Automated tests pass in CI (GitHub Actions) and locally: unit tests for the simulation (movement, AI, objectives), integration tests for the socket protocol, and a Playwright test that spins up four headless browser clients and plays through a scripted short night by teleporting bots through objectives.

### 0.2 Hard deployment targets

| Item | Value |
|---|---|
| GitHub owner | `elliotread250-source` |
| GitHub repo | `FNAF-Replica` |
| Default branch | `main` |
| Railway project | Open Arcade (already exists; its Railway project name is `arcade`; find it, don't make a new one) |
| Railway service name | `fnaf-replica` |
| Railway database | PostgreSQL, added to the Open Arcade project, referenced by the service as `DATABASE_URL` |
| Runtime | Node.js 20 LTS |
| Health check path | `/healthz` |
| Public port | whatever Railway injects as `PORT` (never hardcode 3000 in production) |

If you have Railway MCP tools available in your session, use them (`list-projects` to find Open Arcade, `create-service`, `connect-service-source` to link the GitHub repo, `set-variables`, `generate-domain`, `list-deployments`, `get-logs`). If you don't, install and use the Railway CLI (`npm i -g @railway/cli`, then `railway login`, `railway link`, and so on). If Railway auth is missing entirely, finish everything else, push to GitHub, and write the exact click-by-click steps for me in `docs/DEPLOY.md` and in your final message. That's the only acceptable reason to stop short of a live URL.

### 0.3 Legal and IP guardrails (read this carefully, it affects every asset you make)

Five Nights at Freddy's, its characters, logos, art, music, sound effects, voice lines and text are owned by Scott Cawthon. Fan games are a long, loved tradition in this community, and Scott has historically supported non-commercial fan projects. That tolerance has limits, so this project follows strict rules.

Mechanics are fair game. Mechanics, systems, rules and genre conventions aren't protected by copyright. Free-roam hide-and-seek, hiding in lockers, crawling vents, restoring power at a breaker, winding a music box, animatronics that only move when you're not looking, a six-hour night: all of that you can replicate faithfully, and you should.

Assets must be 100% original. You will not download, rip, trace or embed a single image, model, texture, animation, sound, song or voice line from any official FNAF game, film, book or merchandise, and you won't pull fan-ripped assets from sites like Spriters Resource, Sketchfab, Models Resource or YouTube either. Every visual is generated by you in code (Three.js geometry, shaders, canvas drawing, SVG). Every sound is synthesised by you at runtime with the Web Audio API, or composed as data (note arrays) in the repo. The only exception to "compose it yourself" is music that's in the public domain, such as Bizet's "Toreador Song" from Carmen (1875) and the nursery tune "Pop Goes the Weasel". You can use those melodies because the compositions are public domain, but you must synthesise them yourself from notes, never sample a recording.

All dialogue, tapes, notes and posters are original writing (Part 7 gives you the text).

Character names: the game ships with a roster file that supports two modes. `ROSTER_MODE=tribute` (the default) uses the classic names, Freddy, Bonnie, Chica, Foxy, Golden Freddy, the Puppet and the rest of the series cast, because this is a tribute and those names are what players expect. `ROSTER_MODE=original` swaps in original names and colourways (Part 6C.3) with a single environment variable change, so the owner can flip to a fully original cast in thirty seconds if they ever receive a takedown request or want to monetise. Every place in the code that shows a character name, venue name or company name must read it from the roster, never hardcode it.

The title screen and footer must carry this disclaimer, verbatim: "FNAF Replica is an unofficial, non-commercial fan game. Five Nights at Freddy's and all related characters are the property of Scott Cawthon. This project is not affiliated with or endorsed by Scott Cawthon or Steel Wool Studios. All art, audio and code in this game are original." Add a `/legal` page with the same text plus a contact email placeholder `TODO_CONTACT_EMAIL` I'll fill in.

No monetisation. No payments, no ads, no paid skins. All cosmetics are earned through play. Don't add Stripe or any payment SDK, even as a stub.

### 0.4 Working style for this build

Commit early and often with clear messages (`feat(world): add basement boiler room`, `feat(ai): Bonnie patrol and chase`, `fix(net): reconcile crouch state`). Push to `main` at the end of every milestone in Part 12 so Railway deploys continuously and I can watch progress. If CI goes red, fix it before starting the next milestone. Keep a running `docs/PROGRESS.md` with a checklist of milestones, ticked as you go.

Write TypeScript everywhere, with `strict: true`. No `any` unless you write a comment explaining why. Format with Prettier, lint with ESLint (flat config). Keep functions small. Keep the simulation (player movement physics, AI, objectives, power, doors) in a shared package that's deterministic and runs headless in Node, so it's testable without a browser.

When you're unsure between two options, pick the simpler one that still feels good to play. Feel beats architecture. A free-roam FNAF game lives or dies on four things: the dread of exploring a dark building, the clarity of the threats' rules, the panic and relief of hiding, and the fairness of getting caught. Every decision you make should serve those four.

### 0.5 Starting from the existing build (read this first)

The repo already has a full office-style FNAF Replica: npm workspaces, strict TypeScript, Fastify, Socket.IO lobbies with room codes and reconnection, Postgres with Drizzle migrations, Argon2id accounts with guest and claim, a deterministic shared simulation for the Classic Office and four-station Night Shift, a Three.js client with a CRT camera shader, procedural characters for about 70 roster entries with x-ray endo views, WebRTC voice, 68 cosmetics with a Locker Room, achievements, Archives, Custom Night, Showtime, a balance script, a four-player Playwright test, CI, and a live Railway deployment at `https://fnaf-replica-production.up.railway.app` in the `arcade` project with the `fnaf-replica` service and a Postgres service. Read `docs/PROGRESS.md`, `docs/DECISIONS.md` and `docs/DEPLOY.md` before you plan.

Your job is to turn it into the free-roam game this document describes, reusing everything that still fits. Keep and build on: the repo tooling, CI, Railway setup and deploy fixes; accounts, sessions, the database (migrate it forward with new Drizzle migrations; never drop user data); lobbies, room codes and the Socket.IO layer (extend the protocol per Part 10.11); the cosmetics catalogue and Locker Room (extend per Part 8.8); achievements, Archives, the minigames, easter eggs and Custom Night screens (adapt them); the procedural character builders and endo/x-ray code (reuse them as the basis for Parts 6B and 6C, upgrading detail, LODs and skeletons for free-roam animation); the audio synthesis code; the voice code (upgrade it to spatial proximity plus walkies per Part 4.15); the CRT shader (reuse it for the Security Office monitors and the Faz-Pad). Rework: the simulation (add the free-roam player controller, the level, collision, navmesh, AI agents and objectives; keep the old Classic Office sim as the core of Mode D, Part 5.12, and retire the four-station Night Shift once the free-roam Night Shift replaces it); the client renderer (from per-camera-room scenes to one building-wide world with zone culling, Part 11); the netcode (from discrete events to prediction, reconciliation and interpolation, Part 10.6). Showtime moves from a top-down map to a 3D animatronic player (Part 6.10).

Keep the live game working while you rebuild. Put the free-roam game behind a "Night Shift (Free Roam)" menu entry from the first free-roam milestone, keep the existing modes playable until their replacements are ready, then remove the old four-station mode and point "Clock In" at free-roam. Note in `docs/DECISIONS.md` what you kept, replaced and removed.

Also note from `docs/DEPLOY.md`: push-to-deploy needs the Railway GitHub App installed on the repo. If deployments still don't trigger on push, say so in your final message so I can install it, and deploy the latest `main` from Railway's tools in the meantime.

### 0.6 Scope honesty

This is a very big game. You'll build it in milestones (Part 12) so there's always a playable, deployed version. The first deployed playable milestone is a single-player walkable pizzeria with lights, doors and one animatronic. Then multiplayer. Then objectives. Then more characters. Then skins and accounts polish. Then the full roster in waves. If a session ends before everything's done, the repo must still be in a working, deployed state with `docs/PROGRESS.md` saying exactly where you stopped and what's next, so the next session can continue with "read PROMPT.md and docs/PROGRESS.md, then continue".


---

## PART 1: THE FIVE NIGHTS AT FREDDY'S RESEARCH BIBLE

You need to understand this franchise as well as a long-time fan does, because the game you build should feel right to people who've played every entry. This part is your reference. It covers the release history, the core mechanics of each major game, the lore, the tone and the design principles that made the series work. Later parts turn it into a spec.

### 1.1 The origin story

Scott Cawthon was an independent developer from Texas who'd spent years making Christian-themed animated films and family-friendly games. In 2013 he released "Chipper & Sons Lumber Co.", a building game, and players savaged it because the beaver characters looked unintentionally creepy, like animatronics. Rather than quit, Scott leaned into it. He asked himself what would happen if he made something scary on purpose. The answer, built in roughly six months, was Five Nights at Freddy's.

He released it on Desura on 8 August 2014 and on Steam on 18 August 2014. It cost about five dollars. Within weeks, YouTube let's-players like Markiplier and others turned its jumpscares into viral reaction videos, and the game became one of the defining indie hits of the decade. Scott then shipped sequels at a pace almost nobody in the industry has matched: FNAF 2 arrived in November 2014, FNAF 3 in March 2015, FNAF 4 in July 2015. Four mainline games in about a year.

The lesson for us: the original game is tiny. One room. A handful of camera stills. Four enemies. Two buttons per door. It became a phenomenon because those few pieces were tuned with real care and wrapped in mystery. We'll keep our core equally tight.

### 1.2 Release timeline (main games and major spin-offs)

Use this table as context for easter eggs, menu flavour and the "Archives" screen described in Part 9. Dates are original PC releases.

| Year | Title | Developer | What it added |
|---|---|---|---|
| 2014 (Aug) | Five Nights at Freddy's | Scott Cawthon | The template: static office, doors, lights, cameras, limited power, four roaming animatronics, phone calls, Nights 1 to 5 plus Night 6 and Custom Night (the 4/20 mode). |
| 2014 (Nov) | Five Nights at Freddy's 2 | Scott Cawthon | No doors. A Freddy head mask to fool most animatronics, a flashlight with battery, two air vents, a music box you must wind remotely through Cam 11 or the Puppet comes for you. Eleven enemies. Atari-style death minigames hinting at lore. |
| 2015 (Mar) | Five Nights at Freddy's 3 | Scott Cawthon | Thirty years later, the horror attraction "Fazbear's Fright". One true threat, Springtrap. Audio lures to steer him, a maintenance panel to reboot failing audio, cameras and ventilation. Phantom animatronics cause hallucinations that break your systems. Hidden minigames lead to the "good ending". |
| 2015 (Jul) | Five Nights at Freddy's 4 | Scott Cawthon | You play a child in a bedroom. No cameras. You listen at doors for breathing, check the bed and closet, and use a flashlight. Audio is the main sense. Nightmare animatronics. Minigames tell the story of the Crying Child and the Bite of '83. |
| 2016 (Jan) | FNaF World | Scott Cawthon | A cute turn-based RPG spin-off with the whole cast. Proof the characters work outside horror. |
| 2016 (Oct) | Five Nights at Freddy's: Sister Location | Scott Cawthon | Story-driven nights with varied tasks each shift, a voice-acted AI guide (HandUnit), Circus Baby, Ballora, Funtime Freddy and Funtime Foxy. Night tasks change every night. |
| 2017 (Dec) | Freddy Fazbear's Pizzeria Simulator | Scott Cawthon | A restaurant tycoon game wrapped around a horror office segment where you manage noise, ventilation and tasks while salvaged animatronics creep through vents. Ties up the Afton storyline. |
| 2018 (Jun) | Ultimate Custom Night | Scott Cawthon | A single office, fifty selectable animatronics from the whole series, each with its own counter mechanic, AI levels 0 to 20 for each. The 50/20 challenge. Doors, vents, heater, power generator, music box, global music box, Faz-Coins, Death Coin. The ultimate "systems stacking" FNAF. |
| 2019 (May) | Five Nights at Freddy's: Help Wanted | Steel Wool Studios | VR. Recreates classic nights in first person, plus new minigames. Introduces Glitchtrap, a digital entity. |
| 2019 (Oct) | Five Nights at Freddy's AR: Special Delivery | Illumix | Mobile AR. Animatronics "visit" you in the real world. |
| 2021 (Dec) | Five Nights at Freddy's: Security Breach | Steel Wool Studios | Free-roam 3D in the Mega Pizzaplex. You play Gregory, a child, guided and protected by Glamrock Freddy. Vanny, the Glamrock crew, Burntrap. |
| 2023 (Jan) | Security Breach: Ruin | Steel Wool Studios | DLC. Cassie explores the ruined Pizzaplex. |
| 2023 (Dec) | Five Nights at Freddy's: Help Wanted 2 | Steel Wool Studios | VR sequel. Fazbear Entertainment training "jobs", minigames, more Glitchtrap and Mimic foreshadowing. |
| 2024 | Five Nights at Freddy's: Into the Pit | Mega Cat Studios | 2D pixel adventure adapted from the "Fazbear Frights" book story. Time travel through a ball pit, a yellow rabbit stalker. |
| 2025 (Jun) | Five Nights at Freddy's: Secret of the Mimic | Steel Wool Studios | First-person exploration of Murray's Costume Manor in 1979. The Mimic, an endoskeleton that copies costumes and behaviour. Chronologically the earliest point in the timeline. |
| 2026 (announced) | FNaF World 2 and Security Breach 2 | Mega Cat Studios and Steel Wool Studios | Announced around the franchise's 12th anniversary. No release dates at time of writing. |

Outside games: the "Silver Eyes" trilogy of novels (2015 onward), the "Fazbear Frights" anthology series, "Tales from the Pizzaplex", graphic novels, and the Blumhouse films. The first film, directed by Emma Tammi and starring Josh Hutcherson, released in October 2023 and opened around $80 million domestically. "Five Nights at Freddy's 2" released on 5 December 2025 and opened at roughly $63 million domestically, a record for the post-Thanksgiving weekend, despite brutal reviews. The franchise's commercial gravity is enormous, which is exactly why our IP guardrails matter.

### 1.3 The original game, mechanic by mechanic

This is the game we're replicating first and most faithfully. Everything in this section maps directly onto the systems in Parts 3 to 5.

The setting is Freddy Fazbear's Pizza, a cheap Chuck E. Cheese style family restaurant. You've taken a job as night security guard, working midnight to 6 AM, for $120 a week. You sit in a small office at the end of two hallways. You can't leave. You can't move except to turn your head left and right, which pans the view across the office.

The office has two doorways, one on the left and one on the right. Each side has a door button (slam a heavy steel door shut) and a light button (flood the blind spot just outside the doorway with light, so you can see if something's standing there). On the desk sits a monitor you can flip up to view a network of security cameras around the building. Flipping it up blocks your view of the office. Everything you do consumes power.

The animatronics are allowed to "free roam" at night, the phone message says, because their servos lock up if they stay off too long. Supposedly, if they see you after hours, they won't recognise you as a person. They'll assume you're an endoskeleton without its costume, which is against the rules, so they'll forcefully stuff you into a spare Freddy Fazbear suit. The suit is full of crossbeams, wires and animatronic parts. The phone guy notes, cheerfully, that the only parts of you likely to see the light of day again are your eyeballs and teeth.

#### The cameras in FNAF 1

| Cam | Name | Notes |
|---|---|---|
| 1A | Show Stage | Freddy, Bonnie and Chica start here. |
| 1B | Dining Area | A hub most animatronics pass through. |
| 1C | Pirate Cove | Foxy's curtained stage. Watching it slows him. |
| 2A | West Hall | Long hallway to the left door. Foxy sprints down it. |
| 2B | West Hall Corner | Right outside the left door's blind spot area. Golden Freddy's poster easter egg lives here. |
| 3 | Supply Closet | Bonnie sometimes lurks here. |
| 4A | East Hall | Hallway to the right door. |
| 4B | East Hall Corner | Just outside the right door's area. |
| 5 | Backstage | Spare heads and endoskeletons. Bonnie sometimes stares straight into the lens. |
| 6 | Kitchen | Camera is disabled, audio only. You hear pots and pans when Chica or Freddy is in there. |
| 7 | Restrooms | Chica and Freddy pass through here. |

#### Movement paths in FNAF 1

Bonnie only ever approaches from the left. Typical route: Show Stage (1A), Dining Area (1B) or Backstage (5), then West Hall (2A) or Supply Closet (3), then West Hall Corner (2B), then the left door. Bonnie can skip rooms and teleport between adjacent nodes quickly. When Bonnie's at the left door, flicking on the left light shows his silhouette in the doorway.

Chica only approaches from the right. Typical route: Show Stage, Dining Area, Restrooms (7) or Kitchen (6), East Hall (4A), East Hall Corner (4B), then the right door. In the right window when the light's on.

Freddy follows a fixed, slower route: Show Stage, Dining Area, Restrooms, Kitchen, East Hall, East Hall Corner, then the right door. He's mostly hidden on camera in dark spots, you see only his glowing eyes. He laughs when he moves (a deep, wet chuckle). He only moves when you're not looking at his current camera. He's inactive on Nights 1 and 2. If he reaches the office while you've got the camera up and the right door is open, he gets in.

Foxy lives in Pirate Cove and progresses through stages: curtains closed, peeking out, stepping out, and finally the stage empty with an "Out of Order" sign. Looking at cameras too much (or not at all) affects him. Specifically, every time you look at Cam 1C his movement opportunity is frozen for a random short while. Once he leaves, he sprints down the West Hall. If you flip to Cam 2A you'll catch him running. If the left door is closed when he arrives, he bangs on it and drains power (the first knock drains 1%, each subsequent knock drains 5% more than the last: 1%, 6%, 11%, 16%, and so on). If the left door is open, he jumpscares you.

Golden Freddy is a hidden threat. In Cam 2B there's a poster of Freddy that very rarely changes to a close-up of Golden Freddy's face. If you then lower the monitor, a slumped golden bear sits in your office. If you don't raise the monitor again within a few seconds, he screams and crashes the game. Associated with hallucination text flashes ("IT'S ME") and the number 1987.

#### The AI system in FNAF 1

This is the most important technical fact in this bible.

Every animatronic has an AI level from 0 to 20. Every animatronic also has its own movement timer. When that timer fires, the game rolls a random integer from 1 to 20. If the roll is less than or equal to the AI level, the animatronic takes a "movement opportunity" (it moves to an adjacent node, or advances its stage). If not, it stays put. AI 0 means never moves. AI 20 means moves on every opportunity.

The movement intervals in the original are famously slightly different per character, so they drift in and out of sync:

| Character | Movement opportunity interval |
|---|---|
| Freddy | 3.02 seconds |
| Bonnie | 4.97 seconds |
| Chica | 4.98 seconds |
| Foxy | 5.01 seconds |

Starting AI levels per night (as documented by the community through datamining):

| Night | Freddy | Bonnie | Chica | Foxy |
|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 |
| 2 | 0 | 3 | 1 | 1 |
| 3 | 1 | 0 | 5 | 2 |
| 4 | 1 to 2 (random) | 2 | 4 to 6 (random) | 6 |
| 5 | 3 | 5 | 7 | 5 |
| 6 | 4 | 10 | 12 | 16 |
| 7 (Custom) | player set 0 to 20 | player set | player set | player set |

During each night, AI levels rise at specific in-game times: Bonnie gains +1 at 2 AM, and Bonnie, Chica and Foxy each gain +1 at 3 AM and again at 4 AM. Freddy doesn't get these increments. Note that on Night 1 Bonnie and friends still start moving after 2 AM because of these bumps (Bonnie hits AI 1 at 2 AM, 2 at 3 AM, 3 at 4 AM).

The famous "4/20 mode" in Custom Night sets Freddy 4, Bonnie 20, Chica 20, Foxy 20. Beating it earns the third star. Scott Cawthon's 1/9/8/7 combination (Freddy 1, Bonnie 9, Chica 8, Foxy 7, an obvious nod to "1987") summons Golden Freddy instantly and kills you.

#### Time in FNAF 1

A night runs from 12 AM to 6 AM. Each in-game hour lasts about 89 real seconds, so a full night is about 535 seconds (just under nine minutes). The clock in the corner shows only the hour. When 6 AM hits, the screen fades to a chiming clock and children cheering "Yaaay!" The cheer is the release valve for the whole game.

#### Power in FNAF 1

You start every night with 100% power. Power drains over time and faster with every system in use. The HUD shows a "Usage" meter of one to five bars.

Usage of one bar is the baseline (the office itself). Each of the following adds a bar while active: left door closed, right door closed, left light on, right light on, camera monitor up. In the original, power drains roughly 1% every 9.6 seconds at usage 1, 1% every 4.8 seconds at usage 2, 1% every 3.2 seconds at usage 3, and 1% every 2.4 seconds at usage 4 and above. On top of usage, from Night 2 onward there's a passive drain that ticks extra percentage on a fixed interval (Night 2 every 6 seconds, Night 3 every 5, Night 4 every 4, Night 5 and later every 3). That's why later nights feel so much tighter.

When power hits 0%, everything shuts off. Doors open with a clunk, lights die, the fan stops, the monitor won't come up. After a pause, Freddy's face appears in the left doorway, eyes flashing, playing the Toreador March on a music box. When the song ends, the office goes black, and he either attacks immediately or after a random delay. Each in-game time step during the blackout gives you a chance to survive if 6 AM arrives first. This sequence is probably the single most famous moment in the franchise.

#### Jumpscares in FNAF 1

A jumpscare is a quick animation of the animatronic lunging into your face, mouth open, with a loud electronic screech. Then a static-filled "Game Over" screen with the guard stuffed in a suit. A good jumpscare is short (under a second), sudden, loud and visually overwhelming. Bonnie and Chica can wait until you flip the monitor down to attack, so you only learn you lost when you pull the camera away. That "they're already inside" moment is a classic. Bonnie or Chica in the office also disables your door and light buttons on that side (the "button doesn't work" error buzzer is a key tell).

#### Other FNAF 1 details fans love

The "It's Me" hallucinations. The rare "Shadow Bonnie" poster. The Freddy nose honk on the poster in your office (press the nose, it squeaks). The newspaper clippings on Cam 2A about five missing children. The kitchen sounds. The left and right "breathing" ambience. The fan on the desk. The cupcake on Chica's table. The "Celebrate!" poster. The faint drum beat of distant footsteps. Phone calls that you can mute by clicking a "Mute call" button. The game saves your progress on Night 1, Night 6 and star unlocks.

### 1.4 Later mechanics worth stealing for multiplayer variety

The sequels show how FNAF stays fresh: each game swaps one core defence for a new one. Our free-roam game turns these defences into tasks, tools and hazards scattered around a real map (Parts 3 to 5). Here's the menu we'll draw from.

From FNAF 2: the mask (put on a fake animatronic head to fool a visitor in your office, but you can't use the monitor while wearing it); the flashlight (flash it down the hall to scare off one specific threat, battery limited); the music box (wind it from the camera feed or the Puppet escapes). Wind-up mechanics are perfect for teamwork because one player can be assigned to keep something wound while others defend.

From FNAF 3: audio lures (play a child's voice on a camera to pull the hunter toward it); the maintenance panel (systems fail over time, rebooting each takes several seconds during which you're blind); ventilation errors (when the vents fail you start hallucinating and phantoms appear). A rebootable maintenance panel is ideal for an "Engineer" role.

From FNAF 4: listening (hold a door, listen for breathing, decide whether it's safe to shine the light); the closet and the bed. Audio-first defence is great for adding tension and for giving a non-camera player something to do.

From Sister Location and Pizzeria Simulator: night-specific tasks (fix a part, press a sequence, wait in the dark), noise meters (too much activity attracts danger), ventilation management. Tasks give players objectives besides surviving, which helps multiplayer pacing.

From Ultimate Custom Night: a heater, a fan, a generator, a power AC; and the idea that each enemy has one simple counter rule, and the difficulty comes from stacking many simple rules at once. Custom Night with selectable enemies and AI sliders is a must for replayability, and its 50/20 attitude is something our hardest mode should channel.

From Help Wanted and Security Breach: first-person presence, the idea of a protective friendly animatronic, and modern presentation. We're keeping the fixed office camera because that's the soul of the series, but we'll borrow the polish.

### 1.5 The lore, briefly and accurately

You don't need to write an encyclopedia, but the in-game newspaper clippings, minigames, achievements and easter eggs should nod knowingly to the canon. Here's a compact summary of the core story as the fandom broadly understands it. Write flavour text that references these themes in original words, never copying lines.

Fredbear's Family Diner was the first location, opened by William Afton and Henry Emily, who built the animatronics through their company, Afton Robotics, later partners in what became Fazbear Entertainment. The animatronics included Fredbear and Spring Bonnie, golden "springlock" suits that could be worn by staff or run autonomously, held open by spring locks that could snap shut violently if handled wrong.

William Afton was a serial killer. Around 1983 his youngest son, the Crying Child, was terrorised by his older brother and his friends, and during a birthday party they shoved him into Fredbear's mouth, which clamped down. This is the "Bite of '83". The child later died.

Henry's daughter Charlotte (Charlie) was murdered by William outside a Freddy Fazbear's location. Her spirit possessed the Puppet (Marionette), which began "giving life" to other victims by placing them inside animatronics. In the infamous "Missing Children Incident" William, wearing the Spring Bonnie suit, lured five children into a back room and murdered them. Their spirits came to possess Freddy, Bonnie, Chica, Foxy and Golden Freddy. That's why the animatronics are hostile toward adult night guards: they're looking for the man in the purple uniform who killed them. In FNAF 2 the "Bite of '87" happens, where a Toy animatronic (most likely Mangle) bites an adult in the head, leading to new restrictions on animatronic free-roaming during the day.

Eventually William returned to the abandoned Freddy's to dismantle the possessed animatronics. The spirits cornered him. He hid inside the Spring Bonnie suit, the springlocks failed in the rain-leaking building, and he died slowly inside it. Thirty years later he emerged as Springtrap, the hunter of FNAF 3. His daughter Elizabeth was killed by Circus Baby, his son Michael (likely the "Purple Guy" figure for many and later the player in Sister Location) became the agent who tracks down and helps end his father's legacy. In Pizzeria Simulator, Henry lures the remaining haunted animatronics, including Afton's last form (Scraptrap), into a fake restaurant and burns it down, and a final monologue frees the children's spirits. Afton's consciousness persists digitally as Glitchtrap, setting up the Steel Wool era (Help Wanted, Security Breach, Help Wanted 2). Secret of the Mimic later adds the Mimic, an adaptive endoskeleton from the 1970s built by Edwin Murray, which can copy costumes and behaviour and whose history ties into the series' darkest events.

Recurring motifs you can safely nod to with original material: the purple guy figure (an 8-bit silhouette in minigames), the number 1987, "IT'S ME", missing children newspaper headlines, the Puppet's music box, springlock warnings, corporate legal disclaimers that dodge responsibility (write your own), golden animatronics as rare, mythical threats, cake, balloons, party hats, and the happy children's cheer at 6 AM that hides something sad.

In our game, the pizzeria is a new location in the same spirit: "Freddy Fazbear's Pizza, Location 7" (in tribute mode) or "Barnaby's Big Bite Pizza Palace" (in original mode). It has its own small invented backstory told through newspaper clippings in Part 7, so we never rely on reproducing canon text.

### 1.6 Why FNAF works (design principles we'll obey)

The scariest moment in FNAF isn't the jumpscare. It's the four seconds before you check the light. Every system serves that anticipation. Keep these principles taped to your monitor.

Information is the currency. You only know where things are if you look, and looking costs power and attention. Every camera check is a choice between watching one threat and leaving another unwatched. In multiplayer, sharing information between players becomes the core skill. The design makes communication valuable but not free: proximity voice only carries so far, and the walkie-talkie is an item someone has to carry (Part 4).

Constraints breed dread. In the office games you can't run, can't fight, can't save; you only manage resources. In our free-roam version you can move, but the same spirit holds: you can run (briefly, loudly), you can hide, you can stun for a second with a camera flash, but you can never fight back. Never give the players a weapon. Running is a panic button with a cost, not a solution.

The rules are learnable. A good FNAF death is one where you immediately know what you did wrong ("I didn't check the left light"). Every threat must have tells (audio cues, visual cues on camera, door-light silhouettes, error buzzes), and the tells must be consistent. Tune for fairness first, then raise difficulty by stacking rules and raising AI, never by hiding tells.

Silence is an instrument. Most of the time the game is quiet: fan whir, a hum, distant thumps. Sound design is half of the experience. Don't put music over gameplay. Ambient drones only.

Jumpscares are a punctuation mark, not a sentence. They're short, loud and final. And they end the night (for that player).

Low fidelity helps. The grainy, flickering, half-lit cameras make your imagination do the work. Our renderer will lean into CRT noise, scanlines, low resolution, vignetting and harsh contrast rather than chasing realism.

Mystery sells. Hidden minigames, rare events, cryptic newspaper text and secrets keep a community theorising. We'll plant several (Part 9).


### 1.7 The free-roam era of FNAF (the direct inspiration for this build)

The owner's vision is the 3D, walk-around-the-building version of FNAF, the one where you and your friends explore the back rooms, the vents and the basement instead of sitting still. The official series moved in that direction from 2019 onward, and a huge wave of fan games got there first. Here's what each one teaches us.

Help Wanted (2019, VR) put players physically inside the classic offices for the first time. Even though you mostly sit, the act of leaning to peek through a door, physically lifting a mask, or reaching for a flashlight made the old mechanics terrifying in a new way. The lesson: physical presence multiplies fear. When the player's own body has to do the action (turn around, crouch, lean), the threat feels real. In our game every important action is a physical action in first person: you walk to the breaker, you hold the crank, you crouch into the locker.

Security Breach (2021) was the first fully free-roam mainline game. You play Gregory, a kid trapped overnight in the Mega Pizzaplex, a gigantic mall-like entertainment complex. Glamrock Freddy is your protector: you can hide inside his chest cavity and ride with him. The Glamrock animatronics (Chica, Roxanne Wolf, Montgomery Gator) and security bots roam on patrol routes, spot you with vision cones, and chase you. You hide in lockers, carts, under tables and behind curtains. You use a Faz-Camera flash to stun pursuers briefly, a Fazwatch to view security cameras, and keycards (party passes, security badges) to open new areas. Power stations, recharge points and save points structure the space. The game's best moments are hiding in a locker while an animatronic walks past, hearing its footsteps, seeing its shadow pass the vents. Its worst moments (most players agree) came from a sprawling map without clear direction, bugs, and threats that felt random. The lessons: hiding is the emotional core of free-roam FNAF; clear objectives and readable threat rules matter more in an open map than in an office; a big map needs strong landmarks and a way to know where to go.

Security Breach: Ruin (2023) shrank the scope to a ruined Pizzaplex and made it tighter: Cassie explores with an AR mask, can toggle the mask to see digital helpers and hazards, restores generators, solves small puzzles, and is stalked in darker, more claustrophobic spaces. The lesson: smaller, denser, darker spaces beat huge empty ones. Restoring power with generators and reconnecting systems makes a great objective loop.

Help Wanted 2 (2023, VR) is a collection of short jobs with clear goals. The lesson: tasks with crisp completion feedback (a satisfying clunk, a light turning green) keep players engaged between scares.

Secret of the Mimic (2025) is a first-person exploration game in Murray's Costume Manor, set in 1979. You explore a large manor with interconnected wings, use found tools and gadgets, solve environmental puzzles to open new areas, hide from the Mimic and its costume-wearing forms, and learn the history through notes and recordings. The Mimic learns and copies behaviour. The lesson: an adaptive hunter that changes behaviour keeps experienced players nervous, and a building with interconnected loops (multiple routes between areas, shortcuts that unlock) makes chases interesting because you can always break line of sight.

Into the Pit (2024) is 2D, but its core loop is great for us: you go back and forth between a safer and a more dangerous version of the same place, completing tasks in a time limit while a stalker hunts you, and you must hide when it appears. The lesson: time pressure plus a recurring stalker plus a safe-ish zone works.

Fan games and community multiplayer projects took the free-roam idea in co-op directions for years before the official games: free-roam recreations of the original pizzeria where you walk the halls of FNAF 1's building, co-op survival games where friends split up to fix generators while animatronics roam, and asymmetric "one player is the animatronic" games heavily inspired by Dead by Daylight. The best of them share a few traits we'll copy: the original FNAF 1 building layout is instantly recognisable and fans love walking it; generators, fuses and power are the go-to objective; hiding spots and vents are the go-to escape; and splitting up versus sticking together is the core co-op tension.

Beyond FNAF, a few non-FNAF co-op horror games set the bar for how this genre feels with friends, and they're worth naming so you understand the target. Phasmophobia (proximity voice, the horror of hearing a friend scream from another room, a van as a hub). Lethal Company (split up, scavenge, proximity voice comedy and terror, walkie-talkies as items). Dead by Daylight (repairing generators as the objective, a hunter with clear rules, hooks and rescues as a co-op save mechanic). Alien: Isolation (a single hunter driven by a "director" that keeps it near the player without cheating, lockers with hold-your-breath, a motion tracker). Content Warning, R.E.P.O. and similar party horror games prove that the funny moments in co-op horror are as valuable as the scary ones. We're blending all of this with FNAF's specific rules and atmosphere.

### 1.8 Translating the office mechanics into a walkable building

Every classic FNAF mechanic has a natural free-roam version. This table is the backbone of the design, and you'll see each row expanded in Parts 3 to 6.

| Classic office mechanic | Free-roam version in our game |
|---|---|
| Limited power percentage | The building runs on a failing power grid. A breaker room and fuse boxes control zones. Power drains when lights, doors and cameras are in use. If it hits 0, the building blacks out and Power-Out Freddy hunts |
| Doors you close | Real doors throughout the building that players can close and hold. Security doors (heavy steel shutters) at key chokepoints that run on power and can be closed from the Security Office or from a wall button |
| Lights you flick on | Zone lighting: each zone of the map has a light switch panel or needs its fuse restored. Lit zones are safer for seeing threats but some animatronics are drawn to light. Every player has a flashlight with a battery |
| Cameras | Wall-mounted security monitors in the Security Office, and a handheld tablet item (the "Faz-Pad") that shows camera feeds anywhere but drains battery and makes you a sitting duck while you watch |
| Freddy only moves when not watched | Freddy only moves when no player has him in view (in first person, in line of sight, within range, lit enough to see). Look away and he's closer. This is a weeping-angel mechanic, and it's terrifying in 3D |
| Bonnie appearing suddenly | Bonnie is a fast patroller who can relocate when no one's watching the node he's in, so he appears in places you just checked |
| Chica in the kitchen | Chica is attracted to the kitchen, food and cupcakes. The cupcake objective directly lures her |
| Foxy sprints when ignored | Foxy waits in Pirate Cove; if nobody checks the cove (in person or on camera) for too long, he sprints at the nearest player along a hallway. Closing a door in his face or hiding stops him |
| Golden Freddy | A rare apparition tied to posters and hallucinations: look away or he gets you |
| The Puppet's music box | A music box in the Prize Corner that must be physically wound by a player (stand at it and hold to "retwist the crank"). Others can wind it remotely from a camera at reduced speed. Let it run out and the Puppet hunts |
| The mask | A Freddy mask item that fools some animatronics when worn, at the cost of vision and movement |
| Audio lures (FNAF 3) | A noisemaker toy item and wall speakers controllable from the Security Office to pull animatronics away from teammates |
| Maintenance panel reboots | Systems that fail during the night (cameras, ventilation, doors) and must be rebooted at physical panels around the map |
| Listening at doors (FNAF 4) | Full 3D positional audio: footsteps through walls, breathing behind doors, vents rattling overhead. You can press your ear to a door to hear through it |
| Tasks (Sister Location) | Each night has a list of objectives across the map, plus random side tasks |
| Getting stuffed into a suit | Getting caught knocks you down (downed state). Teammates can revive you if they reach you in time. If not, you're out for the night and become a ghost |

### 1.9 Design principles for free-roam (in addition to 1.6)

Hiding has to feel amazing. The best moment in this genre is crouching in a locker, slatted light striping your face, breathing held, while an animatronic's footsteps stop right outside. Spend real effort on hiding: the camera view through slats, the muffled audio, the heartbeat, the breath-hold mechanic, the animatronic's search animation.

Darkness is the map. Most of the building should be dark until players restore power and lights. Flashlights cut cones through it. Lit zones are islands of relief. Turning the lights on in a zone should feel like a victory and change how that space plays.

Landmarks beat minimaps. Players must be able to navigate by recognisable rooms: the show stage, the giant pizza sign, the ball pit, the arcade glow, the kitchen's red emergency light. We'll give them a paper map item and wall maps (You Are Here) rather than a GPS minimap, because getting a bit lost is part of the dread. But never so lost that it's frustrating: objective markers can be toggled on in settings and appear by default on Night 1.

Threats are readable. Each animatronic has a distinct footstep, a distinct sound when it's hunting, a distinct look in the dark (eye colour), and a distinct rule. A player who dies should know why: "Freddy got me because I turned my back on him", "Foxy got me because nobody checked the cove", "Chica got me because I was carrying cupcakes past the kitchen".

Loops and shortcuts. The map has multiple routes between every major area, plus vents and maintenance tunnels as alternate paths. A chase should always be escapable with good play: break line of sight, duck into a vent, close a door, hide. Dead ends exist but are marked by experience, not by invisible walls.

Splitting up is a choice with a cost. Objectives are spread out so splitting up is efficient. But alone, nobody can revive you, nobody can watch your back, and proximity voice can't reach your friends. Sticking together is safer and slower. The night's timer and the power drain push teams to split. This tension is the multiplayer heart of the game.

Comedy is welcome. Friends will scream, laugh, hide in the same locker (allow two players in large lockers, it's hilarious), honk the Freddy nose, and do dumb things. Let them. Proximity voice, emotes, the noisemaker toy and physics props make room for that. The scares land harder after a laugh.


---

## PART 2: THE GAME WE'RE BUILDING (HIGH-LEVEL DESIGN)

### 2.1 The pitch

It's 11:58 PM. Four night-shift security hires stand in the rain outside the staff entrance of Freddy Fazbear's Pizza, Location 7 (in original mode, Barnaby's Big Bite Pizza Palace). The day manager left a note taped to the door: the power's been acting up, the lights are off, the music box needs winding, and the animatronics are "on free-roam mode for servo maintenance, just stay out of their way". The door clunks shut behind them at midnight. It won't open again until 6 AM.

Inside, the building is pitch black apart from emergency exit signs and the glow of an arcade cabinet somewhere deep in the dining hall. The players have flashlights, a walkie-talkie between them, and a clipboard with tonight's checklist. They need to get the power back on in the basement, flip the zone lights, wind the music box in the Prize Corner before it runs down, gather the five cupcakes from the kitchen and put one on each party table, and keep the building alive until the clock hits six. Somewhere in the dark, a guitar string twangs. Something heavy walks across the dining hall. The show stage curtain is open, and the stage is empty.

That's FNAF Replica: a 1 to 4 player co-op free-roam survival horror game in the browser.

### 2.2 Game modes

Build them in the order listed; the first is the product.

**Mode A: Night Shift (co-op free-roam, 1 to 4 players).** The main mode. Players spawn at the Staff Entrance, explore the whole building, complete each night's objectives, avoid or escape the animatronics, revive downed friends, and survive until 6 AM. Nights 1 to 5 form the campaign, each adding threats, objectives and map areas. Night 6 and Custom Night unlock after. Progress is per-account (Part 8).

**Mode B: Showtime (asymmetric versus, 2 to 5 players).** One player is an animatronic, playing in full 3D first or third person, hunting up to four guards who play exactly as in Night Shift. The animatronic player picks a character, each with a unique ability set (Part 6.10). The guards win by completing the night's objectives and surviving to 6 AM (or escaping through the front doors once all objectives are done, see Part 5.9). The animatronic wins by taking every guard out of the night. Dead by Daylight structure, FNAF flavour. Build after Night Shift is stable.

**Mode C: Custom Night (co-op or solo).** Pick which animatronics are active (from the full roster in Part 6B), set each one's aggression 0 to 20, choose objective modifiers (double cupcakes, no lights, power starts at 30%, faster music box), and see your score multiplier. Presets with rewards (Part 5.11).

**Mode D: The Office (classic bonus mode, solo).** Inside the building is a Security Office. In this bonus mode, a single player sits in it FNAF 1 style: doors, lights, cameras, power, four animatronics walking the same 3D building, rendered through the same engine. It's a faithful tribute to the 2014 original and costs little extra to build because the world, AI and cameras already exist. The full classic FNAF 1 rules for it are in Part 5.12. This is a bonus, not the main event.

**Mode E: Day Shift (free explore, no threats).** The building with all lights on, animatronics standing still on stage, posters readable, music playing from the stage speakers, all secrets reachable, for players to learn the map, take screenshots, and mess about. Unlocked from the start. Great for first-time players and for showing off the art. It also doubles as your development playground.

### 2.3 The core loop of a night

1. Lobby: players join with a code, pick skins, pick a starting loadout item each (Part 4.9), ready up. Host picks the night.
2. Intro cutscene (skippable after first view): 15 seconds. Exterior shot of the building in the rain, neon sign buzzing, the camera pushes in through the staff door as the players' characters walk in together. The door slams. A clock face shows 12:00 AM. Text: "Night N".
3. The checklist: every player sees the night's objectives on their clipboard (press `Tab` to raise it in first person, it's a physical clipboard held up in front of the camera, Part 4.11).
4. The night: six in-game hours. Players explore, complete objectives, manage power, hide, survive. Animatronics hunt. The phone in the Security Office rings at 12:05 AM with the day manager's message (Part 7); anyone in the office can answer it, and the call is also relayed over walkie-talkies to anyone carrying one.
5. Getting caught: a jumpscare plays for the caught player, then they're downed (Part 4.14). A teammate can revive them within the bleed-out time. If not, they become a ghost for the rest of the night.
6. 6 AM: if at least one guard is still in the night (alive, or downed but not bled out), the night is won. A 6 AM chime rings through the whole building, the lights all come on at once, the animatronics freeze mid-step and slowly walk back to the stage, and children's cheering plays. Objectives completed add bonus pay.
7. Early exit: if all of a night's required objectives are done, the front doors unlock at 5 AM and players can choose to leave early through them for a bonus (Part 5.9). Survivors who aren't at the exit at 6 AM still count as survived.
8. Paycheck: tokens, achievements, stats. Back to the lobby.

### 2.4 The cast of threats in the campaign

Night 1: Bonnie and Chica only, low aggression, the music box runs slowly. Freddy is visible on stage and doesn't move. Foxy's curtain is closed. The building is learnable.

Night 2: Bonnie and Chica more aggressive. Foxy activates.

Night 3: Freddy activates (weeping-angel rule). The Puppet becomes a real threat if the music box runs out. Ventilation failures begin.

Night 4: everything faster, more system failures, Golden Freddy apparitions possible, the basement floods partially.

Night 5: everyone at high aggression, power drains faster, objectives longer.

Night 6: everyone maxed plus two random extended-roster characters (Part 6B).

### 2.5 What players can do

Walk, sprint (stamina), crouch, crouch-walk, crawl in vents, lean left and right around corners, jump (small hop, mostly to get over low obstacles), vault low barriers, interact (doors, switches, items, hiding spots), use a flashlight, use an item in hand, carry one large object with both hands (a cupcake tray, a fuse crate, a battery), hold their breath while hidden, revive a downed teammate, look at the clipboard and the paper map, emote, talk (proximity voice and walkie-talkie), ping (point at something and press the ping key to mark it for teammates, a world-space marker visible through walls for 8 seconds).

What players can't do: fight, damage animatronics, carry more than four small items plus one large object, see through walls (except pings and the tablet's cameras), leave the building before the doors unlock.

### 2.6 Session length and pacing targets

A full night lasts about 15 real minutes at default settings (each in-game hour = 150 seconds; configurable). That's longer than FNAF 1's 9 minutes because players have to travel. Target pacing per night: first 2 to 3 minutes, tension builds, players spread out and start objectives, first animatronic encounter around minute 3; middle 8 minutes, peaks and valleys driven by the AI Director (Part 6.9), at least two chases and several close calls per player; final 4 minutes, rising aggression, a climactic last hour where the music box runs faster, the lights start failing and players regroup.

For development and testing, `FAST_NIGHT=1` sets hours to 10 seconds (one-minute nights).


---

## PART 3: THE MAP (FREDDY FAZBEAR'S PIZZA, LOCATION 7)

This part is the level design document. It's the biggest single section in the prompt because the map is the game. Every zone below lists its size, layout, connections, lighting, props, hiding spots, vents, objectives and item spawns, threat behaviour, sound, and secrets. Build the map as data (Part 3.1) and generate the geometry from that data, so it's easy to tweak and so the server, the AI and the client all share one source of truth.

### 3.1 How the map is built (data-driven level)

You won't hand-model the level in a 3D editor. You'll describe it in TypeScript data and generate geometry procedurally at load. This keeps the whole game in code, keeps the repo small, and lets the server load the exact same collision and navigation data headless.

Coordinate system: metres. +X is east, +Z is south, +Y is up. The ground floor's finished floor is at Y = 0. The basement floor is at Y = -4.5. Ceilings on the ground floor are 3.6 m in public areas and 3.0 m in back-of-house areas; the dining hall has a 5.0 m ceiling with exposed trusses. The building's ground-floor footprint is 96 m (X) by 64 m (Z), with the north wall at Z = 0 facing the parking lot.

The level file `shared/src/world/level.ts` exports:

```ts
interface Level {
  zones: Zone[];            // logical areas (rooms, halls), used for lighting, power, audio, AI, objectives
  rooms: RoomShell[];       // axis-aligned boxes or polygons extruded to wall height, with floor/ceiling/wall materials
  openings: Opening[];      // gaps in walls: doorways (with or without a door), windows, arches, vent grilles
  doors: DoorDef[];         // swinging doors, sliding security shutters, roller doors, locker doors
  props: PropDef[];         // placed props by type id + transform (tables, chairs, arcade cabinets...)
  colliders: ColliderDef[]; // extra collision boxes not covered by walls/props (stage edge, counters)
  hidingSpots: HidingSpotDef[];
  vents: VentNetwork;       // duct segments, junctions, grilles
  lights: LightDef[];       // fixtures with zone, type, power circuit, flicker profile
  circuits: CircuitDef[];   // power circuits and which breaker/fuse controls them
  interactables: InteractableDef[]; // switches, panels, crank, phone, terminals, item pedestals
  cameras: SecurityCameraDef[];
  spawns: SpawnDef[];       // player spawn, animatronic start positions, item spawn points
  navHints: NavHint[];      // patrol waypoints, search points, ambush points
  audioZones: AudioZoneDef[]; // reverb presets, ambience loops
  landmarks: LandmarkDef[]; // named for the paper map
}
```

A generator (`shared/src/world/build.ts`) turns rooms and openings into wall segments with door and window holes, floors and ceilings, and collision boxes. The client turns the same output into meshes with materials (Part 11). The server uses it for collision and to bake the navigation mesh (Part 10.7). Write a debug top-down renderer (`npm run map:render`) that outputs an SVG of the level with zones, doors, hiding spots, vents, lights and spawns labelled, and commit the SVG to `docs/map.svg` so humans can check the layout. Regenerate it whenever the level changes.

Wall thickness: 0.2 m interior, 0.35 m exterior. Doorway standard: 1.0 m wide by 2.2 m high; double doors 2.0 m; security shutters 1.6 m wide. Vent grilles: 0.6 m by 0.6 m, set into walls at 0.3 m above the floor (floor-level grilles, easy to crawl into) or in ceilings (accessible only by climbing on a prop, marked with a step stool or shelf). Duct interiors are 0.7 m square.

### 3.2 The zone list at a glance

| Id | Zone | Floor | Approx size (m) | Starts powered? | Key objectives/content |
|---|---|---|---|---|---|
| Z01 | Front Entrance & Lobby | G | 18 × 10 | Emergency only | Locked front doors (the early exit), ticket counter, wall map |
| Z02 | Dining Hall | G | 34 × 26 | No | Central hub, party tables (cupcake delivery), main zone light switch |
| Z03 | Show Stage | G | 16 × 8 (+ booth) | No | Freddy's start, stage control booth (lure system), curtains |
| Z04 | Pirate Cove | G | 8 × 6 | No | Foxy's start, the sprint lane into West Hall |
| Z05 | Prize Corner | G | 12 × 10 | Yes (music box circuit) | The Puppet's gift box, the music box crank |
| Z06 | Arcade | G | 14 × 12 | Yes (arcade circuit) | Cabinets as hiding spots, claw machine secret |
| Z07 | Kids' Play Zone | G | 16 × 14 | No | Ball pit (hide), play tubes (crawl routes), slide |
| Z08 | Party Room Hall + Party Rooms 1 to 4 | G | 30 × 14 total | No | Cupcake tables, closets, gift piles |
| Z09 | West Hall | G | 4 × 26 | No | Foxy's lane, posters, West Corner |
| Z10 | East Hall | G | 4 × 26 | No | To Kitchen and Restrooms, East Corner |
| Z11 | Restrooms | G | 12 × 10 | No | Stalls (hide), mirror secret |
| Z12 | Kitchen | G | 16 × 12 | No | Cupcake source, walk-in freezer, pantry, Chica's haunt |
| Z13 | Security Office | G | 6 × 5 | Own circuit | Classic office: two doors, lights, camera monitors, phone |
| Z14 | Backstage | G | 12 × 8 | No | Endo workbench, spare heads, crawlspace hatch |
| Z15 | Parts & Service | G | 14 × 10 | No | Withered animatronics in storage, fuse box, ceiling vent |
| Z16 | Employee Lounge & Lockers | G | 12 × 10 | Emergency only | Player spawn side, lockers (hide), vending machine |
| Z17 | Manager's Office | G | 6 × 6 | No | Keycard, safe, tapes |
| Z18 | Supply Closet | G | 4 × 5 | No | Batteries, fuses, mop bucket |
| Z19 | Utility Corridor | G | 3 × 44 | Emergency only | Back-of-house spine, basement stairs, loading dock |
| Z20 | Loading Dock | G | 12 × 10 | No | Roller door, crates, generator battery pickup |
| Z21 | Staff Entrance (spawn) | G | 6 × 6 | Emergency only | Spawn, time clock, checklist board |
| B01 | Basement Stairwell & Hall | B | 3 × 30 | No | Long dark corridor, pipes |
| B02 | Breaker Room | B | 8 × 8 | n/a (it is the power) | Main breaker panel puzzle: restore power |
| B03 | Boiler Room | B | 12 × 10 | No | Backup generator (pull-start), steam, catwalk |
| B04 | Old Storage (Fredbear's Room) | B | 10 × 10 | No | Old diner props, Golden Freddy lore, tapes |
| B05 | Maintenance Tunnel | B | 2.5 × 36 | No | Loop route under the dining hall, floods on Night 4+ |
| B06 | Camera Server Room | B | 6 × 6 | Own circuit | Camera system reboot, tape archive |
| V | Vent network | G (ceiling and floor level) | ~260 m of duct | n/a | Escape routes, shortcuts, vent threats |
| C | Stage crawlspace | G (under stage) | 1.0 high | n/a | Connects Backstage, Show Stage and Pirate Cove |

Every zone is described below. North is up when you picture these; the front of the building faces north onto the parking lot.

### 3.3 Z21 Staff Entrance (spawn)

Layout: a 6 × 6 m vestibule at the building's south-west corner (X 0 to 6, Z 58 to 64). The exterior staff door on the south wall is a heavy steel door with a push bar; it locks at midnight with a loud electromagnetic clunk and won't open until 6 AM (interacting gives a rattle and the line "It's locked. Of course it's locked."). A short hall leads north into the Employee Lounge (Z16) and east into the Utility Corridor (Z19).

Props: a punch-card time clock on the wall (players can punch in for a tiny achievement), a cork checklist board with tonight's objectives pinned on it (the same list as the clipboard, rendered as paper), a coat rack, a puddle by the door from the rain, a fire extinguisher, a "STAFF ONLY" sign, a mat that says "Welcome Back, Team!".

Light: emergency only. One red emergency exit light over the door and a green "EXIT" sign. Once the Staff circuit is restored, a flickering fluorescent tube comes on.

Hiding spots: none. This is a spawn area; animatronics don't path into the vestibule during the first 60 seconds of a night (spawn protection), and rarely afterward.

Items: four flashlights on a charging shelf at night start (one per player, they're the default loadout and are auto-equipped on spawn), a walkie-talkie set (two units on Nights 1 to 2, four on later nights, picked up from a charging cradle), the paper map rack (each player can take one paper map).

Sound: rain hammering outside, a dripping leak, the time clock's ticking, distant fridge hum from the kitchen.

Secret: punching in at exactly 12:00 AM (the first second of the night) prints a card that says "WELCOME BACK" with the date 1987.

### 3.4 Z16 Employee Lounge & Lockers

Layout: 12 × 10 m (X 0 to 12, Z 46 to 56) north of the Staff Entrance. A row of 14 tall metal lockers along the west wall, two benches, a break table with chairs, a vending machine, a fridge, a microwave, a corkboard of staff notices, a small staff toilet (2 × 2 m with a door) in the north-east corner. Doors: south to Staff Entrance, east to the Utility Corridor, north (a swinging door with a round window) to the West Hall's south end near the Security Office.

Light: emergency only until the Staff circuit is restored; then two overhead fluorescents, one of which flickers.

Hiding spots: lockers (six of the 14 are usable hiding spots, the others are locked and rattle if tried; usable ones have slightly ajar doors as a visual tell), under the break table (crouch hide, weak, only safe if the animatronic doesn't look under), the staff toilet (lock the door from inside for 20 seconds; an animatronic that knows you're inside will force it).

Items: battery pack spawn (on the break table, 60% chance), energy soda (vending machine: interact to buy with a found token, gives a stamina boost), a staff locker with a combination lock (code found in the Manager's Office) containing a spare Freddy mask.

Vents: floor-level grille under the benches connects to the west vent trunk.

Threats: Bonnie's patrol route passes through on Nights 2+. Animatronics check lockers here.

Sound: vending machine hum and buzz, the fridge cycling, a locker door creaking occasionally on its own (ambient scare, harmless).

Secret: one locker (number 7) has a child's drawing taped inside of five kids holding balloons, and a name tag reading "NIGHT 7" (a nod to FNAF 1's secret seventh night). Interacting plays a soft music box sting.

### 3.5 Z19 Utility Corridor

Layout: the back-of-house spine, a long 3 m wide corridor running east along the south of the building (X 6 to 50, Z 56 to 59), then turning north (X 47 to 50, Z 40 to 56) to the Kitchen's back door. Concrete floor with yellow safety lines, exposed pipes and electrical conduit along the ceiling, cable trays, fuse boxes, a mop bucket.

Connections: west to Staff Entrance and Lounge; north doors to Backstage (Z14), Parts & Service (Z15), Supply Closet (Z18) and Manager's Office (Z17); the stairwell door down to the basement (B01) at X 30; east to the Loading Dock (Z20); north end to the Kitchen back door.

Light: emergency only (a red strip light every 8 m) until the Back-of-House circuit is restored; then caged bulbs every 4 m, two of which are dead and one flickers.

Hiding spots: a large laundry cart (crouch into it, holds one player), a utility alcove behind a stack of chairs (crouch hide, partial cover), a broom closet (one player).

Items: fuse spawn points (two along the corridor), a battery spawn.

Fuse boxes: Fuse Box 1 (Back of House circuit) is mounted here at X 20. See Part 5.3.

Threats: the corridor is long and straight, so chases here are dangerous; the doorways into side rooms are your outs. Animatronics coming up from the basement stairs is a classic scare.

Sound: pipes ticking and knocking as they cool, a water leak dripping into a bucket, electrical hum from the fuse boxes, rain on the loading dock's roller door.

### 3.6 Z13 Security Office

Layout: the classic FNAF office, faithfully placed at the south end of the building's centre (X 22 to 28, Z 50 to 55), at the junction of the West Hall and East Hall. A desk facing north with three CRT monitors and a tablet charging dock, a swivel chair, a desk fan, cups, a poster of the band with a honkable nose, a phone, crumpled papers, a cupcake plush, kids' drawings on the walls. Two doorways: west (to West Hall Corner) and east (to East Hall Corner), each with a heavy steel security door that slams down from the ceiling and a door light that illuminates the corner just outside. A rear door (south) to the Utility Corridor, normally locked, openable from inside with the Security Office keycard.

Systems: the office has its own power circuit with a small battery backup (it stays powered even if the building blacks out, but the backup only lasts 3 in-game minutes without main power). The left and right door buttons and light buttons work exactly like FNAF 1 (Part 5.12). Closing a security door blocks the doorway completely (no animatronic can pass). Each closed door and each lit door light drains building power. The three monitors show security camera feeds; the player at the desk can cycle cameras with the mouse wheel or number keys (Part 4.12). A wall panel controls the stage speakers (audio lure, Part 5.6) and the PA system (players can speak over the building PA by holding a button; everyone in the building hears it, so can animatronics, which is a deliberate trade-off).

Role: the office is optional but powerful. A team that leaves one player "on cams" can call out animatronic positions to the others over walkie-talkie, open and close security shutters elsewhere in the building remotely (Part 3.17 lists them), and play lures. But the office is a dead end with two doors, and an office player who lets their attention slip gets caught, just like the original. This creates a natural role: one "guard on duty" and up to three "runners". It's never required; teams can ignore the office entirely and run blind.

Hiding spots: under the desk (crouch hide, decent; animatronics check under the desk only if they saw you go in).

Phone: rings at 12:05 AM with the night's call. Answer by interacting. Any player within 6 m hears it in full; walkie-talkie carriers hear it through their radio.

Items: the Faz-Pad tablet (one per night, on the charging dock; Part 4.12), the Security Office keycard (in a desk drawer, Night 2+).

Threats: animatronics approach the office doors in the classic way when someone is inside; when no one's inside they ignore it.

Sound: the fan, the hum of the monitors, the iconic distant footsteps, breathing at the door when an animatronic waits outside.

Secret: honk the nose. Also, sitting in the chair and pressing the light buttons in the pattern left-right-left-left-right plays a short, original eight-note jingle and shows a camera feed of the stage with all four animatronics looking straight into the camera.

### 3.7 Z09 West Hall and West Corner

Layout: a 4 m wide hallway running north-south (X 14 to 18, Z 26 to 50) from the Dining Hall's south-west exit down to the West Hall Corner, which bends east into the Security Office's west door. Checkerboard tiles, confetti wall pattern on the lower half, beige above, posters every few metres ("Celebrate!" band poster, a safety rules poster, "Lets Eat!" poster), newspaper clippings framed on the wall (Part 7.6), a children's drawing board, a pay phone (dead), a water fountain. Doors: the Party Room Hall branches east at Z 34; the Supply Closet has a back door into the hall at Z 44; Pirate Cove's side curtain opens onto the hall's north end, which is Foxy's sprint lane.

Light: three ceiling fluorescents on the West Hall circuit; when restored, one of them buzzes and flickers permanently (a recognisable landmark).

Hiding spots: a "wet floor" sign cupboard (one player), behind a stack of folded tables (crouch, partial), and the corner itself has a coat-hook alcove (stand still in the dark, works only if the hall lights are off and your flashlight is off; a pure stealth spot).

Security camera: CAM 2A covers the hall from the north end, CAM 2B covers the corner, with the band poster in frame (Golden Freddy's poster easter egg, Part 6.6).

Threats: Foxy's sprint path runs from the Cove down the full length of the West Hall to the Security Office's west door. If a player is in the hall when Foxy sprints, he goes for them. Closing the security door, ducking into the Party Room Hall, or hiding stops him. Bonnie also comes this way.

Sound: the buzzing fluorescent, Foxy's running footsteps echoing down the length of the hall, a pirate humming from the Cove.

### 3.8 Z10 East Hall and East Corner

Layout: mirror of the West Hall on the east side (X 30 to 34, Z 26 to 50), from the Dining Hall's south-east exit to the East Corner and the Security Office's east door. Doors: the Restrooms (east side at Z 30), the Kitchen's front swing doors (east side at Z 38), the Manager's Office front door (west side at Z 42, also reachable from the Utility Corridor side).

Light: East Hall circuit, three fluorescents, one dead.

Hiding spots: a janitor's cart (crouch beside it, partial), a supply cabinet (one player), and the Restrooms are right there.

Security camera: CAM 4A covers the hall, CAM 4B the corner (with a poster that occasionally changes to unsettling versions, Part 9.4).

Threats: Chica and Freddy's main route to the Security Office. Chica uses this hall to move between the Kitchen and the Dining Hall.

Sound: kitchen clatter bleeding through the swing doors, restroom drips and a running toilet.

### 3.9 Z02 Dining Hall (the hub)

Layout: the heart of the building, 34 × 26 m (X 16 to 50, Z 6 to 32), with a 5 m ceiling and exposed black trusses hung with paper streamers and star cut-outs. Eight long party tables in two rows of four, each with paper tablecloths, party hats, plates, cups and a centrepiece balloon; an empty cupcake plate sits at the centre of each of the five "birthday tables" (the delivery points for the cupcake objective, marked with a star-shaped table card). A checkerboard dance floor in front of the stage. A salad bar (unused, covered with a sheet), a soda fountain, high chairs stacked against a wall, a giant "Happy Birthday!" banner, a hanging disco ball (rotates and scatters light dots when the Dining circuit is on), arcade glow spilling in from the north-east.

Connections: north to the Lobby (Z01) through a wide archway; north-west to the Prize Corner (Z05); north-east to the Arcade (Z06); east to the Show Stage (Z03) which occupies the east wall; west to Pirate Cove (Z04) on the west wall; south-west to the West Hall; south-east to the East Hall; south centre to the Kids' Play Zone (Z07) through a colourful arch.

Light: the Dining circuit controls twelve pendant lamps and the disco ball. Until it's restored, the only light is the arcade glow and red emergency lights on the walls, so the dining hall is a huge dark space where flashlight beams can't reach the far side. Restoring it is one of Night 1's objectives and changes the whole feel of the building.

Hiding spots: under any of the eight tables (crouch hide; tablecloths reach the floor on three sides, giving decent cover, but you can be seen from the open side), behind the salad bar sheet (one player, good), inside the high-chair stack (no, that's silly; use a stage-side equipment case instead: a large road case near the stage, one player).

Security camera: CAM 1B, high on the north wall, covering the whole hall.

Main zone light switch: the Dining Hall's breaker sub-panel is on the north wall by the Lobby arch. Once the main power is on (Part 5.2), a player flips the Dining switch here.

Threats: every animatronic passes through the Dining Hall. It's the most dangerous open space. Its size means you can see threats coming when it's lit and can't when it's dark.

Sound: a large hall reverb, streamers rustling in the HVAC draught, the faint hum of the soda fountain, the disco ball's motor when lit.

### 3.10 Z03 Show Stage and Stage Booth

Layout: a raised stage (1.0 m high) along the east wall of the Dining Hall (X 50 to 66, Z 10 to 18), 16 × 8 m, with steps at both ends, a star-pattern backdrop, red velvet curtains on a motorised track (open/close from the booth), speaker stacks, a drum kit, a microphone stand, a "Freddy Fazbear's Pizza" sign in neon above it. Behind the backdrop, a narrow backstage passage leads to the Stage Booth (a small control room, 4 × 4 m, X 62 to 66, Z 18 to 22) with a mixing desk, light board, stage curtain controls and a hatch in the floor to the Stage Crawlspace (C). A door from the booth leads south into Backstage (Z14).

Animatronic starts: Freddy, Bonnie and Chica stand on the stage at the start of every night, in their FNAF 1 poses. Bonnie leaves first, then Chica. Freddy stays until Night 3.

Stage Booth systems: the light board can switch the stage lights (the Stage circuit) and the spotlight; the mixing desk plays the "Showtime" audio lure through the stage speakers (Part 5.6), which pulls nearby animatronics back toward the stage for 30 seconds (90-second cooldown); the curtain control opens and closes the curtains (when Freddy is on stage, closing the curtain hides him from view, which, given his rule, lets him move; players will learn that the hard way).

Light: Stage circuit: three coloured spotlights (red, blue, amber) and the neon sign. When off, the stage is a black void with three sets of eyes glinting.

Hiding spots: behind the stage curtain bunched at either side (one player each, good), inside the drum kit's bass drum road case (one player, small, Night 2+ secret), and the crawlspace hatch itself.

Security camera: CAM 1A, the iconic show stage view from the dining hall side.

Threats: Freddy (stage start), and anyone returning to the stage when the lure plays.

Sound: the neon sign's buzz, a faint hiss from the speakers, servos ticking when the animatronics are on stage, the occasional head twitch (a clack).

Secret: grabbing the microphone on the stand and holding the interact key "sings" into it: your voice (if you have proximity voice on) plays through the stage speakers at the cost of attracting every animatronic within 30 m. Pure chaos. Friends will do this constantly.

### 3.11 Z04 Pirate Cove

Layout: a small curtained stage (8 × 6 m, X 8 to 16, Z 14 to 20) set into the Dining Hall's west wall, with purple star-patterned curtains, a "SORRY! OUT OF ORDER" sign on a stand, a ship's wheel prop, a treasure chest, a fake palm tree, ropes and netting. A side curtain on the south edge opens straight onto the north end of the West Hall (Foxy's sprint lane). A floor hatch leads into the Stage Crawlspace.

Animatronic start: Foxy, behind the curtains.

Foxy's stages are visible here and on CAM 1C exactly like FNAF 1: curtains closed; curtains parted with Foxy peeking; Foxy stepping out with his hook raised; empty with the sign showing. Players can walk right up to the cove and pull the curtain aside themselves (risky: if Foxy's at stage 2 or higher and you open the curtain, he lunges, and you have about 0.8 seconds to back off before a catch).

Light: a single purple-tinted spotlight on the Cove circuit.

Hiding spots: the treasure chest (one player, crouch in, lid closes; Foxy never checks his own chest, the other animatronics do).

Security camera: CAM 1C.

Sound: a sea shanty hum (original melody), creaking rope, the flap of the curtain in the draught.

### 3.12 Z05 Prize Corner (the music box)

Layout: 12 × 10 m (X 16 to 28, Z 0 to 10), north-west of the Dining Hall. A glass prize counter with plush toys and toys on shelves behind it, a ticket redemption machine, a giant stuffed bear, balloon racks, and in the centre of the back wall the Puppet's gift box: a 1.4 m cube wrapped in striped paper with a big bow, sitting on a low platform. Next to it on a pedestal is the music box: an ornate mechanical box with a large brass crank handle on its side (the "thing you retwist"). A small wall gauge above it shows how wound the box is (a brass dial with a needle from 0 to 100).

Light: the Prize Corner has its own small circuit that's always powered (a dim pink-tinted neon "PRIZES" sign and two warm spotlights on the gift box). It's one of the few lit places at night start, which makes it a magnet and a landmark.

The music box mechanic: Part 5.5. In short: it unwinds over the night; any player standing at the pedestal can hold the interact key to crank it (a first-person animation of two hands turning the crank, the gauge needle rising, clicking ratchet sounds, the melody speeding back up to normal). If it hits 0, the Puppet emerges.

Hiding spots: behind the prize counter (crouch, good), inside the giant stuffed bear's base (a hollow display stand, one player, Night 3+ only after the bear tips over during an event), and under the balloon rack (weak).

Security camera: CAM 8, with a view of the gift box and the gauge, so the Security Office player and anyone with the Faz-Pad can wind the box remotely (at 40% speed).

Sound: the music box melody ("Pop Goes the Weasel", synthesised, public domain), which slows and detunes as the box unwinds; the ticket machine's idle jingle (an original 4-note chime every 90 seconds); a balloon squeaking against another.

Secret: wind the box all the way to 100% three times in a single night and the gift box lid lifts an inch, and a pair of white eyes looks out, then it closes. No harm. Achievement "Peekaboo".

### 3.13 Z06 Arcade

Layout: 14 × 12 m (X 36 to 50, Z 0 to 6 plus a larger L into X 50 to 62, Z 0 to 10), north-east of the Dining Hall. Twelve upright arcade cabinets in two rows with glowing attract screens (procedurally generated pixel-art attract loops of original fake games: "Pizza Panic", "Star Pilot", "Bunny Hop", "Cove Quest"), a claw machine full of plushes, two skee-ball lanes, a photo booth with a curtain, a change machine, a carpet with a cosmic pattern that glows under blacklight.

Light: the Arcade circuit is powered at night start (the cabinets' screens and a blacklight strip), giving the room a purple-blue glow that's visible from the Dining Hall. Cabinet screens cast moving coloured light on the floor and walls (Part 11).

Hiding spots: behind any arcade cabinet in the gap between it and the wall (two of the cabinets have a usable gap, one player each, good), the photo booth (one player, curtain closes; the booth flashes and takes a photo if an animatronic opens the curtain, saving a "last photo" image for the player's profile, which is a wonderful bit of dark comedy), under the skee-ball lanes' ball return (crawl, one player).

Items: tokens spawn in the change machine tray and the skee-ball ticket slots (used in the vending machine and the claw machine), a battery spawn.

Security camera: CAM 9 (arcade).

Threats: the arcade's light and noise attract Balloon Boy on later nights. The cabinets' sounds mask animatronic footsteps, which is scary.

Sound: chiptune attract loops (original, quiet), the claw machine's motor, the low hum of CRTs, the skee-ball ramp's rattle when a ball rolls (a player can roll a ball for fun and a noise lure).

Secret: winning the claw machine (a fair, skill-based mini interaction: move the claw with WASD, drop with E; 1 in 6 skilled drops succeed) gives a plush in your inventory. Each plush is a collectible (Part 9.5). The golden plush has a 1% chance and unlocks the "Golden Claw" cosmetic.

### 3.14 Z01 Front Entrance & Lobby

Layout: 18 × 10 m (X 24 to 42, Z 0 to 6, extended by a windowed vestibule north of the building line), the public front. Double glass front doors with push bars, chained and padlocked from inside with a sign "CLOSED: SEE YOU TOMORROW!". Through the glass, players see the rain-soaked parking lot, a single sodium street light, and the restaurant's big rotating sign outside. A ticket and hostess counter, a coat check, a merch shelf with plush and T-shirts, a framed "Employee of the Month" wall (the photos are of the four players' guard models, rendered from their current skins, which is a fun personal touch), a "You Are Here" wall map of the whole ground floor (Part 3.19), a gumball machine, and a kids' height chart ("You must be this tall to party!").

Light: emergency only: the green EXIT signs above the doors and the sodium light from outside casting window shadows across the floor (moving rain streaks via a projected texture, Part 11).

The early exit: the padlock on the front doors opens at 5 AM if all required objectives are complete (Part 5.9). A big satisfying chain-drop sound plays through the whole building.

Hiding spots: behind the hostess counter (crouch, good), the coat check (stand among the coats, one player, good).

Security camera: CAM 10 (lobby).

Sound: rain against the glass, the buzz of the outside sign, a car passing by occasionally with headlights sweeping through the windows (an ambient beat that briefly lights the lobby; sometimes it reveals a silhouette that wasn't there before).


### 3.15 Z07 Kids' Play Zone

Layout: 16 × 14 m (roughly X 18 to 30, Z 32 to 46; it sits between the two halls, north of the Security Office), entered from the Dining Hall through a rainbow arch. A two-storey soft-play structure fills most of it: padded platforms, cargo nets, a spiral slide, and a network of clear and coloured plastic play tubes running at 1.5 m and 2.8 m heights. A big ball pit (5 × 5 m, 0.8 m deep) sits at the slide's exit. Shoe cubbies by the entrance, a parents' bench, a mural of the four mascots holding hands.

Play tubes as routes: the tubes are crawlable by players (0.75 m diameter, crawl speed) and form a loop through the structure with exits at the ball pit, the slide top, a high window that looks out over the Dining Hall, and, critically, a maintenance panel at the back that connects to the main vent network. So the Play Zone is both a hiding playground and a secret route to the vents. Larger animatronics can't enter the tubes; small ones (Balloon Boy, the Bidybabs, Minireenas) can.

Light: Play Zone circuit: coloured LED strips along the tubes and two overhead lamps. When off, the tubes are lit only by flashlights and look terrifying from inside (claustrophobic, coloured plastic glow).

Hiding spots: the ball pit (crouch in and sink: the player's camera goes under the balls, everything goes muffled and dark-coloured, a breath meter runs; while submerged you're almost invisible, but an animatronic wading through the pit can bump into you; a great signature hiding spot), inside the play tubes (count as hidden from large animatronics), under the slide (crouch, weak).

Security camera: CAM 11 (play zone), with a view of the ball pit.

Threats: Balloon Boy lives here on later nights. Big animatronics circle the structure and wait at tube exits.

Sound: ball pit balls shifting and clattering when anyone moves, the squeak of plastic tubes, a faint recording of children laughing that triggers randomly (ambient scare).

Secret: in the ball pit, a single gold ball. Finding it (it's at a random position each night, glints when a flashlight hits it) unlocks a cosmetic and plays the cheer sound.

### 3.16 Z08 Party Room Hall and Party Rooms 1 to 4

Layout: a 3 m wide hall branching east off the West Hall (it runs east from the West Hall at Z 34, along the north edge of the party rooms) with four party rooms off it, each 7 × 7 m. Each room has a theme: Party Room 1 "Space Party" (planets hanging from the ceiling, star wallpaper), Party Room 2 "Pirate Party" (ship mural, a plank prop), Party Room 3 "Princess Party" (castle cardboard props, pink balloons), Party Room 4 "Spooky Party" (left decorated from a Halloween party: cobweb decorations, plastic pumpkins, a fake coffin prop; it's eerie even before anything happens). Each has a long table set for a party, a gift pile, a closet, and an "employees only" door to the Utility Corridor (Party Rooms 2 and 4 only).

Light: Party circuit, one lamp per room plus string lights.

Hiding spots: each room's closet (one player), under each party table (crouch, decent), Room 4's coffin prop (one player, lid closes, the best hiding spot in the building; animatronics always check it last), Room 3's cardboard castle (crouch behind, partial).

Objectives: Party Rooms 1 and 3 each contain one of the five cupcake birthday tables on some nights (the delivery point set rotates per night, Part 5.4).

Security camera: CAM 12 covers the Party Room Hall; there are no cameras inside the rooms (they're blind spots, which makes them good to hide in and dangerous to enter).

Sound: balloons bobbing against the ceiling, a party popper going off on its own (rare ambient scare), paper streamers rustling.

### 3.17 Z11 Restrooms

Layout: off the East Hall (X 34 to 46, Z 26 to 36), a men's, a women's and an accessible restroom, each with its own door, sharing a short corridor. Men's and women's each have three stalls, sinks and a long mirror, a hand dryer, a baby-changing station. White tiles with grout grime, a cold blue-green fluorescent.

Light: Restroom circuit.

Hiding spots: each stall (stand on the toilet seat inside a stall with the door locked; animatronics see feet under the door if you're standing on the floor, so players learn to crouch-jump onto the seat; a lovely detail to implement: hiding in a stall has two states, "standing" (visible feet) and "perched" (no feet, costs stamina over time)), the accessible restroom (lock the door for 20 seconds, like the staff toilet).

Security camera: CAM 7 (restroom corridor only, not inside).

Threats: Chica and Freddy pass by. Mirror events (Part 9.4).

Sound: dripping taps, a running toilet, the hand dryer turning itself on (ambient scare, also a noise lure players can trigger deliberately).

Secret: in the women's restroom mirror, if you turn off your flashlight and stand still for 10 seconds in the dark, a shadowy figure appears behind you in the mirror reflection only (a simple trick with a second camera rendering a reflection plane), then vanishes when you turn around.

### 3.18 Z12 Kitchen

Layout: 16 × 12 m (X 34 to 50, Z 38 to 50), entered from the East Hall through double swing doors with porthole windows, and from the Utility Corridor through a back door. Stainless steel everything: a central prep island, two pizza ovens, a fryer station, a big range with hanging pots and pans, shelves of ingredients, a dish pit with a sink full of dishes, a cupcake decorating station with five cupcake stands, a pantry (4 × 3 m, walk-in shelving), and a walk-in freezer (4 × 4 m) with a heavy door and a plastic strip curtain inside.

The cupcakes: at night start, five cupcakes sit on the decorating station (Night 1 to 2: five ready-made cupcakes; Night 3+: players must first take cupcake trays from the pantry and put them in the oven for 30 seconds, while the oven's noise attracts Chica). Part 5.4 has the full objective.

Light: Kitchen circuit: harsh overhead fluorescents. While the power's out, a red emergency light over the back door bathes the kitchen in red, and the ovens' pilot lights glow blue.

Hiding spots: the walk-in freezer (enter and close the door: one or two players; while inside, a cold meter rises, players' breath fogs visibly, and after 40 seconds you start taking "frost" (vision blurring and slower movement) until you leave; animatronics check the freezer if they saw you enter), the pantry (crouch behind shelves, partial), under the prep island (crouch, weak), inside a lower cabinet under the range (one player, good, small).

Security camera: CAM 6 is disabled, audio only, like FNAF 1. The Faz-Pad and office monitors show "CAMERA DISABLED: AUDIO ONLY" and play the kitchen's sound live. Players at the office can hear Chica in here.

Threats: Chica's home turf. She spends long stretches here "eating" (clattering pans), and she's drawn to the oven's noise and to anyone carrying cupcakes.

Sound: the fridge and freezer compressors, the hum of the extractor fans, pots swinging and clinking, Chica's eating sounds, a dripping tap.

Secret: the pizza oven has a "pizza" interaction: put a pizza dough from the pantry into the oven, wait 60 seconds, and take out a pizza; delivering it to the stage makes all animatronics on stage look at it for 20 seconds. A distraction tool for clever players.

### 3.19 Z14 Backstage

Layout: 12 × 8 m (X 54 to 66, Z 22 to 30) behind the Show Stage, reached from the Stage Booth (north), the Utility Corridor (south) and Parts & Service (east). A workbench along one wall with tools, wires and a vice; a table with a bare endoskeleton lying on it; shelves of spare animatronic heads (a Freddy head, two Bonnie heads, a Chica head, all with empty eye sockets, facing the door); costume parts hanging on hooks; a parts bin full of eyes. One bare bulb on a cord, swinging slightly.

Light: Backstage circuit: the single swinging bulb, which casts moving shadows of the heads across the walls (Part 11.4).

Hiding spots: a tall costume rack (stand among hanging costumes, one player, good, but there's a 1 in 20 chance per use that one of the "costumes" next to you is an animatronic in standby, which twitches; a pure scare, harmless), under the workbench (crouch, decent), the crawlspace hatch to the Stage Crawlspace.

Objectives: the "Parts Run" side task (Part 5.7) needs a spare part from here.

Security camera: CAM 5 (backstage), where Bonnie sometimes stands staring straight into the lens.

Threats: the endoskeleton on the table is a rare event threat (Endo-01, Part 6B): it sits up on Night 4+ if the power usage is high.

Sound: the bulb's cord creaking, the heads' eyes clicking as they slowly track the player (yes, they do; their eyes follow you, it's harmless and horrible), wires sparking at the workbench.

### 3.20 Z15 Parts & Service

Layout: 14 × 10 m (X 66 to 80, Z 20 to 30), east of Backstage. A long, low-ceilinged storeroom where retired animatronics are stored: the Withered versions of the cast slumped against the walls under dust sheets, a pile of torn costumes, crates labelled "SPRINGLOCK: DO NOT OPERATE", a broken animatronic hand on the floor, and Fuse Box 2 on the north wall (the East circuits). A ceiling vent grille above a shelving unit (climb the shelf to reach it).

Light: Parts circuit: two caged bulbs, one of which sparks and cuts out every 20 to 40 seconds.

Hiding spots: under a dust sheet among the withered animatronics (crouch under a sheet, one player; animatronics hunting you sweep the sheets, and on Night 5+ one of the "withered animatronics" may not be inactive), behind the crates (crouch, good).

Threats: on Nights 4+ the Withered characters can activate as extended-roster threats if Custom Night or Night 6 rules enable them.

Security camera: CAM 3.

Sound: electrical buzzing and sparking from the faulty bulb, a dripping leak, dust sheets rustling, a creaking sound that seems to come from inside a crate.

### 3.21 Z17 Manager's Office

Layout: 6 × 6 m (roughly X 36 to 42, Z 50 to 56, between the East Hall and the Utility Corridor). A desk with a computer (a terminal the players can use, Part 5.8), a filing cabinet, a wall safe behind a framed photo, a cork board with schedules, a coat stand, a fish tank with no fish, a window into the East Hall with half-closed blinds. Door locked at night start: needs the Manager's keycard from the Security Office (or a lockpick item and 8 seconds of noisy picking).

Light: Office circuit: a desk lamp and an overhead light.

Hiding spots: under the desk (crouch, decent), behind the filing cabinet (one player, partial).

Items: the safe holds the night's Faz-Tape (lore cassettes, Part 7.5) and a key item for some nights (the Basement key on Night 4); its code is a 4-digit number found somewhere else in the building each night (written on a sticky note, a whiteboard, the back of a poster, randomised from a list of locations). The filing cabinet contains a staff file per player (fun detail: a "personnel file" showing the player's display name and stats).

Sound: the fish tank's bubbler, a ticking wall clock that's always wrong, the computer's fan.

### 3.22 Z18 Supply Closet

Layout: 4 × 5 m (X 18 to 22, Z 40 to 45), between the West Hall and the Party Room area, doors to both. Shelves of cleaning supplies, light bulbs, batteries, a fuse drawer, a mop bucket, a ladder.

Hiding spots: behind the door when it's open (classic, weak), the large mop sink cabinet (one player, decent).

Items: the most reliable spawn for batteries (always 2) and fuses (always 1 to 2, Part 5.3). It's the first place experienced players run to.

Security camera: none, but CAM 2A sees its west door.

Bonnie's haunt: in tribute to FNAF 1's Bonnie in the supply closet, Bonnie sometimes stands motionless in here in the dark. Opening the door to find him a metre away is one of the game's signature scares. Close the door and back off; he's slow to react when in "closet idle" (1.5 seconds before he gives chase).

### 3.23 Z20 Loading Dock

Layout: 12 × 10 m (X 50 to 62, Z 50 to 60) at the east end of the Utility Corridor. A raised concrete dock with a large roller door (locked, rattles in the wind, rain streams under it), a pallet jack, stacked crates and pizza flour sacks, a delivery cage, a forklift charger, a small dock office with a window.

Light: Dock circuit: two sodium floodlights (orange) and a strobe beacon that rotates when the dock's systems are on.

Hiding spots: inside the delivery cage behind sacks (one player, partial), the dock office (lock the door 20 seconds), between crate stacks (crouch, good).

Objectives: the backup generator's heavy battery sits here on a charging cart (Part 5.2: a large object one player carries in both hands down to the Boiler Room; carrying it is slow and loud, so teammates should escort).

Sound: rain hammering on the roller door, wind gusting, the strobe's motor, a pallet creaking.

### 3.24 Basement: B01 Stairwell & Basement Hall

Layout: a concrete stairwell from the Utility Corridor (X 30, Z 56) down 4.5 m in two flights to a long, low basement hall (3 m wide, 2.6 m ceiling, X 20 to 50, Z 52 to 55 at Y = -4.5). Exposed pipes everywhere, puddles, a flickering caged bulb every 6 m (on the Basement circuit), painted pipe labels ("STEAM", "WATER", "GAS: DO NOT TOUCH"), wall-mounted junction boxes, a fire door at each end.

Connections: Breaker Room (B02), Boiler Room (B03), Old Storage (B04), Camera Server Room (B06), Maintenance Tunnel (B05).

Light: completely dark until the Basement circuit is restored. Only flashlights and the red glow of the Breaker Room's status panel at the far end.

Hiding spots: a pipe alcove behind a water heater (crouch, good), a utility cupboard (one player).

Sound: dripping, pipes groaning, steam hissing, a deep machine hum, and the stairwell's echo carrying sounds from the ground floor down with a delay.

Threat note: the basement is a cul-de-sac with a single stair connection plus the Maintenance Tunnel loop and one vent shaft. Being caught here alone is dangerous. That's why the most important objective of every night lives here.

### 3.25 B02 Breaker Room (the main power)

Layout: 8 × 8 m (X 20 to 28, Z 44 to 52, Y = -4.5). A huge wall-mounted main breaker panel with a master lever and twelve circuit breakers labelled by zone, a power meter display (analogue needles plus a seven-segment readout of total building power), a backup battery bank (wall of car-battery-like cells with status LEDs), cable bundles running into the ceiling, warning signs ("HIGH VOLTAGE"), a rubber mat, a fire extinguisher, a workstation with a clipboard of breaker instructions.

The main power puzzle: Part 5.2.

Light: the panel's status LEDs (red when circuits are off, green when on), and once the main breaker is up, a single overhead fluorescent.

Hiding spots: behind the battery bank (crouch, one player, decent).

Sound: a deep electrical hum that changes pitch with power usage, crackling arcs when a breaker trips, the clunk of the master lever, relays clicking.

Visual showcase: this room is where the electrical detail should shine: arcing when breakers trip (Part 11.6), sparks, cable runs, LEDs. The owner specifically wants "the electrical and everything in between". This is that room.

### 3.26 B03 Boiler Room

Layout: 12 × 10 m (X 32 to 44, Z 42 to 52, Y = -4.5), with a two-level layout: a lower floor with a giant boiler, a backup diesel generator, pumps and valves, and a metal catwalk at 2 m height around three sides reached by a ladder, with a vent grille at the catwalk's end leading into the vent network (an escape route out of the basement).

Backup generator: Part 5.2. It needs the heavy battery from the Loading Dock, then a pull-cord start (a timing interaction: pull at the right moment on a rhythm meter, 3 successful pulls; failed pulls make a loud bang that alerts animatronics within 25 m).

Light: Boiler circuit: the boiler's furnace window glows orange through its grille (always), two caged bulbs.

Hiding spots: behind the boiler (crouch, good, hot: a heat meter like the freezer's cold meter, but lasts longer), the catwalk's shadowed corner (stand still, stealth spot).

Hazards: steam vents burst on a cycle from cracked pipes along one walkway (visible jets, players caught in one take a brief "scalded" stagger and yelp loudly; animatronics walk through them). Players learn the cycle.

Sound: the boiler's roar, steam hisses, the generator's diesel rumble once running, pipes knocking.

### 3.27 B04 Old Storage (Fredbear's Room)

Layout: 10 × 10 m (X 8 to 18, Z 40 to 50, Y = -4.5) at the basement's west end, behind a padlocked fire door (key needed, Night 4 objective). Inside: the remains of an older, original diner: a faded "Fredbear's Family Diner" sign (in original mode, "Barnaby's Burger Barn"), an old, smaller stage, a golden bear head on a stand, a golden rabbit suit slumped in the corner (springlock warnings on it), old arcade machines unplugged, boxes of 1980s photographs, a reel-to-reel tape player, cobwebs everywhere.

Light: none, ever. Flashlights only. A single shaft of light from a grate in the ceiling if the Dining Hall lights above are on.

Hiding spots: inside an old arcade cabinet shell (one player).

Threats: Golden Freddy (Part 6.6) manifests here more often than anywhere else. The golden rabbit suit is a Springtrap-inspired hazard on Custom Night.

Objectives: Night 4's lore objective (find the tape in the reel-to-reel and play it) and Night 5's final secret (Part 9.4).

Sound: almost nothing. A faint music box that isn't the Prize Corner's. Breathing that might be your own.

### 3.28 B05 Maintenance Tunnel

Layout: a 2.5 m wide, 2.2 m high concrete tunnel (X 8 to 44, Z 30 to 32, Y = -4.5, plus connectors) running under the Dining Hall, forming a loop from the basement's west end (near Old Storage) to the Boiler Room, with a ladder up to a floor hatch in the Supply Closet and a ladder up to a floor hatch in the Stage Booth. It's the "back route" across the whole building.

Night 4+ flooding: a burst pipe floods the tunnel's middle section to 0.6 m deep. Wading is slow (60% speed) and very loud (splashing), and your flashlight reflects off the water. The water also hides things: an animatronic can stand submerged in the deep section with only its eyes above water.

Light: none, except emergency strip lights on the Basement circuit.

Hiding spots: two side alcoves (stand in the dark), a drainage culvert (crawl, one player).

Sound: dripping, rushing water on flooded nights, echoing footsteps that could be yours or not.

### 3.29 B06 Camera Server Room

Layout: 6 × 6 m (X 44 to 50, Z 44 to 50, Y = -4.5). Racks of humming equipment, tape recorders, a wall of small monitors showing every camera, cooling fans, a reset terminal.

Systems: the camera system's brain. When cameras fail (Part 5.7), someone must come here and run a reboot at the terminal (hold interact for 8 seconds, with a progress bar on the terminal screen). The wall of monitors also lets anyone here view all cameras at once, like a mini Security Office.

Light: its own circuit: monitor glow and LED racks.

Hiding spots: between two server racks (stand, one player, partial).

Sound: fans whirring, hard drives clicking, a high-pitched electronic whine.

### 3.30 C: Stage Crawlspace

A 1.0 m high crawlspace under the Show Stage and Pirate Cove (X 8 to 66, Z 12 to 20, Y = 0 to 1.0 beneath the stage platforms; route it beneath the dining floor as a narrow 0.9 m duct between the two stages), with hatches in the Stage Booth, Backstage and Pirate Cove. Crawl only. Dusty, cobwebs, old cables, dropped toys, a rat skeleton. Lit only by flashlight and thin slits of light through the stage floorboards above (if the stage lights are on, light stripes pour down; if an animatronic walks on the stage above you, you see its shadow pass across the slits and dust falls). A brilliant tension space. Large animatronics can't enter; Foxy can reach in through the Pirate Cove hatch with his hook (a catch attempt if you're within 1.5 m of that hatch while he's in the Cove).

### 3.31 V: The vent network

The vents are a full second layer of the map. They let players move between zones unseen and escape chases, at the cost of speed (crawl speed 1.4 m/s) and noise (crawling on metal is loud: every movement makes a metallic thunk with a noise radius of 6 m, audible to animatronics below).

Layout: two trunks and many branches. The West Trunk runs north-south above the West Hall from the Employee Lounge to the Prize Corner, with branches to the Supply Closet, the Party Room Hall, Pirate Cove and the Security Office ceiling. The East Trunk runs north-south above the East Hall from the Kitchen to the Arcade, with branches to the Restrooms, the Manager's Office, Backstage, Parts & Service, and the Lobby. A Cross Duct connects the two trunks above the Dining Hall (with a grille in the ceiling you can look down through at the hall below: a great spying spot). A Vertical Shaft drops from the Utility Corridor ceiling to the Boiler Room catwalk (with a ladder; the only vent route in and out of the basement). The Play Zone's tubes connect to the Cross Duct through a maintenance panel.

Grilles: every vent entrance is a grille that players open with interact (1 second, a clank). Floor-level grilles are directly accessible; ceiling grilles need a climbable prop below (a shelf, a stool, a crate). Grilles can be closed from inside the vent to block pursuers who can fit in vents; a closed grille holds for 6 seconds against a small animatronic.

Junctions: vent junctions are slightly larger cubes where two players can pass each other. At three junctions, a wall-mounted vent control panel is reachable from inside: Ventilation Reboot (Part 5.7) can be done here as well as from the Server Room.

Vent threats: small and vent-capable animatronics move through vents (Part 6B lists them). In the vents you hear them coming as metallic banging growing closer, and you see their eyes down the duct in your flashlight. Vents are safe from the big four (Freddy, Bonnie, Chica, Foxy can't enter), which makes vents the classic emergency escape on Nights 1 to 3. On Night 4+, some vent threats join, so vents stop being totally safe.

Vent map: the paper map item doesn't show vents. Players must learn them or find the "Vent Schematic" item (a blueprint in the Server Room) that adds vents to their paper map for that night.

Rendering: duct interiors are galvanised metal with seams, rivets, dust and occasional grilles letting in light stripes from rooms below. Your flashlight beam bounces off the metal (a nice cheap specular effect). Inside a vent, the player camera is at 0.45 m height, the FOV narrows slightly, and breathing is louder.

### 3.32 Security doors and shutters

Besides the two Security Office doors, five power-driven steel shutters sit at chokepoints, each controllable from the Security Office wall panel and from a wall button next to the shutter: S1 between the Dining Hall and the West Hall; S2 between the Dining Hall and the East Hall; S3 at the Utility Corridor's midpoint (cutting back-of-house in half); S4 at the top of the basement stairs; S5 between the Kitchen and the Utility Corridor. A closed shutter blocks everyone (players and animatronics) and drains power while closed (as a door does in FNAF 1). Shutters take 1.2 seconds to drop and 1.5 seconds to rise. Clever teams use them to trap an animatronic in a section or seal off a teammate's pursuer. Dropping one on a player's head doesn't hurt them (it stops at 1.8 m and won't close while a player stands under it).

Regular doors (swing doors, office doors, room doors) can be opened, closed and held. Animatronics open regular doors (slowly, with a creak; Foxy smashes through). A player holding a closed door (stand against it and hold interact) delays a non-Foxy animatronic by 3 to 5 seconds before it forces through and staggers the player. Locked doors need keys or keycards.

### 3.33 Security cameras (full list)

| Cam | Location | Notes |
|---|---|---|
| 1A | Show Stage | Classic stage view |
| 1B | Dining Hall | Whole-hall view |
| 1C | Pirate Cove | Foxy's stages |
| 2A | West Hall | Foxy's sprint lane |
| 2B | West Corner | Golden Freddy poster |
| 3 | Parts & Service | |
| 4A | East Hall | |
| 4B | East Corner | |
| 5 | Backstage | Bonnie stare |
| 6 | Kitchen | Audio only |
| 7 | Restroom corridor | |
| 8 | Prize Corner | Music box gauge visible, remote winding |
| 9 | Arcade | |
| 10 | Lobby | |
| 11 | Play Zone | |
| 12 | Party Room Hall | |
| 13 | Utility Corridor | |
| 14 | Loading Dock | |
| 15 | Basement Hall | |
| 16 | Breaker Room | Shows the panel state |

Each camera is a physical object in the world (a little dome or box camera with a red blinking LED). Players see them on the walls. Animatronics walking past occasionally look up at the camera. Cameras can be broken by some threats on later nights (Part 6B), going to static until the camera system reboots.

### 3.34 Hiding spot catalogue (behaviour rules)

All hiding spots share one system (`HidingSpotDef`) with these properties: `type` (locker, under_table, closet, stall, cabinet, chest, ball_pit, curtain, costume_rack, freezer, cart, coffin, booth, stealth_alcove, sheet), `capacity` (1 or 2), `cover` (0 to 1: how well it hides; under-table 0.6, locker 0.9, coffin 1.0, stealth alcove 0.5 but only in darkness), `enterTime` and `exitTime` (0.6 to 1.2 seconds with an animation), `viewMode` (slats, gap, underwater, curtain, dark), `hazard` (none, cold, heat, breath), `checkPriority` (how likely an animatronic searching the area is to check it; lockers and closets high, coffin low), and `exitPoints` (where you pop out, sometimes two sides).

Rules: entering a hiding spot while an animatronic can see you makes it go straight to that spot and check it (you've been seen; get out the other side or accept your fate). Entering unseen means the animatronic has to find you through searching (Part 6.4). While hidden, you can hold breath (Part 4.8) to reduce your noise to zero for up to 8 seconds; then you gasp loudly. Being found in a hiding spot is a catch (the animatronic yanks the door open or lifts the sheet, and the jumpscare plays from that angle, which should be bespoke-looking per hiding type: locker door ripped open, table flipped, curtain torn aside).

### 3.35 Navigation aids and landmarks

Wall maps ("You Are Here") stand in the Lobby, the Staff Entrance, the Dining Hall's south wall, the Utility Corridor and the Basement Hall. Interacting with one shows a full-screen map with your position and the zones; it marks "objectives remaining" with pins if the objective markers setting is on.

The paper map item: hold `M` to bring it up in first person (your character holds a folded paper map in both hands; you can still walk slowly). It shows the ground floor and the basement as a hand-drawn style layout, your position as a red arrow (only within lit zones or when holding a flashlight; in darkness the arrow wobbles to simulate uncertainty), teammates' positions only if they're within 15 m or carry walkie-talkies, and pins for pings.

Landmarks are written into level data so they appear on maps and can be named in quick callouts: "the stage", "the cove", "the ball pit", "the arcade", "the kitchen", "the office", "the prize corner", "the breaker room", "the boiler", "the dock", "the coffin room" (Party Room 4).

Objective markers: optional floating icons for objectives (on by default for Night 1, off by default from Night 2, toggle in settings). Diegetic first: the clipboard lists objectives, the paper map pins them.

### 3.36 Layout sanity rules

The coordinates in this part are a starting layout written by hand, so there will be overlaps and gaps. Your first job in Milestone 3 is to lay the zones out in the level data, render `docs/map.svg`, and resolve overlaps by nudging rooms while keeping the relationships (what connects to what, and roughly where things sit: front of house north, back of house south, stage east, cove west, office at the south junction of the two halls). Log the final coordinates and any changes in DECISIONS.md. The connection graph and the feel matter more than exact numbers. Walking from the Staff Entrance to the Show Stage at normal speed should take about 25 seconds; from the Breaker Room to the Prize Corner, about 45 seconds (that's the core tension distance of every night: the music box is far from the power); and the whole ground floor loop (Dining Hall, West Hall, Utility Corridor, East Hall, back to Dining) about 70 seconds.


---

## PART 4: PLAYER SYSTEMS (MOVEMENT, SENSES, TOOLS, HIDING, REVIVES)

Everything here runs in the shared simulation (`shared/src/sim/player/`), predicted on the client and authoritative on the server (Part 10.6). Numbers live in config.

### 4.1 The first-person controller

The player is a capsule: radius 0.3 m, height 1.75 m standing, 1.1 m crouched, 0.6 m crawling (vents, tubes, crawlspace). Eye height 1.62 m standing, 0.95 m crouched, 0.45 m crawling.

| State | Speed (m/s) | Noise radius (m) | Notes |
|---|---|---|---|
| Walk | 2.8 | 6 | Default |
| Sprint | 5.0 | 16 | Drains stamina |
| Crouch-walk | 1.5 | 2 | Toggle or hold (setting) |
| Crawl (vents, tubes) | 1.4 | 6 in metal vents, 2 in tubes/crawlspace | Automatic in low spaces |
| Wade (flooded tunnel) | 1.7 | 12 | |
| Carrying large object | 2.0 walk, 3.0 sprint | 10, 18 | Can't crouch or crawl while carrying |
| Masked (Freddy mask on) | 1.2 | 4 | Vision restricted |

Acceleration 18 m/s², deceleration 22 m/s² on the ground, light air control. Jump: 0.45 m hop (mainly for clearing small obstacles; jumping is loud on landing, noise 8 m). Vault: low obstacles under 1.0 m (tables, counters, the stage edge) can be vaulted with the jump key when facing them within 0.8 m (0.6 s animation, noise 8 m). Step height 0.35 m (stairs work without jumping). Slopes up to 40 degrees walkable.

Lean: hold `Q` or `E` to lean left or right 0.35 m (camera offset and 12 degree roll) without moving the capsule, for peeking around corners. While leaning around a corner, only your head is exposed to animatronic sight checks (Part 6.3), which halves detection speed.

Head bob and sway: subtle bob when walking, stronger when sprinting, disabled by the reduced-motion setting. Footstep sounds are tied to the bob's foot plants and to the surface material (tile, carpet, concrete, metal, water, ball pit, soft play).

Camera: mouse look with sensitivity, invert and smoothing settings; FOV 75 to 100 degrees (default 85). Pitch clamp ±85 degrees. Controller support is a nice-to-have, not required.

Collision: capsule versus the level's static collision (walls, props, colliders) using a BVH (`three-mesh-bvh` on the client and the same library server side, since it runs in Node). Players collide softly with each other (push apart over 0.2 s rather than blocking) so a teammate can't body-block you into an animatronic, and they never collide with animatronics' physics (catches are handled by the AI).

### 4.2 Stamina

Stamina 0 to 100. Sprinting drains 14 per second. Regenerates at 10 per second after 1.2 seconds without sprinting (6 per second while crouched or hiding, because adrenaline). At 0, you can't sprint until it reaches 25 and you hear your character panting heavily (noise radius 4 m, audible to animatronics) for 3 seconds. Energy soda: instant refill to 100 and 50% slower drain for 30 seconds. Holding breath while hidden doesn't use stamina (it has its own meter).

### 4.3 The flashlight

Every player has a flashlight equipped by default in a dedicated slot (it doesn't take an inventory slot). Toggle with `F`. It's a spotlight with a 28 degree outer cone, 22 m range, warm white, casting shadows (Part 11.4 has rendering detail and the shadow budget). The flashlight model is visible in your hand in first person and in other players' hands in third person, and its beam is visible to other players (volumetric cone), so teammates can see where you're looking.

Battery: 100%, drains 1.2% per second while on (about 83 seconds of continuous use). Battery packs (found items) restore 50%. Below 20% the beam dims and flickers; below 5% it stutters badly. A dead flashlight still works as a dim 4 m glow for 1 second when you shake it (press `F` repeatedly, the classic horror shake).

Flash focus: hold right mouse to focus the beam into a narrow 12 degree, 35 m beam that drains 3x faster. Focusing the beam on some animatronics affects them (Foxy halts for 1 second, Bonnie is briefly blinded if the beam hits his eyes from under 6 m, Withered Foxy is repelled entirely, Freddy is frozen as long as he's lit and in view, which is just his normal rule made obvious).

Light and visibility: your flashlight makes you much more visible to animatronics (Part 6.3: a lit flashlight pointing toward an animatronic within 20 m triples detection speed, and it's visible from any angle in a dark zone within 30 m). Playing with your light off is stealthier and scarier. This is the core light-vs-stealth decision.

### 4.4 Noise

Every action produces a noise event with a position and radius: footsteps (by movement state and surface), landing, vaulting, doors (open 6 m, slam 14 m, forcing a door 18 m), items dropped (8 m), vents (6 m per crawl step), objectives (the generator pull-start 25 m on failure, the oven 12 m, cranking the music box 5 m), voice (proximity voice is not heard by animatronics by default; there's a lobby option "Animatronics can hear voice" that makes speaking above a volume threshold generate a 6 m noise event, a mode for hardcore groups), the noisemaker toy (30 m, deliberate lure). Animatronics hear noise events within their hearing radius modified by walls (Part 6.3). The UI shows a subtle noise indicator: a small ring icon at the bottom of the screen that pulses with your current noise level, so players learn how loud they are.

### 4.5 Interaction system

Look at an interactable within 2.0 m and a small crosshair prompt appears ("E: Open", "Hold E: Wind music box", "E: Hide"). Interactions are either instant (press) or held (a radial progress around the crosshair). Releasing a held interaction cancels it, except multi-stage interactions (the generator, the breaker puzzle), which save progress.

Interactables: doors (open, close, hold, lock with a key), shutter buttons, light switches, breaker levers, fuse boxes, the music box crank, the generator, terminals, the phone, item pickups, hiding spots, vent grilles, ladders (climb up/down at 1.5 m/s), cupcakes and trays, the oven, the claw machine, the stage microphone, honkable noses, wall maps, posters (zoom), tapes, the reel-to-reel player, the time clock, the vending machine, and teammates (revive).

Every interaction plays a first-person animation of the character's hands (they reach, grab, turn, push), visible to teammates in third person as an arm animation. Make the hands feel physical: a slight delay as you reach, a satisfying contact sound.

### 4.6 Inventory and carrying

Four small-item slots (keys 1 to 4, or mouse wheel) plus the flashlight slot and a hands slot for one large object. The equipped small item is shown in your right hand (flashlight in left when both are active; if a large object is carried, both hands hold it and the flashlight is clipped to your chest, pointing forward, at reduced cone and no focus).

Small items: battery pack, fuse, keycard (Security, Manager, Basement, Parts), Freddy mask, Faz-Pad tablet, walkie-talkie, noisemaker toy, energy soda, camera flash (the "Faz-Cam"), wrench, lockpick, Faz-Tokens (stack, don't use a slot), plush collectibles (don't use a slot), Faz-Tape cassettes (don't use a slot), vent schematic (doesn't use a slot), pizza dough, a cupcake (small item: you can carry one cupcake per slot).

Large objects (two-handed): the generator battery, a cupcake tray (holds all five cupcakes at once; drop it and the cupcakes scatter), a fuse crate (contains 3 fuses), the reel-to-reel tape (Night 4), the gold ball (just for fun, it's big).

Drop with `G` (small item in hand) or `G` again for large object; drop is a gentle placement in front of you, physics-settled. Throw with hold `G` then release (small items only, thrown items make noise where they land: a deliberate lure technique). Items can be handed to a teammate by looking at them and pressing `T` (both players see a quick hand-over animation).

When a player is downed, their large object drops; small items stay with them. When a player becomes a ghost, all their items drop where they fell as a little scattered pile (so teammates can recover the keycard you were carrying).

### 4.7 Items in detail

Battery pack: restores 50% flashlight battery (or 50% Faz-Pad battery). 2 seconds to swap with a reload-like animation.

Fuse: inserts into fuse boxes (Part 5.3). Glows faintly orange when dropped so it's findable.

Keycards: colour-coded plastic cards with the company logo. Security (blue): Security Office rear door, Server Room. Manager (gold): Manager's Office. Basement (red): Old Storage door. Parts (green): Parts & Service's back cage on Custom Night.

Freddy mask: hold `R` to wear (0.4 s to raise). While worn: vision through two eye holes (a vignette mask overlay with a cheap plastic interior texture at the edges), movement 1.2 m/s, can't interact, can't use the flashlight focus, breathing is loud in your own ears but not to animatronics. Mask-able animatronics (Bonnie, Chica, the Toy cast, most Withered) that reach you while you're masked and still treat you as one of them: they stand over you for 3 to 6 seconds and walk away. If you move faster than a crouch-walk while masked within 6 m of them, the illusion breaks. Freddy is mask-able only on Nights 1 to 3. Foxy and the Puppet are never fooled. One mask spawns in the Staff locker per night, one random elsewhere on Night 3+.

Faz-Pad (tablet): a handheld tablet showing the security cameras. Hold `C` to raise it. While raised, you see one camera at a time full screen in a CRT style (Part 11.6), switch with the mouse wheel or number keys, and can wind the music box remotely on CAM 8 (40% speed), operate shutters remotely (Night 3+ upgrade found in the Server Room), and ping things seen on camera (pings appear in the world for teammates). You're nearly blind to your surroundings while using it (you hear things, and a small "danger sense" border pulses red if an animatronic is within 4 m, but that's it). Battery 100%, drains 2% per second while raised. One per night in the Security Office.

Walkie-talkie: lets the carrier talk to all other walkie carriers anywhere in the building (hold `V` to talk on the radio channel; proximity voice is separate and always on). Radio voices get a walkie filter (Part 4.15). Also relays the phone call. Nights 1 to 2: two walkies; Nights 3+: four.

Noisemaker toy: a squeaky wind-up toy (a little drumming bear). Wind and throw it (or place it); after 2 seconds it drums and squeaks for 8 seconds at a 30 m noise radius, pulling animatronics that hear it to investigate. Two uses per toy. A classic distraction.

Energy soda: Part 4.2.

Faz-Cam (camera flash): a disposable flash camera with 3 charges. Point and click to flash: any animatronic in front of you within 8 m and a 40 degree cone is stunned for 2.5 seconds (Freddy and the Puppet are immune; Golden Freddy is dismissed instantly by a flash). Each flash is loud (noise 14 m) and very bright (lights the area for a frame, Part 11). It also "takes a photo" saved to the player's match gallery, which can be viewed after the night (photos of animatronics mid-lunge are a social feature people will screenshot). It's the closest thing to a weapon and it's deliberately weak: rare (one or two per night), few charges, short stun.

Wrench: speeds up fuse box and panel repairs by 40% and can wedge a door shut for 15 seconds (it holds the door so you don't have to; it falls out when an animatronic forces the door, with a loud clang).

Lockpick: opens a locked door or locker in 8 seconds of noisy picking (noise 8 m). Breaks after 2 uses.

### 4.8 Hiding (player side)

Press `E` at a hiding spot to enter. The camera moves into the spot with a short animation (you see your character's hands pull the locker door shut, or duck under a tablecloth). While hidden, the view mode depends on the spot: slatted locker doors (horizontal slats across the screen, light bars sliding across your face when anything moves outside), under-table (low view with the tablecloth fringe at the top of frame), ball pit (underwater-style muffled view with coloured balls pressing on the screen), curtain (fabric fills the screen edges, you can peek through a gap), freezer (frost forming on screen edges, your breath fogging), coffin (total darkness except a thin crack of light).

Hidden controls: look around within a limited arc (like peeking), hold `Space` to hold breath (meter 8 seconds, refills in 6; while held, you make no noise, the audio goes muffled and your heartbeat becomes loud; release before it runs out or you gasp, a 10 m noise event), press `E` to exit through the nearest exit point (or `A`/`D` to pick an exit when there are two).

Heartbeat: a heartbeat sound and a subtle screen pulse intensify as a hunting animatronic gets closer, so the player feels the danger even without seeing it. Turn it down in accessibility settings.

Animatronic searching your spot: if one starts checking your spot (Part 6.4), you get a 0.8 second warning (the door handle rattles, the tablecloth lifts at a corner, a shadow fills the slats). If you burst out the far exit during that warning, you get a head start (the animatronic is in its check animation for 1.0 more second). That's the "last chance" mechanic that makes hiding a skill, not just a coin flip.

Two in a locker: large lockers (marked double width) fit two players. Both get the same view; voices are extra quiet (proximity voice drops to whisper level automatically when hidden). Animatronics finding a double-occupied locker catch both.

### 4.9 Loadouts

In the lobby, each player picks one starting item from their unlocked loadout options (unlocked through progression): Battery Pack (default), Energy Soda (Night 2 beaten), Noisemaker (Night 3), Wrench (Night 4), Faz-Cam with 1 charge (Night 5), Vent Schematic (Night 6). Loadout choice adds a light layer of team planning.

### 4.10 Doors from the player's side

Look at a door and press `E` to open or close. Doors swing away from the player (physics-driven angle, settled in 0.4 s). Hold `E` while a closed door is being forced to hold it (Part 3.32). Some doors lock from your side (the staff toilet, the accessible restroom, the dock office) for 20 seconds. Keys are used automatically when you interact with a locked door while carrying the right one. Doors partially open block line of sight partially (the AI uses the door's actual geometry).

You can press your ear to a closed door (hold `L`): the camera leans in, the audio from the other side becomes clear and louder (FNAF 4's listening mechanic), and footsteps or breathing on the other side get a direction indicator in the visual sound cues setting.

### 4.11 The clipboard and checklist

Press `Tab` to raise the clipboard. Your character holds it up in front of the camera with one hand (you can still walk slowly). It shows the night's required objectives with checkboxes that tick themselves live when the team completes them (with a pen-scribble sound), optional objectives below a line, the current time (a little watch drawn on the paper corner, showing only the hour), and team status (each player's name with a tick if alive, a cross if ghost, a bandage icon if downed). Use the paper look for the UI style: handwriting font for checkbox items, a coffee stain, a company logo header.

### 4.12 Cameras from the player's side

At the Security Office desk: sit in the chair (interact), which switches you into a fixed first-person office view similar to Mode D (Part 5.12): look left and right, press the door and light buttons, raise the monitor to view cameras, use the wall panel. You're vulnerable while seated, exactly as in FNAF 1. Stand up by pressing `E` again. While seated you can't see behind you (the office has no rear threat except through the locked rear door, which some later threats can open).

With the Faz-Pad: anywhere in the building, as described in 4.7.

Camera view controls (both): number keys or wheel to switch; `Q` to ping what's on screen (opens a radial: "Animatronic here", "Item here", "Danger", "Go here"); `W` (hold) to wind the music box when viewing CAM 8.

### 4.13 Pings and callouts

Press middle mouse (or `Z`) to ping where you're looking in the world: a marker with your colour and an auto-detected label ("Fuse", "Locker", "Bonnie!", "Door", "Go here") appears for all teammates for 8 seconds, visible through walls with a distance readout. Pings on animatronics only work if you can actually see the animatronic (line of sight and light), and they show its position at ping time, not live. Ghosts can ping too. Limit: one active ping per player.

Callout wheel: hold `X` to open a radial of preset callouts ("Over here!", "Run!", "Hide!", "I need help!", "Power's low!", "Wind the box!", "Foxy's out!", "Freddy's moving!", "Thanks!", "Sorry!"). Each plays a short synthesised voice-like blip and shows text above your head and on teammates' screens if within walkie or proximity range. For players without mics.

### 4.14 Getting caught, downed, revived, ghosted

When an animatronic catches a player: the caught player's camera snaps to face the animatronic, the jumpscare animation plays (Part 6.12), then the player is downed. Downed: the player slumps on the floor (third-person model in a hurt pose), their first-person view goes dark red with a slow heartbeat, they can crawl at 0.6 m/s, use voice, and ping. A bleed-out timer of 45 seconds counts down (shown on their screen and above them for teammates as a shrinking ring). Animatronics don't attack downed players again; they leave after the catch (most return to patrol; some, like Chica, "guard" the body for 5 to 10 seconds, which creates a tense revive decision).

Revive: a teammate holds `E` on the downed player for 4 seconds. No items needed. Taking damage isn't a thing in this game, so the revive is interrupted only if the reviver lets go, moves more than 1 m away, or gets caught themselves. Revived players stand up with 50% stamina and a "shaken" state for 20 seconds (slight screen shake, louder breathing, can't sprint for the first 5 seconds). Each player can be revived twice per night; the third catch skips the downed state and sends them straight to ghost.

Ghost: when the bleed-out timer ends or a third catch happens, the player becomes a ghost for the rest of the night. Ghosts float through the building as a faint translucent version of their character (visible only to other ghosts), can pass through doors (not walls), see the whole building as if lit faintly, see animatronics with a red outline, can ping (with a pale colour visible to the living), and can speak only to other ghosts (lobby option to let ghosts talk to the living, off by default). Ghosts can also do one small physical thing: once per minute, they can flicker a light within 5 m (a spooky way to signal teammates; it doesn't affect animatronics). Ghosts earn half pay if the team survives.

Night lost: if every player is a ghost before 6 AM, the night ends: a final shot of the show stage with every animatronic back in place, staring into the camera, and the game over card.

### 4.15 Voice: proximity and walkie-talkie

Proximity voice is the soul of co-op horror, so it's built in.

Proximity: every player's voice is a spatial audio source attached to their character's head. It's always on (push-to-talk optional, voice activation default with a sensitivity threshold). Voice falls off with distance (full volume at 2 m, inaudible at 25 m) and is muffled through walls and doors (a low-pass filter whose cutoff drops based on the number of walls between speaker and listener, computed with a cheap raycast against the level's wall geometry every 200 ms). In vents, voices get a metallic reverb. When a player is hidden, their outgoing voice is automatically reduced to a whisper (gain 0.5, a slight breathiness filter) so friends hiding together can whisper.

Walkie-talkie: carriers hold `V` to transmit on the radio channel; all other carriers hear it at full volume regardless of distance, through the radio filter chain (high-pass 300 Hz, low-pass 3,400 Hz, light distortion, squelch on key-up and key-down). Other players near a carrier who's receiving hear the radio through the carrier's walkie speaker (spatialised, quieter), so a radio crackling in a hidden player's pocket can be heard by nearby friends. When the power's out, walkies get heavy static.

Implementation: WebRTC peer-to-peer audio in a full mesh (four players max), signalling over Socket.IO, positions from the game state, Web Audio graph per remote player (MediaStreamSource → radio chain if transmitting on walkie → PannerNode with HRTF → wall occlusion low-pass → gain). Mute players individually from the pause menu. Part 10.9 has details.

Text chat: `Enter` opens a chat box; messages appear for 6 seconds. Chat is global to the lobby (not proximity) to keep it simple, rate limited and filtered.

### 4.16 Emotes

Hold `B` for an emote wheel: wave, point, thumbs up, shrug, dance (a goofy little dance), salute, "shh" (finger to lips), cower. Emotes play on your third-person model for others. Some emotes are cosmetics unlocked via achievements (Part 8). Emotes cancel if you move. Animatronics treat emoting players as normal targets (no special cheese).

### 4.17 Third-person player models and animation

Other players see your guard character, built procedurally from your skin (Part 8.4), animated with a lightweight procedural animation system: walk and run cycles (legs driven by sine curves synced to speed, with simple two-bone IK planting feet on the floor), crouch, crawl, vault, ladder climb, carry pose (both arms forward), hide entry/exit, interact reaches (arm IK toward the target point), flashlight aim (the arm holding the flashlight points where the player looks, the head turns with look direction), downed pose and crawl, revive pose (kneeling, hands on the downed player), emotes, and death (slump). Use a small skeleton (hips, spine, chest, neck, head, upper and lower arms and legs, hands, feet) and blend between procedural poses; you don't need keyframed animation files. Smooth everything with critically damped springs so remote players look fluid even at 20 Hz updates.

Nameplates: a small name above each teammate's head, visible within 20 m or through walls if they're pinging or calling out (setting to hide nameplates for immersion).

First-person body: when you look down, you see your own legs and torso (same model, head hidden), which helps immersion and lets skins be seen by their owner.


---

## PART 5: POWER, OBJECTIVES AND THE NIGHTS

### 5.1 The power grid

The building has a single power pool shown as a percentage on the Breaker Room's meter, on every wall map, on the clipboard's corner, and as a small HUD readout that players can toggle (off by default; diegetic first). It starts each night at a value set by the night (Night 1: 100%; Night 5: 70%; Custom Night: configurable).

Power is spent by circuits. Each zone belongs to a circuit. A circuit is either off (no lights, no systems), on (lights and systems work), or tripped (off because of a fault, must be reset at the breaker panel). Each powered circuit drains a base amount; each active consumer adds more.

| Consumer | Drain (% per in-game hour, at default 150 s hours) |
|---|---|
| Base building load (once main power is on) | 4 |
| Each zone circuit switched on | 1.5 |
| Each closed security shutter | 3 |
| Each Security Office door closed | 3 |
| Each Security Office door light on | 2 |
| Security Office monitor raised | 2 |
| Stage lights and lure playing | 2 while active |
| Arcade and Prize Corner circuits | 0.5 each (always on, from the backup battery) |
| Kitchen oven running | 3 while active |

That table is a starting point for `config.ts`. The balance target: with four players who switch on every zone light and use the office moderately, power runs out around 4:30 AM on Night 5 unless they manage it. With careful play (lights only where needed, shutters used sparingly), they reach 6 AM with 10% to 20%. On Night 1 it should be hard to run out.

Before main power is restored, the building runs on emergency power: exit signs, emergency strips, the Prize Corner, the Arcade and the Security Office (on its battery). The main zones are dark.

Power outage: if power hits 0%, every circuit dies. Every light in the building fades out with a stutter (Part 11.6), shutters and office doors spring open and jam, the arcade screens collapse, the music box's gauge freezes (it keeps unwinding), and the building goes silent apart from rain. After 5 to 10 seconds, Power-Out Freddy activates (Part 6.7): he appears somewhere in the building, his face lit in the dark, playing the Toreador March, and hunts the players one at a time. Players can survive the blackout by reaching 6 AM, or by restarting power: the backup generator in the Boiler Room can be restarted (Part 5.2) to give 20% emergency power once per night. Restarting it during a blackout while Freddy hunts is the most intense thing in the game.

### 5.2 Objective: restore main power (every night)

This is always the first required objective. At night start, the main breaker is off and the building's on emergency power.

Step 1, get to the Breaker Room (B02) in the basement. Step 2, the breaker panel puzzle: the panel has a master lever and twelve circuit breakers. The master lever won't hold until the panel's "load balance" is correct: a little analogue needle must sit in the green band. Each of the twelve breakers has a load value (randomised per night, 1 to 4 units, printed on a tiny label under each breaker, readable when you look closely with a flashlight). The players must switch on a set of breakers whose total load lands in the green band (between 10 and 14 units, randomised per night) and then pull the master lever. Too much load and the master trips with a loud bang and a shower of sparks (alerts animatronics within 30 m, and the panel needs 15 seconds to cool down). Too little and the lever drops back with a clunk. It's a simple arithmetic puzzle that rewards a calm player and punishes a panicked one. On Night 1, the clipboard includes a hint ("Day manager says: 'aim for about 12 on the needle'"). On Night 3+, some breaker labels are smudged and must be read from the breaker log clipboard on the room's workstation.

Step 3, once the master holds, main power is on: the building's base hum kicks in (a deep "whomp" of electricity felt through the whole building, every player hears it), and zone circuits become switchable at their local switch panels. Breakers you left on in the panel determine which circuits are live; a circuit whose breaker is off can't be switched on at its zone panel, so the panel choice matters strategically too.

On later nights (3+), the main breaker trips randomly once or twice per night (Part 5.7), forcing a return trip to the basement.

The backup generator (B03): needs the heavy battery from the Loading Dock (a large object, carried two-handed, slow and loud). Insert it into the generator (interact, 2 seconds). Then pull-start: a rhythm interaction where a marker sweeps across a bar and the player clicks when it's in the target zone; three successes start it; a miss makes a loud bang (25 m noise) and resets one success. Once running, it adds 20% to the power pool immediately and powers the Basement circuit for free for the rest of the night. It's an optional objective on Nights 1 to 2 and a required one on Night 4+.

### 5.3 Objective: fuse boxes and zone lights

Each zone has a light switch panel, usually by its main entrance (a grey metal box with a big toggle and an indicator lamp). After main power is on, flipping a zone's switch turns on that zone's lights, provided the zone's fuse is intact.

Fuses: at night start, a number of zone fuses are blown (Night 1: 2 zones; Night 2: 3; Night 3: 4; Night 4: 5; Night 5: 6; randomised which zones, always including the Dining Hall on Night 1 so new players see the building light up). Blown fuse boxes are marked by a sparking box and a dead indicator lamp at the zone's switch panel. To fix one: open the fuse box (there are four fuse boxes: Fuse Box 1 in the Utility Corridor, Fuse Box 2 in Parts & Service, Fuse Box 3 in the Kitchen, Fuse Box 4 in the Basement Hall, each covering a set of zones), pull the blown fuse (0.5 s), and insert a fresh fuse (hold 2 s, 1.2 s with a wrench). Fresh fuses are found in the Supply Closet (always 1 to 2), the fuse crate at the Loading Dock (3), and random spawn points around the map (Part 5.10).

Lit zones: once a zone is lit, it changes behaviour (Part 6.3): players can see much farther, flashlights matter less, and animatronics in that zone can see players from farther away too. Some animatronics avoid light (Freddy prefers dark zones), some are drawn to it (Balloon Boy), most are neutral. Players also earn a small "Lights On" bonus per zone lit at 6 AM.

The objective on the clipboard reads "Turn on the lights: Dining Hall, West Hall, Kitchen" (whichever zones are required that night), and each zone ticks when lit.

### 5.4 Objective: the cupcakes (Chica's birthday)

Five cupcakes must be placed on the five birthday tables (the tables with star cards; their locations rotate per night among the Dining Hall, Party Rooms 1 and 3, and the Lobby counter).

Night 1 to 2: five cupcakes sit ready on the Kitchen decorating station. Players can carry one per inventory slot (so one player can carry up to four, or the tray, which holds all five, as a large object). Night 3+: the cupcakes need baking first: get the cupcake tray from the pantry, put it in the oven (interact), wait 30 seconds while the oven runs (noise 12 m, attracts Chica strongly), take it out, then deliver. Night 5: one cupcake is missing and must be found somewhere in the building (Chica "ate" it; it's in a random spot with a crumb trail leading to it, readable with a flashlight).

Placing a cupcake: interact with the empty plate on a birthday table (1 second). The cupcake sits there with its candle lit (a tiny flame light). When all five are placed, a cheerful jingle plays across the building's PA ("Happy birthday!" in a synthesised chime voice) and every lit candle flickers in unison.

Chica's rule (Part 6.5): anyone carrying cupcakes is "smelled" by Chica within 20 m (through walls), and she prioritises them. Carrying the whole tray makes you a beacon. Splitting the cupcakes across players is safer but slower. Placed cupcakes also attract her: she stops at a birthday table for 4 to 8 seconds to "admire" it, which is a window for players to slip past.

### 5.5 Objective: the music box ("retwist the crank")

The music box in the Prize Corner unwinds from 100% at a rate set by the night (Night 1: 0.35% per second, so about 4.75 minutes from full to empty; Night 3: 0.5%; Night 5: 0.65%; Night 6: 0.8%). It's always running from night start.

Winding it: stand at the pedestal and hold interact. Two-handed first-person crank animation (the crank handle turns in circles, the character's hands visible gripping it), clicking ratchet sound, the gauge needle rising, the melody speeding back up from its slowed, detuned state. Wind rate: 10% per second in person, 4% per second remotely from CAM 8 (Security Office monitor or Faz-Pad). While winding in person you can't look around much (your view is locked toward the box within a 60 degree arc) and you can't use your flashlight, so you're vulnerable. Someone should watch your back.

Warnings: at 30%, the melody audibly slows and detunes and the Prize Corner's neon starts flickering; at 15%, a warning chime plays over the PA and the clipboard objective flashes ("THE MUSIC BOX!"); at 5%, the gift box rattles and creaks.

At 0%: the melody stops. Silence for 2 seconds. Then "Pop Goes the Weasel" plays fast and distorted throughout the building's PA, the gift box bursts open, and the Puppet emerges (Part 6.8) and hunts. Winding the box back above 50% sends it back to its box (it glides back at speed and the lid closes). If the Puppet catches someone, they go straight to ghost (no downed state; the Puppet doesn't forgive), and then it continues hunting until the box is wound.

On the clipboard, the music box is a persistent objective: "Keep the music box wound (never let it run out)". It fails if the box ever reaches 0, which costs bonus pay but doesn't end the night.

### 5.6 The lure systems (Security Office and stage)

Stage "Showtime" lure: from the Stage Booth's mixing desk or the Security Office wall panel, play the Showtime jingle through the stage speakers. Every non-Freddy, non-Puppet animatronic within 35 m that isn't currently chasing someone is pulled to the stage for 25 seconds (they walk there and perform a short idle "show" animation). Cooldown 90 seconds. Drains 2% power. A great tool for an office player to save a teammate.

Zone speaker lures: the Security Office wall panel can play a child's laugh through any zone's speaker (FNAF 3 style audio lure): animatronics within 15 m of that speaker investigate it. Cooldown 30 seconds. Fails if the Audio system has failed (Part 5.7).

PA voice: the office wall panel has a PA mic; holding it broadcasts the player's voice through the building's speakers (everyone hears it everywhere, which is great for coordination, and animatronics within 20 m of any speaker hear it as noise, which is dangerous). A funny, risky option.

### 5.7 System failures and side tasks

From Night 2 onward, systems fail on a schedule (Night 2: 2 failures; Night 3: 3; Night 4: 4; Night 5: 5; Night 6: 7), placed at random times from 1 AM to 5:30 AM with at least 40 seconds between them. Each failure appears on the clipboard as a new required task (with a time limit after which a penalty applies), and on the Security Office monitors and Faz-Pad with an alert.

Camera failure: all cameras show static. Fix at the Camera Server Room terminal (hold 8 s). Penalty if not fixed: none beyond losing cameras.

Ventilation failure: fix at any of the three vent junction panels (hold 6 s, inside the vents) or the Server Room. Penalty after 60 seconds unfixed: hallucinations for all players (Part 6.13), and the Phantom threats activate on Night 4+.

Audio failure: the zone speaker lures and the PA stop working. Fix at the Stage Booth mixing desk (hold 5 s).

Main breaker trip (Night 3+): all zone lights go out and the power drain stops (good for power, bad for everything else). Fix by returning to the Breaker Room and redoing the load-balance puzzle with the same values (quicker the second time).

Door control jam: one random security shutter jams closed (blocking a route and draining power) or open (useless). Fix at the shutter's wall button with a wrench (hold 4 s) or by rebooting from the Security Office panel (hold 6 s while seated).

Flooding (Night 4+): the Maintenance Tunnel floods. Not fixable; it's a map change.

Side tasks (optional, for bonus pay and achievements): each night picks 2 to 3 from this list: Parts Run (carry a spare part from Backstage to the Security Office), Lost and Found (find a child's lost plush toy somewhere and put it in the Lobby lost-and-found box), Tape Recovery (find the night's Faz-Tape and play it in the Security Office or the Old Storage reel-to-reel), Clean Up (mop the puddle in the Restrooms: hold 5 s with the mop from the Supply Closet; mopping is loud), Fix the Sign (flip the breaker for the outside neon sign: the Lobby sign flickers to "FREDDY FAZBEAR'S PIZZA" fully lit; visible through the front windows), Feed the Fish (the Manager's Office fish tank has no fish; putting fish food in it plays a sad little sound and unlocks an achievement; this one's a joke), Prize Restock (carry a box of plushes from the Dock to the Prize Corner counter), Stage Check (go on stage with the lights on and take a Faz-Cam photo of all four animatronics; good luck).

### 5.8 The manager's terminal and the safe

The Manager's Office computer is an interactive terminal (a full-screen green-on-black CRT text interface when you sit at it): it has an email inbox with 4 to 6 short original emails per night (flavour and lore, Part 7), a "maintenance log" showing which systems are failing and where the fuses are blown (a useful planning tool), a "staff schedule" that reveals the safe code on some nights (when the code isn't written elsewhere), and a hidden command prompt where typing `1987` shows a corrupted image of the golden bear (secret). The terminal session is per player but the information is the same.

The safe: 4-digit code, entered on a keypad (look at keys and click). Code location randomised per night from a list of 10 spots (sticky note on the office monitor, chalkboard in the kitchen, back of a poster in Party Room 2, carved into the Pirate Cove's treasure chest, written on a balloon in the Prize Corner, on a receipt in the Lobby, in the terminal's schedule, on a whiteboard in the Dock office, in the Restroom mirror condensation (only visible after the hand dryer runs), on a cupcake box in the pantry).

### 5.9 Early exit

If every required objective of the night is complete (power on, required zones lit, cupcakes placed, music box never ran out, and all failures fixed), the front doors unlock at 5 AM: a loud chain-and-padlock clatter echoes through the building, and the PA plays a door chime. Players who walk out the front doors before 6 AM exit the night early: they see a short cutscene of their character stepping into the rain and the doors closing behind them, then they spectate the rest as a "clocked out" observer with a special camera (they watch the remaining players through the building's security cameras). Early exit gives a 25% bonus on pay for that player. If any player is still inside, the night continues until 6 AM or until everyone's out. It's a team decision: wait for everyone, or bolt.

The animatronics know about the exit. At 5 AM on Night 4+, one animatronic moves to guard the Lobby, so the exit becomes a final challenge.

### 5.10 Item spawn system

At night start, the server populates item spawn points from a weighted table per night. Each spawn point in the level data has allowed item types. Guaranteed items: 4 flashlights (staff entrance), walkies (per night), 1 Faz-Pad (office), 1 mask (staff locker), 2 batteries and 1 to 2 fuses (Supply Closet), the fuse crate (Dock), the generator battery (Dock), the cupcakes (Kitchen), keycards in their places. Random items: 3 to 6 batteries, 2 to 4 fuses (always at least enough for the blown fuses plus 1 spare), 1 to 2 energy sodas, 1 to 2 noisemakers, 0 to 2 Faz-Cams (Night 2+), 0 to 1 wrench, 0 to 1 lockpick, 4 to 8 Faz-Tokens, 1 Faz-Tape, 0 to 2 plush collectibles.

### 5.11 Night-by-night breakdown

All aggression values are 0 to 20 (Part 6.2), at four players. "Required" objectives must be done for the early exit and give the main bonus; the night is won by surviving regardless.

Night 1: "Orientation". Power starts 100%. Required: restore main power; turn on the Dining Hall and one other random zone (fuse needed for the Dining Hall); wind the music box (it runs slowly); place the five cupcakes (ready-made). Optional: two side tasks. Threats: Bonnie 3, Chica 2. Freddy on stage, inactive. Foxy inactive (curtain closed). No system failures. The phone call explains the basics (Part 7). Spawn protection: no animatronic leaves the stage for the first 90 seconds. Expected: new players survive this most of the time and learn the map.

Night 2: "Busy Night". Power 90%. Required: power, three zones lit (2 blown fuses), cupcakes (ready-made), music box. Optional: two side tasks. Threats: Bonnie 6, Chica 5, Foxy 3 (activates at 1 AM). Failures: 2 (cameras, audio). Faz-Cams start appearing.

Night 3: "Showtime". Power 85%. Required: power, four zones lit (3 blown fuses), bake and deliver cupcakes, music box, fix all failures. Threats: Bonnie 8, Chica 8, Foxy 6, Freddy 4 (activates at 12 AM; weeping-angel rule), the Puppet (music box faster). Failures: 3, including the first main breaker trip and ventilation. Golden Freddy apparitions possible (rare).

Night 4: "Flooded". Power 75%. Required: power, five zones lit (4 blown fuses), backup generator started, bake and deliver cupcakes, music box, failures, open Old Storage with the Basement keycard from the Manager's safe and play the tape on the reel-to-reel. Threats: Bonnie 11, Chica 11, Foxy 10, Freddy 8, Puppet; Phantom threats if ventilation fails. Map: the Maintenance Tunnel floods. Failures: 4. One animatronic guards the exit after 5 AM.

Night 5: "Last Shift". Power 70%. Required: everything from Night 4 plus find the missing cupcake, and all six zones lit (5 blown fuses). Threats: Bonnie 14, Chica 14, Foxy 13, Freddy 12, Puppet (fast), Golden Freddy more frequent. Failures: 5. The phone call is replaced by a garbled transmission (Part 7). The final hour: at 5 AM all animatronics gain +3 aggression and the lights in random zones start failing one by one (each zone's light has a 10% chance per in-game minute after 5 AM of going out until relit at its panel).

Night 6: "Overtime". Power 60%. Required: everything, plus 6 blown fuses. Threats: Bonnie 18, Chica 18, Foxy 18, Freddy 16, Puppet (very fast), plus two random extended-roster characters (Part 6B) at 10. Failures: 7. No phone call, only silence.

Custom Night: Part 5.13.

Hourly increments (all nights): at 2 AM Bonnie +1; at 3 AM Bonnie, Chica, Foxy +1; at 4 AM Bonnie, Chica, Foxy +1; at 5 AM Freddy +2. A tribute to FNAF 1's schedule.

### 5.12 Mode D: The Office (classic FNAF 1 rules)

In this solo bonus mode, the player sits in the Security Office for the whole night, using the classic FNAF 1 rules faithfully, while the animatronics walk the real 3D building on routes equivalent to FNAF 1's (mapped onto our zones: Show Stage, Dining Hall, Pirate Cove, West Hall, West Corner, Supply Closet, East Hall, East Corner, Backstage, Kitchen (audio only), Restrooms).

Rules: AI levels 0 to 20 with movement opportunities on fixed intervals (Freddy 3.02 s, Bonnie 4.97 s, Chica 4.98 s, Foxy 5.01 s) and a roll of 1 to 20 against the AI level; FNAF 1's per-night starting AI table (Night 1: 0/0/0/0; Night 2: 0/3/1/1; Night 3: 1/0/5/2; Night 4: 1-2/2/4-6/6; Night 5: 3/5/7/5; Night 6: 4/10/12/16; Custom: 0 to 20 each) for Freddy/Bonnie/Chica/Foxy; FNAF 1's hourly increments; FNAF 1 power (start 100%, usage bars 1 to 5, drain about 1% per 9.6 s at usage 1, 4.8 s at 2, 3.2 s at 3, 2.4 s at 4+, plus passive drain on Night 2+); Foxy's knock drain (1%, then +5% per knock); Freddy only moving when his camera isn't watched; Bonnie and Chica disabling the door buttons once inside; the power-out Toreador sequence; Golden Freddy's poster on CAM 2B; 1/9/8/7 Custom Night easter egg; 4/20 mode for the third star. Each hour lasts 89 seconds as in the original.

Because the animatronics are physically in the building, the camera feeds show the actual 3D characters standing in the real rooms, which gives this mode a fresh look while playing exactly like the original.

### 5.13 Custom Night

A setup screen in the lobby (host controls, everyone sees it live): a grid of every unlocked animatronic portrait (Part 6B) with an aggression slider 0 to 20 and an on/off toggle, plus modifiers: starting power (30% to 100%), music box speed (x0.5 to x2), blown fuses (0 to 8), failures (0 to 10), "lights stay off" (no zone lights at all), "no revives", "one walkie", "no flashlights" (yes, really, for masochists), "animatronics can hear voice". The score multiplier is shown live (sum of aggression values plus modifier bonuses), and rewards scale with it. Maximum 12 animatronics active at once (Part 6B.7).

Presets with exclusive rewards on first completion per account: "Old Friends" (the original four at 20, everything else off), "Pirate's Revenge" (Foxy at 20 alone, no lights), "Birthday Party" (Chica at 20, ten cupcakes), "Silent Night" (Freddy at 20, no flashlights), "Lullaby" (Puppet only, music box x2), "Golden Hour" (Golden Freddy enabled at 20 plus the core four at 10), "1987" (Freddy 1, Bonnie 9, Chica 8, Foxy 7: Golden Freddy appears in front of the host at the start and catches them immediately, unlocking the "It's Me" achievement), "4/20" (Freddy 4, others 20: the third star), and "Ultimate" (12 characters at 20: the golden star).

### 5.14 Scaling by player count

Solo (1 player): aggression ×0.6; music box ×0.7; fuses blown −1; failures halved; the bleed-out timer is replaced by "one free get-up per night" (when caught the first time, you get back up after a 5-second downed state; the second catch is a loss). Also two walkies are pointless, so the solo player gets the walkie's phone relay automatically.

Duo: aggression ×0.75; music box ×0.85; fuses −1.

Trio: aggression ×0.9.

Quad: ×1.0.

Downed and ghost players don't change scaling mid-night (the AI Director handles pacing, Part 6.9).

### 5.15 Stars and progression

Stars on the title screen like the original: one for beating Night 5, two for Night 6, three for the 4/20 preset, and a hidden golden star for the Ultimate preset. Stars show next to players' names in lobbies. Progress (highest night beaten) is per account; a lobby can play any night the host has unlocked.


---

## PART 6: ANIMATRONIC AI (FREE-ROAM)

This is the part that decides whether the game is scary or silly. The animatronics have to feel like they're hunting, they have to obey readable rules that come straight from FNAF, and they have to be fair. All AI runs on the server only (clients just render what the server says), inside `shared/src/sim/ai/` so the balance script and tests can run it headless.

### 6.1 Architecture

Each animatronic is an agent with: a position and facing, a navigation agent (path following on the navmesh, Part 6.11), a perception component (Part 6.3), a memory (last known player positions with timestamps, investigated noise points, checked hiding spots), a state machine (Part 6.4), a per-character behaviour module that overrides or extends states (Part 6.5 onward), an aggression value (Part 6.2), and animation state (sent to clients).

The AI updates on the server's 30 Hz tick, but expensive work is staggered: perception raycasts run at 10 Hz per agent, path replanning at most 4 times per second per agent, decision-making (choosing a new patrol target, deciding to search) at 2 Hz. Keep the per-tick cost of 12 agents under 2 ms on a Railway container.

Use explicit state machines with clearly named states and transitions (no black-box behaviour trees). Log every state transition with a reason in development builds (`[bonnie] PATROL -> INVESTIGATE (noise 14m at Dining Hall, door slam)`), and render it in the debug overlay (`F9` in dev builds) with vision cones, hearing radii, current path and target. This overlay will save you days.

### 6.2 Aggression (0 to 20)

Every animatronic has an aggression value from 0 to 20, the free-roam equivalent of FNAF's AI level. It's set by the night table (Part 5.11), raised hourly, multiplied by player-count scaling, and adjusted by the Director (Part 6.9) within ±2. Aggression drives these parameters (interpolate linearly from 0 to 20 unless noted; all in config):

| Parameter | At 0 | At 10 | At 20 |
|---|---|---|---|
| Active? | Never leaves its start point | Yes | Yes |
| Patrol walk speed (m/s) | n/a | 1.6 | 2.4 |
| Chase speed (m/s) | n/a | 4.4 | 5.4 (players sprint at 5.0) |
| Decision interval (s) between "move opportunities" | n/a | 6 | 2 |
| Chance per opportunity to choose a player-focused target over a random patrol point | 0 | 30% | 75% |
| Vision range, dark zone, flashlight off (m) | n/a | 8 | 12 |
| Vision range, lit zone (m) | n/a | 18 | 26 |
| Detection time at mid range (s to go from noticing to chasing) | n/a | 1.4 | 0.6 |
| Hearing multiplier | n/a | 1.0 | 1.4 |
| Search duration after losing a player (s) | n/a | 20 | 40 |
| Hiding spots checked per search | n/a | 2 | 4 |

The "move opportunity" idea from FNAF 1 survives: at each decision interval, the agent rolls 1 to 20; if the roll is at or below its aggression, it gets to make a "hunting" decision (pick a target related to players: a recent noise, a last-known position, a likely objective location like the music box when it's low, or a player it can track), otherwise it makes an idle decision (continue patrol, linger at a point of interest, return toward its home). So low aggression animatronics wander and dawdle, and high aggression ones relentlessly close in. It's faithful in spirit and gives you one number to tune.

Chase speed note: at mid aggression, animatronics are slower than a sprinting player but faster than a walking one, so chases are about stamina and breaking line of sight. At high aggression they slightly outpace sprinting players, so you must use the map (doors, vents, hiding). Never make them so fast that a chase has no outs.

### 6.3 Perception

Vision: a cone (horizontal 100 degrees, vertical 70 degrees) from the head bone. Each perception tick, for each player within the cone and max range, cast rays from the eyes to three points on the player (head, chest, feet). The player is visible if at least one ray reaches unobstructed. Then compute a visibility score from 0 to 1:

visibility = light × posture × motion × exposure × distanceFalloff

where light is 1.0 in a lit zone, 0.35 in a dark zone, 1.0 if the player's flashlight is on and pointed within 60 degrees of the animatronic (a lit flashlight is a beacon), 0.6 if the flashlight is on but pointed away; posture is 1.0 standing, 0.6 crouched, 0.4 crawling; motion is 1.0 sprinting, 0.8 walking, 0.5 still; exposure is 1.0 for full body, 0.5 if only leaning or partially behind cover (only the head ray hits); distanceFalloff goes from 1.0 at 3 m to 0.2 at max range.

A detection meter per player per agent fills at `visibility / detectionTime` per second and drains at 0.5 per second when not visible. At 0.3 the agent "notices" (turns its head toward the player, a sound cue plays: a mechanical whirr and a short sting; the player gets this tell and has a moment to break line of sight); at 1.0 it's "spotted" and the agent enters CHASE. A player inside 1.5 m in the cone is spotted instantly regardless of light. Players who are hidden in a hiding spot are invisible to vision except during the enter/exit animation or if the agent saw them go in.

Hearing: every noise event (Part 4.4) within `radius × hearingMultiplier` of the agent is heard, attenuated by obstacles: each wall between the source and the agent (count via a raycast against wall geometry, capped at 3) multiplies the effective radius by 0.6, a closed door by 0.75. A heard noise becomes an investigate target with a priority based on loudness and recency. Very loud noises (door slams, breaker bangs, generator misfires, noisemakers, the microphone) are heard building-wide by agents with aggression 15+.

Smell (Chica only): she senses anyone carrying cupcakes within 20 m through walls, and placed cupcakes as points of interest.

"Sixth sense" (anti-camping): if a player stays in the same hiding spot for more than 90 seconds while an agent is hunting within 15 m, the agent gets a weak hint toward that spot (it walks past it, maybe checks). Prevents the game from being won by sitting in one locker all night.

Players never see vision cones. They see tells: eyes glow brighter and shift colour slightly when an animatronic is in CHASE (Part 11), every animatronic has a distinct "noticed" sound and a distinct chase sound loop, and footsteps get faster.

### 6.4 States and the search behaviour

DORMANT: standing at the home point (on stage, in the cove, in the gift box). Ignores everything except its activation rule. Plays idle twitches.

PATROL: walks a weighted route through the character's preferred zones (patrol graph data per character in the roster), pausing at points of interest (a party table, a poster, a camera, a window) for 2 to 6 seconds with a look-around animation. Picks the next patrol node by weighted random, biased by aggression toward zones with players (the Director provides a coarse "where are players" heatmap that's updated every 5 seconds and blurred so the AI never has perfect information).

INVESTIGATE: walks to a heard noise or a ping-worthy event location at patrol speed plus 20%, looks around for 3 to 6 seconds, checks the nearest hiding spot if aggression ≥ 8 and a hiding spot is within 4 m, then returns to PATROL or escalates to SEARCH if it found evidence (a player sighting, another noise).

CHASE: runs at chase speed toward the player's current position while visible, and toward the last known position plus predicted velocity for up to 2 seconds after losing sight. Opens doors fast (Foxy smashes them). Follows into rooms. Can't enter vents or play tubes (except vent-capable characters). If the player hides in view, the agent goes directly to that spot. If line of sight is broken for more than 3 seconds, switches to SEARCH. During CHASE, an agent's chase sound loop plays (each character's is distinct) and the music layer intensifies (a low, pulsing drone; not music, a heartbeat-like synth pulse).

SEARCH: the agent searches the area around the last known position for `searchDuration`. It generates search points from the level's navHints and nearby hiding spots, then visits them in a sensible order (closest first, then fanning out), checking hiding spots by priority with a check animation (rip the locker open, lift the tablecloth, pull the curtain, lean into the closet, sweep the dust sheet, look under the desk). Each check takes 1.2 to 2.0 seconds, with the 0.8 second warning to the hidden player described in Part 4.8. It checks `hidingSpotsPerSearch` spots (by aggression), weighted by checkPriority and by distance from the last known position, so hiding farther away is safer. If it hears a new noise, it may break off to investigate. When the search ends, it returns to PATROL.

CATCH: within 1.0 m of a visible or found player, the agent catches: it plays its catch animation synced to the player's jumpscare (Part 6.12), then the player is downed. The agent then enters a 4 to 8 second "satisfied" state (stands over the body, looks around), then walks away toward a patrol point at least 20 m away. While satisfied it won't catch anyone else unless they come within 1.0 m in its cone (rescuers must be careful but can try).

STUNNED: from a Faz-Cam flash or a scripted effect: the agent freezes in a recoil pose for the stun duration, then returns to its previous state with its detection meter for the flashing player at 0.5.

RETURN: walks back to its home point (lured by the stage lure, or at 6 AM). At 6 AM, all agents switch to RETURN and walk slowly back to the stage, then freeze. That walk-back is a lovely final image: players can watch the animatronics shuffle past them, harmless, back to their places.

### 6.5 The core cast

#### 6.5.1 Freddy (the weeping angel)

Home: the Show Stage. Active from Night 3.

The rule: Freddy can only move while no living player is looking at him. "Looking" means he's within a player's view frustum (screen), within 30 m, not fully occluded (ray test to his head and chest), and lit enough to be seen (lit zone, or any player's flashlight cone reaches him, or his own glowing eyes count as visible within 10 m in darkness). While any player sees him, he freezes completely mid-pose (no animation, total stillness, a faint servo whine). The moment nobody's looking, he moves: in darkness, at chase speed toward the nearest player (or patrol speed toward his patrol target if no player is within 25 m). He's silent while moving except for a faint laugh (his signature deep chuckle, Part 11.7) that plays each time he finishes a movement burst, positioned at his location so players can hear where he is.

This turns FNAF 1 Freddy into a 3D threat: a team has to keep eyes on him or keep moving. Co-op shines here: one player can "hold" Freddy by watching him while another finishes the fuse box. Turning your back to run is exactly when he gets you. Camera feeds count as looking (watching Freddy on a camera freezes him too, just like the original), so a Security Office player can lock Freddy down for the team, at the cost of their attention and power.

Fairness rules for Freddy: when he moves while unseen, he never moves more than 6 m per unseen second, and he can't catch a player who has had him on screen in the last 0.4 seconds (so a fast glance back is always enough). He doesn't teleport through walls; he pathfinds like everyone else. He prefers dark zones: his patrol graph avoids lit zones when possible (light makes him easier to see), so lighting zones is a defence against Freddy.

Nights 1 to 2: on stage, inactive, but his head turns to follow players who walk past the stage. Harmless and horrible.

#### 6.5.2 Bonnie (the stalker)

Home: the Show Stage (left position). Active from Night 1.

The rule: Bonnie is the most active patroller. He's fast, curious, and roams the west side of the building most (West Hall, Supply Closet, Party Rooms, Employee Lounge, Backstage). His special trait: relocation. If Bonnie is in a zone where no player has had line of sight on him for 20 seconds, and he's in PATROL, he can "skip" up to two patrol nodes ahead instantly (only between nodes that are out of every player's sight, and never into a zone with a player in it). This recreates FNAF 1 Bonnie appearing out of nowhere: you checked the West Hall ten seconds ago, it was empty, now he's standing in it.

Signature behaviours: the closet idle (he sometimes waits motionless in the Supply Closet or a party room closet, Part 3.22); the camera stare (on CAM 5 Backstage he sometimes stands right in front of the lens; in person, you find him standing very close to a wall camera, looking up at it); the guitar twang (when he notices a player, a single detuned guitar string twang plays, his tell).

Vision: slightly wider cone (120 degrees). Hearing: normal. Mask-able: yes. Flashlight focus to the eyes from under 6 m: blinded for 2 seconds (once per encounter).

#### 6.5.3 Chica (the hungry one)

Home: the Show Stage (right position). Active from Night 1.

The rule: Chica's world revolves around food. She patrols the east side (Kitchen, East Hall, Restrooms, Dining Hall) and spends long periods in the Kitchen "eating" (standing at the range clattering pots: 15 to 40 seconds per visit, louder at higher aggression). She smells cupcakes (Part 6.3) and prioritises players carrying them: a cupcake carrier within 20 m becomes her investigate target even without sight, and a carrier she can see gets a 1.5× detection speed. She's drawn to the running oven like a moth. She stops at placed birthday cupcakes for 4 to 8 seconds.

Signature behaviours: the kitchen clatter (audible through the Kitchen camera's audio-only feed and through walls nearby); the guarding (after a catch, she lingers over the downed player for 6 to 10 seconds, "eating" noises, making revives tense); the breathing (when she waits outside a door, a wet, mechanical breathing is audible through it when a player presses an ear to the door).

Mask-able: yes. Speed: a bit slower than Bonnie in patrol, same in chase.

#### 6.5.4 Foxy (the sprinter)

Home: Pirate Cove. Active from Night 2.

The rule: Foxy progresses through cove stages (0: curtains closed; 1: peeking; 2: stepping out; 3: gone) on his move opportunities, but any player looking at him in the cove (in person or on CAM 1C) freezes his progress for a random 1 to 15 seconds (FNAF 1's 0.83 to 16.67 second freeze, rounded). If nobody has looked at the cove for 60 seconds, he gets a +4 roll bonus (neglect). At stage 3 he sprints: he leaves the cove at 7.0 m/s (faster than any player) along the West Hall toward the Security Office, and then toward the nearest player by straight-line priority, taking the most direct path. The sprint lasts until he catches someone, hits a closed door, loses all players for 4 seconds, or runs 60 m.

Counters: a closed door in his path stops the sprint (he bangs on it three times, loud, and drains 2% building power if it's a security shutter or the office door, increasing by 2% each time on the same night: a tribute to the FNAF 1 knock drain), then he returns to the cove at stage 0 or 1. A player hiding when he reaches their area makes him lose track (he doesn't search; he sniffs around for 3 seconds and goes back). A focused flashlight beam on him during the first 2 seconds of the sprint sends him back (FNAF 2 rule). The Faz-Cam stuns him.

Warnings: when he reaches stage 2, a sea shanty hum gets louder from the cove; when he sprints, a pirate shriek and pounding footsteps echo down the West Hall (every player hears it with direction). Players near the West Hall have about 1.5 seconds of warning to get out of the lane.

Foxy is the threat that forces teams to keep checking the cove. In co-op, "who's checking the cove?" becomes a running joke and a real responsibility.

Not mask-able. Can't open vents or play tubes, but can reach his hook into the Stage Crawlspace through the Cove hatch (Part 3.30).

### 6.6 Golden Freddy (the apparition)

Golden Freddy isn't a patroller. He's a rare apparition.

Trigger: whenever a player looks at the band poster in the West Corner (CAM 2B, or in person), and on Night 3+ also when a player is alone in Old Storage (B04), roll a small chance (per look per player: 1/2,000 on Nights 3 to 5, 1/500 on Night 6, 1/200 in Custom Night with him enabled). On success, the poster changes to a close-up of his face for that player only, and "IT'S ME" flickers in their vision for 100 ms. Then, the next time that player turns around (their view yaws more than 120 degrees from where it was), Golden Freddy is sitting slumped on the floor 2 m in front of them, in the dark, glowing pinpoint eyes. Whispering plays. The player has 3 seconds to look away (turn so he's off screen) or to flash him with a Faz-Cam. If they keep staring, his head lifts, and the jumpscare plays (a full-screen golden face with a distorted crashing scream and a faked "crash" glitch effect), and the player goes straight to ghost. Other players nearby see nothing at all, only their friend screaming. This is designed to be rare, legendary and talked about.

Fairness: if the player does nothing (doesn't look at him and doesn't run), he vanishes after 6 seconds. He only targets one player at a time and never more than twice per night. Photosensitivity mode replaces his flicker with a steady image.

### 6.7 Power-Out Freddy

When building power hits 0 (Part 5.1), every animatronic except Freddy goes dormant where it stands (they freeze in the dark; you can walk past them, heart pounding, they don't move), and Power-Out Freddy activates. He appears in the zone with the most players, in a doorway, his face lit by an internal glow pulsing to the Toreador March played on a tinny music box (Part 11.7). While the song plays (15 to 25 seconds), he stands still. When it ends, the lights on his face go out, and he hunts in total darkness: he moves toward the nearest player at 4.0 m/s, silent except heavy footsteps, and his normal weeping-angel rule is off (you can't freeze him by looking; the only defences are hiding, closed doors, distance and restoring power). He catches players one by one.

Survival: reach 6 AM, or restart the backup generator (once per night) or the main breaker (if the generator gave 20% emergency power): when power returns, Power-Out Freddy dissolves into the dark with a fading laugh, the other animatronics wake up, and the night continues.

### 6.8 The Puppet

Home: inside the gift box in the Prize Corner. Active from Night 3 (only when the music box reaches 0).

When the box runs out (Part 5.5), the Puppet rises out of the gift box (a slow, unfolding, elongated animation), and floats rather than walks (feet a few centimetres off the ground, no footstep sounds, just a high ringing tone and the frantic music box melody from the PA). It glides toward the nearest player at 3.6 m/s, through regular doors (it doesn't open them; it passes through them, so you can't hold a door against it), but not through security shutters. It ignores hiding spots: it knows where you are. Masks don't fool it. It doesn't search; it just comes. A catch by the Puppet skips the downed state (straight to ghost).

The only counter: wind the box above 50% (in person or remotely at reduced speed). When that happens, the Puppet stops, turns toward the Prize Corner, and glides back at 8 m/s, folding back into the box. Teams learn that the music box is life or death from Night 3 on, which makes the "retwist the crank" task the backbone of the night.

### 6.9 The AI Director (pacing)

A Director system (Alien: Isolation and Left 4 Dead style) watches the team and nudges the AI to create a good rhythm of tension and relief without cheating in ways players can see.

It tracks a "stress" estimate per player: rises with nearby threats (distance to the nearest active animatronic), chases, catches, being alone, darkness, and low power; decays when safe. It tracks the team's progress against objectives and the clock.

It acts through small, invisible levers: biasing patrol targets toward or away from players (via the blurred heatmap); temporarily adjusting aggression ±2 for individual animatronics; scheduling "lulls" (after a catch or a long chase, it steers threats away from that player for 30 to 60 seconds so they can regroup); scheduling "peaks" (if everyone's been safe for 90 seconds, it sends the nearest animatronic to investigate the most isolated player's area); and spacing ambient scares (a creak, a distant clank, a door swinging, a light flickering) so the quiet stays tense.

Hard rules for the Director: it never spawns or teleports animatronics in view of a player; it never changes the core character rules (Freddy's freeze, Foxy's cove, the music box); it never gives an animatronic knowledge of a hidden player's location (except the anti-camping hint and the Puppet); its adjustments are clamped and logged. And it must make the first few minutes of Night 1 gentle.

### 6.10 Showtime: the animatronic player

In Mode B, one player becomes an animatronic, chosen from the core four (plus unlocked extras later). They play in third person (camera 3 m behind and 1 m above the head, can toggle first person). They share their character's rules: Freddy-player can only move when no guard is looking at them (the screen goes grey and movement locks when observed, with an eye icon showing how many guards see them); Bonnie-player can "relocate" (an ability: when unseen for 20 seconds, teleport up to 25 m to a node out of sight, 60-second cooldown); Chica-player sees cupcake carriers highlighted through walls within 20 m and moves 20% faster near the Kitchen; Foxy-player must wait in the cove and "charge" a sprint meter that only fills while no guard looks at the cove, then unleash a sprint at 7 m/s for up to 60 m.

Common animatronic-player abilities: "Lights Out" (cut a zone's lights for 15 seconds, 90 s cooldown), "Jam" (jam one door or shutter for 10 seconds, 60 s cooldown), and "Listen" (a 5-second sense that shows noise ripples from guards within 30 m, 30 s cooldown). The animatronic player doesn't see through walls except via abilities. They see in a red-tinted night vision (dark zones are readable to them but desaturated), and guards' flashlights flare brightly in their view.

Balance for Showtime: guards need all required objectives done and to survive to 6 AM, or to exit at 5 AM once objectives are done; the animatronic wins by putting every guard out of the night. Revives work. The AI controls the other core animatronics at a reduced aggression (5) so the building isn't empty; the animatronic player can "possess" another animatronic once per night to swap characters mid-match (a fun twist, 2-minute cooldown).

### 6.11 Navigation and movement

Navmesh: bake a navigation mesh from the level's walkable geometry at server start using `recast-navigation` (the `recast-navigation-js` WebAssembly port works in Node and the browser) with an agent radius of 0.45 m and height 2.1 m for large animatronics, plus a second navmesh with radius 0.25 m and height 0.7 m for small, vent-capable characters (which includes vent and play-tube interiors as walkable). Cache the baked navmesh to disk on first build and load it at startup. Use crowd simulation (DetourCrowd) for local avoidance between animatronics.

Off-mesh links: doors (the agent stops, plays an open animation, the door opens, it walks through), ladders (only small characters), vent grilles (small characters, an enter/exit animation), stage steps, the Cove curtain.

Animatronic animation: animatronics use procedural animation like players (Part 4.17), but with a mechanical feel: jerky head turns (snap to new angles with a slight overshoot), stiff walk cycles with heavy foot plants that shake nearby small props, jaw movement synced to their sounds, eyes that track the nearest player when noticing. When dormant on stage they twitch occasionally. When they open doors they shove them, not gently. When they search a hiding spot, there's a bespoke check animation per spot type. Chase runs are lurching and uncanny (Foxy's run is a low, fast, loping gallop).

Footsteps: each animatronic's footsteps are distinct (Part 11.7) and emitted as positional sounds every foot plant, audible to players within 25 m through walls (muffled). Hearing footsteps through a wall and knowing who it is from the sound is a core skill.

### 6.12 Catches and jumpscares

When an animatronic catches a player, the server sends a `catch` event with the attacker, the victim, and the catch type (standard, from-behind, from-hiding-spot by spot type, Puppet, Golden, Power-Out). The victim's client takes over the camera for the jumpscare (Part 6C.5 has the animation spec), choreographed for free-roam: the victim's view is grabbed and turned to face the animatronic's head (over 0.1 s, very fast), the animatronic lunges with its jaw opening, the scream plays, the screen shakes and flashes, then cut to the downed state. From hiding spots, the jumpscare begins with the spot being torn open from the victim's point of view. Other players nearby see the catch in third person (the animatronic grabbing their friend, the friend collapsing) and hear the scream positionally, which is half the fun of co-op horror.

The catch range is 1.0 m and requires the victim to be in front of the animatronic (within 90 degrees of its facing), to stop "caught through the side of a door" moments. Server-side, use lag-compensated positions (Part 10.6) so a player who visibly dodged on their own screen isn't caught.

### 6.13 Hallucinations

Triggered by the ventilation failure (after 60 seconds unfixed), the Golden Freddy event, and some extended-roster characters. Hallucinations are client-side visual and audio effects driven by seeded server events, so they never directly catch anyone. Effects: a phantom animatronic standing at the end of a hallway that vanishes when your flashlight hits it; red screen tint with a heartbeat; "IT'S ME" text flashing on walls; footsteps right behind you with nothing there; a wall camera turning to follow you; your flashlight flickering while it has full battery; a teammate's voice calling your name from a direction where nobody is (a synthesised whisper, never actual voice recordings). Reduced in photosensitivity mode (no flashes, no rapid flicker).

### 6.14 Fairness rules (non-negotiable)

1. No catches without a tell: every animatronic gives at least one audio or visual cue before a catch is possible (noticed sting, footsteps, laugh, shriek, ringing tone, breathing).
2. No spawning in view; no teleporting in view.
3. No catching through walls, closed doors or from behind solid cover.
4. Hiding works: a player who hides unseen and holds still is found only by search (with the 0.8 s warning), the anti-camping hint, or the Puppet.
5. Chases are escapable at all aggression levels with good use of doors, vents, loops and hiding.
6. Spawn protection at night start (90 seconds on Night 1, 45 seconds later).
7. After a catch, the attacker leaves the area (no immediate re-catch of the reviver unless the reviver walks into it).
8. Everything is logged; the balance script reports "unfair-looking catches" (catches where the victim had no tell in the last 3 seconds) and the number must be zero.


---

## PART 6B: THE COMPLETE SERIES ROSTER ("EVERY CHARACTER")

The owner wants every character from the series in this game, endoskeletons and electrical guts included. That's the right call: half the joy of FNAF is the size of the cast. Here's how we make it work without the game turning into mush.

The core four plus Golden Freddy and the Puppet drive Nights 1 to 5 (Parts 4 and 5). Everybody else lives in three places: the extended threats on Night 6 and Custom Night (each with one clear counter rule, Ultimate Custom Night style), the Archives gallery (every character modelled, posed and animated on a turntable with an x-ray "endoskeleton view" toggle), and Showtime (the Puppeteer can unlock and field extra characters). Every one of them is built procedurally from primitives, every one has a full jumpscare, and every one has an endoskeleton underneath that you can see through tears, at joints, and in the x-ray view.

Names: in `ROSTER_MODE=tribute` these use the classic names. In `ROSTER_MODE=original` every character gets an original name generated from the slot (for example "Ballerina Unit", "Clown Unit") and a recoloured design. Write both names into the roster for each entry. Same IP rules as always: original geometry, original sounds, no ripped assets.

Build them in waves (Part 12 tells you when). If time runs short, ship waves 1 to 3 and leave the rest flagged `comingSoon` in the Archives with a silhouette, but plan the data for all of them from day one.

Important: the one-line "Custom rule" and "Counter" notes in this part were first written for an office-style game. In this free-roam build, each character's actual gameplay rule is the free-roam version in Part 6D, which supersedes anything below that mentions stations, offices, door buttons or tablets. Use this part for the visual design, anatomy, endoskeleton and electrical detail of every character, and Part 6D for how they behave.

### 6B.1 Shared anatomy: the endoskeleton

Every animatronic is a costume over a metal endoskeleton, and the owner specifically wants the electrical side visible. Build one parametric endoskeleton generator in `client/src/render/characters/endo.ts` and reuse it everywhere.

The endoskeleton: a dark gunmetal frame (metalness 0.9, roughness 0.35, with a procedural scratch and grime texture). Skull: a rounded box cranium with a visible jaw hinge, two hydraulic pistons on each side of the jaw, exposed metal teeth (two rows of small boxes), and spherical eyeballs on stalks with an emissive iris. Spine: a stack of short cylinders with disc spacers. Ribcage: thin curved bars (a TubeGeometry along arcs). Shoulders, elbows, wrists, hips, knees and ankles: ball joints (spheres) with servo housings (small boxes with a cylinder motor and a screw head detail). Hands: four jointed fingers made of three cylinders each, with knuckle spheres. Feet: flat plates with toe segments.

The electrical layer is what sells it. Run wiring bundles along the spine and limbs: 3 to 8 thin TubeGeometry wires per bundle, following a CatmullRomCurve3 that sags slightly between joints, each wire coloured from a palette of red, black, yellow, blue and green insulation, with occasional cable ties (tiny tori). Add circuit boards on the back of the skull and in the chest cavity (thin green boxes with a canvas-generated circuit texture: traces, solder pads, a few chip rectangles). Add a small battery pack in the torso with a blinking status LED. Exposed wires at tears end in frayed copper strands (a few very thin bright copper lines splaying out).

Sparks: when a damaged character moves or twitches, emit a burst of 8 to 30 spark particles from a frayed wire end: bright yellow-white points with additive blending, short motion-blur streaks (stretch the sprite along velocity), gravity, a 0.2 to 0.6 second lifetime, and a matching tiny point light that flashes for 80 ms and lights the surrounding geometry. Pair with a crackling electrical sound (Part 11.7). Withered, Phantom, Scrap and broken characters spark often; newer "Toy" characters never spark.

Costume over endo: costumes are separate shells. Torn areas are cut-outs (use alpha-tested textures generated on canvas, or simply omit segments of geometry) through which the endo shows. Each character spec lists its damage map.

X-ray view (Archives only): toggle that renders the costume at 15% opacity with a Fresnel blue rim, and the endoskeleton and wiring at full brightness with emissive pulses running down the wires like current. This is a showcase feature, so make it look great.

Bare endoskeletons as characters: "Endo-01" (the plain endoskeleton from Backstage) is a roaming threat in Custom Night: it moves only when the power usage is at 4 or more bars ("drawn to the current"). Counter: keep usage low. It's also a rare backstage camera event in normal nights: one of the spare endos on the Backstage table turns its head to the camera.

### 6B.2 Wave 1: the original crew (FNAF 1)

Already specced in Part 6C.2: Freddy, Bonnie, Chica, Foxy, Golden Freddy. Add their endoskeleton details: Foxy has the most exposed endo (shins, one forearm, part of the jaw); Golden Freddy has wires hanging from the eye sockets and his torso is partly hollow, with dangling cables visible through a tear in the chest. Freddy has a single loose wire at the left wrist. Bonnie and Chica are intact in wave 1 (their Withered versions in wave 2 are wrecked).

### 6B.3 Wave 2: FNAF 2 cast

Toy Freddy: a shiny, plastic-looking, chubby version of Freddy with rosy cheeks (pink discs), bright blue eyes, a glossy clearcoat material (clearcoat 1.0 in MeshPhysicalMaterial), black hat and bow tie, microphone. Never sparks. Custom rule: "Toy Freddy watches cameras with you." He sits at the South Office door; if the South guard keeps the tablet up for more than 6 seconds straight while he's at the door, he enters. Counter: short camera glances. Mask-able.

Toy Bonnie: pale sky-blue, glossy rabbit with green eyes, long eyelashes, red bow tie, a light blue guitar, pink cheeks. Comes through the Control Room vent. Counter: mask (if Technician) or vent shutter.

Toy Chica: yellow, glossy, pink cheeks, a bib reading "LET'S PARTY!!!", detachable beak (she loses her beak and gets black eye sockets with white pupils when hunting). Holds a cupcake. Counter: mask or door.

Mangle: the dismantled "Toy Foxy": a white and pink tangle of parts, a second endo head attached to its side, exposed wiring everywhere, a lipstick-red mouth, one eye on a bare endo socket. Crawls on the ceiling. Emits radio static that rises as it approaches. Lots of sparks. Counter: close the door when the static peaks.

Balloon Boy (BB): a small human-like animatronic boy with a striped red-and-blue shirt and propeller cap, holding a balloon and a "BALLOONS!" sign. Giggles, says "Hello" (synthesised chirp-voice), and steals the lights (Part 6D).

Jay-Jay: Balloon Boy's sister counterpart, purple. Rare variant of BB. Same rule.

Withered Freddy, Withered Bonnie, Withered Chica, Withered Foxy, Withered Golden Freddy: the FNAF 1 crew, decayed. Faded fur, torn costumes showing lots of endo and wiring, broken jaws. Withered Bonnie has no face at all: just a bare endo jaw and two glowing eyes in a void, with wires hanging from where his face was. Withered Chica's jaw hangs open, wrists are bare endo. Withered Foxy's fur is in tatters. All spark constantly. Custom rules: Withered Freddy, Bonnie and Chica are mask-able but come through any door; Withered Foxy is countered by flashlight only (any station gets a weak flashlight while he's active); Withered Golden Freddy appears randomly in an office and must be met with the tablet up.

The Puppet: specced in Part 6C.2 and Part 6.8.

Shadow Freddy and Shadow Bonnie (RWQFSFASXC): flat purple-black silhouettes with white pupils and teeth. Hallucination-style threats; Shadow Bonnie is the Part 9.4 easter egg.

Endo-02: the plain FNAF 2 endoskeleton that appears in the office. Mask-able.

Paperpals: flat paper-cutout versions of the characters hung on walls. A harmless Custom Night "visual noise" toggle: they appear in random cameras and offices and occasionally turn their heads. No danger, just paranoia.

### 6B.4 Wave 3: FNAF 3 and FNAF 4

Springtrap: a rotten, dull green-yellow rabbit costume with huge holes revealing a human-ish corpse inside: grey withered skin, a skull, dark tendons, wrapped around a springlock endoskeleton. Represent the corpse with a pale, desaturated material with a dark, wet specular and a noise-based "veins" texture, kept stylised and non-graphic (silhouette and colour, not gore). One ear broken. Glowing white pupils in dark sockets. Countered by audio lures; doors only delay him (Part 4.9's Spring Rabbit). In the Archives, the x-ray view shows springlocks: rows of small coiled springs (TubeGeometry helices) at every joint, latched open, which is a great nod to the lore.

Phantom Freddy, Phantom Chica, Phantom Foxy, Phantom BB, Phantom Mangle, Phantom Puppet: charred, burnt versions (blackened fur with orange-ember edges, emissive glowing cracks that pulse dimly, heavy smoke particles). Hallucination threats that become real only when ventilation is down: Phantom Freddy walks past the office window; Phantom Chica appears on the arcade camera; Phantom Foxy appears in the office; Phantom BB appears on a camera and screams if watched; Phantom Mangle produces radio static that blocks voice chat for 6 seconds; Phantom Puppet blocks the screen with its face and forces you to wait 8 seconds. Each "Phantom jumpscare" doesn't kill but causes a maintenance failure.

Nightmare Freddy, Nightmare Bonnie, Nightmare Chica, Nightmare Foxy, Nightmare Fredbear, Nightmare: the dream-horror versions. Huge, sharp-toothed, claw-fingered, torn costumes with jagged edges, spines along the back, and three small "Freddles" (mini Freddys) clinging to Nightmare Freddy. Nightmare Chica has a cupcake with sharp teeth. Nightmare Fredbear is gold and purple; Nightmare is black, translucent, with a white-pupiled stare. FNAF 4 mechanics: listening at doors for breathing. Build a "Listen" action: any guard can hold `L` at a door to hear a breathing sound if a Nightmare is there; if you shine the light while it's breathing, it attacks; if you hold the door closed, it leaves after 4 to 6 seconds. Freddles: little Freddys pile up on the bed in FNAF 4; here they pile up on your desk (visual, up to 3); clicking them away with the flashlight clears them; at 3, Nightmare Freddy attacks.

Plushtrap: a small green Springtrap-like plush that runs down a hall in a mini-game; in Custom Night, it sits in the South Hall and must be caught on an X mark by the light (flashlight on exactly when it's on the X) to earn a bonus hour skip. Rare toggle.

Nightmare Balloon Boy and Nightmarionne: unlockable Custom Night threats. Nightmarionne is the Puppet's nightmare form with long tendrils; if the music box runs out while it's active, it kills instantly instead of travelling.

### 6B.5 Wave 4: Sister Location and Pizzeria Simulator

Circus Baby: a tall girl-like clown animatronic with red pigtails, green eyes, rosy cheeks, a red-and-white outfit and a faceplate that opens into segmented panels, revealing a dark endo face with a claw inside the torso. Faceplates opening is a showcase animation (four plates hinge outward). Custom rule: Circus Baby periodically asks (subtitled synthetic voice) for the guards to "stay still". The station she's visiting must not press anything for 5 seconds. Counter: freeze.

Ballora: a ballerina animatronic, blue-purple, eyes closed, segmented spinning body, plays a twinkly music. You hear her music get louder as she approaches. Counter: if her music grows loud on your side, don't move (no tablet, no doors) until it fades.

Funtime Freddy: white and pink Freddy with a hand puppet (Bon-Bon) on his right hand, faceplates that open. Counter: "Showtime" call; he announces with a voice line (synthetic), and the guard must play the audio lure (any guard can trigger a "party noise" from their station) within 5 seconds.

Bon-Bon: the blue hand puppet. Crawls off Funtime Freddy's hand onto the floor; if it reaches your feet you lose your tablet for 10 seconds.

Funtime Foxy: white and pink fox with a bow tie, a dark, flashing stage light ("Showtime" mechanic). Counter: you can only open your door at the right time; a little sign shows the time of his show.

Minireenas: tiny ballerina dolls that climb onto your screen and block the view. Counter: shake them off by moving the mouse fast (or pressing `X` rapidly).

Bidybabs: tiny baby animatronics that try to get through the vent. Counter: hold the vent shutter while they're on the other side.

Ennard: a mass of tangled endoskeleton parts and wires with a white clown mask, the most "electrical" character in the series. Wires everywhere, eyes from different animatronics in different places. Moves through vents. Countered by vent shutters and silence. Very high spark rate. Its x-ray view is just more wires: it's all endo.

Electrobab: a Bidybab variant charged with electricity, visibly crackling with blue arcs. It's our electrical showcase: when it's active, arcs of electricity crawl along office walls (procedural lightning bolts made of jittering line segments with a glow pass). Counter: cut power to the door it's at (Technician power routing can cut a station's power for 3 seconds).

Yenndo: a yellow endoskeleton (Funtime Freddy's endo). Rare Archives-only character with a creepy Custom Night appearance where it stands in a random office corner, harmless, until you look at it twice.

Lolbit: an orange-white fox, a "glitch" character that appears on cameras saying "PLEASE STAND BY". Counter: type L-O-L on the keyboard.

Molten Freddy: a mess of wires and Funtime parts, with Funtime Freddy's head and several eyes. Laughs in the vents. Counter: vent shutter at the right time.

Scrap Baby: Circus Baby rebuilt from scrap, with a claw arm, roller skates and wheels, rusted plating and exposed wiring. Counter: shock her with the "controlled shock" button (a new Control Room tool that becomes available when she's toggled on).

Scraptrap (William Afton): a decayed Springtrap, thinner, more endo than costume. Counter: the Technician must use the flashlight in the vent when he's at the vent opening.

Lefty: a black bear with a red microphone, rosy-red cheeks and one eye covered. Counter: a "calm" music box; Lefty grows agitated when the room is too hot (see heater below), so keep temperature down.

Rockstar Freddy, Rockstar Bonnie, Rockstar Chica, Rockstar Foxy: brightly coloured, polished "rockstar" redesigns with stage outfits (sunglasses, guitar, a parrot on Rockstar Foxy's shoulder). Rockstar Freddy demands Faz-Coins: he stands in the office saying "deposit five coins", and the guard must pay 5 in-match coins (earned by catching collectibles) or use the heater to make him malfunction. Rockstar Foxy offers random help (his parrot flies in; click it for a boon: power refill +10%, a door lock, or a free reboot).

Happy Frog, Mr. Hippo, Pigpatch, Nedd Bear, Orville Elephant: the cheap "Trash and the Gang" style animatronics from Pizzeria Simulator. Clunky, chunky designs, made from a few simple shapes with garish colours. Counter: they share the vent system; the Technician's vent shutter works on all of them. Mr. Hippo rambles in voice lines (synthetic babble) that make Custom Night players laugh.

Music Man: a giant spider-like DJ animatronic with six arms holding cymbals. Counter: make no noise. Each noisy action (doors, tablet raises) raises a noise meter; at max, he comes.

El Chip: a Mexican-themed beaver mascot who delivers sales pitches on screen (an ad overlay that blocks part of the screen until you click "skip"). Harmless but annoying, which is the joke.

Helpy: a tiny version of Funtime Freddy with an airhorn, who lands on your screen and honks. Counter: don't let him; click him before he honks.

### 6B.6 Wave 5: Ultimate Custom Night extras and the digital era

Old Man Consequences: a stylised red crocodile-like figure fishing in a dark pond. When active, a fishing minigame appears on the tablet occasionally; catching the fish with the right timing is required or the game "freezes" (a 10-second power-system lockout).

Dee Dee: a girl character who appears on the title-like loading screen and randomly adds a surprise threat mid-night. Custom Night's chaos card.

XOR: Dee Dee's shadow version. Same rule but she adds a Shadow-only threat.

Glitchtrap: a digital purple-and-yellow rabbit-costume figure with a vest and bow tie, rendered with a vertex-jitter glitch shader, RGB split and occasional pixel block corruption. Appears in camera feeds and the tablet UI as a hacking threat: when he's "in the system", camera switching sometimes takes you to the wrong camera. Counter: the Technician runs an "Antivirus" reboot.

Vanny: a person in a white rabbit costume with red eyes, a long-tailed sleek outfit. Hops on cameras in the Help Wanted / Security Breach style. Counter: if you see her on camera, switch away within 2 seconds or she moves one node closer to you; she's a cameras-only threat.

Glamrock Freddy, Glamrock Chica, Montgomery Gator, Roxanne Wolf: the Security Breach generation. Neon, plastic, shiny designs with LED accents, glitter, and colourful guitars. Glamrock Freddy is our protective friendly animatronic: in Custom Night with "Glamrock Freddy Helper" on, he protects one random station per hour by sitting in front of its door (the door counts as closed at zero power cost). Glamrock Chica: lures guards with food sounds; counter is the Kitchen Mic. Montgomery Gator: smashes through doors after 3 hits (doors take damage, shown as a crack decal); counter is Technician reroute. Roxanne Wolf: can "see" guards on cameras when they look at her; looking at her for more than 1 second alerts her.

The Daycare Attendant (Sun and Moon): a jester-sun animatronic with a big rayed face, and a moon form with a hat and a dark face. Sun is friendly when lights are on; Moon hunts when lights go out. Custom rule: during a blackout or Lights Out ability, Moon hunts a random station, and only turning that station's light on (if power remains) makes him retreat.

Burntrap: a burnt, endoskeleton-heavy Springtrap form with exposed wires everywhere, glowing eyes, many wires coming out of the back like tendrils. Counter: the flashlight's full beam.

The Mimic: an adaptive endoskeleton from Secret of the Mimic. It's a tall, grey, angular endo with oversized hands. Custom rule: at the start of each hour, it copies the behaviour of one other active character, chosen randomly, and you have to work out which by its tells. In its x-ray view it's pure endo, with a "costume" layer that cycles between other characters' silhouettes. This is the most fun character to implement, so do it well.

Shattered Glamrocks, Bonnie Bowl's Glamrock Bonnie, STAFF bots, Moon variants and other Security Breach era extras: if you reach this point, add a "Pizzaplex" pack of three to five of these as Archives entries with a single shared Custom Night rule ("STAFF bots wander and flag your station; flagged stations get one extra animatronic attempt").

Into the Pit's yellow rabbit and Secret of the Mimic's Costume Manor creatures: add as Archives entries with silhouettes and brief original descriptions.

### 6B.7 Implementation rules for the big roster

Every character module exports: `id`, `names`, `wave`, `build(skin)`, `poses` (idle, walk, lean, stare, crawl, sitting, slumped), `jumpscare(builder)`, `sounds` (ids into the audio bank), `customNight` (description, counter tip, default AI, the rule implementation as a sim plugin), `endoDamageMap`, `sparkRate`.

Implement rules as sim plugins with a common interface (`onTick`, `onPlayerAction`, `onHour`, `onPowerChange`) so Custom Night can stack any subset without special cases. Write a unit test per rule (does the counter work, does the threat kill when not countered, does it respect photosensitivity for flashes).

Performance: no more than 12 animatronics can be "active" in any one Custom Night (UCN capped at 50 but those were 2D sprites; we're rendering 3D). The Custom Night screen enforces the cap with a counter ("12/12 active"). Characters not visible on any player's screen aren't rendered at all; characters on camera render once into the camera's render target per camera update, not every frame (Part 11.3).


---

## PART 6C: CHARACTER VISUAL DESIGN AND THE ROSTER FILE

All characters are built procedurally in Three.js from primitives (spheres, capsules, cylinders, boxes, tori, lathe geometry) with custom materials, in `client/src/render/characters/`. No external models. This is very doable: FNAF animatronics are chunky, rounded, plush-meets-machine designs, which suit primitive modelling, and our CRT/grain post-processing hides the low poly count. Each character is a function `buildFreddy(skin: CharacterSkin): THREE.Group` returning a rigged-ish hierarchy (head, jaw, torso, arms, hands, legs, ears, eyes) so poses and jumpscare animations can rotate parts.

### 6C.1 The look that makes animatronics creepy

Uncanny comes from a few specific things, so get these right. Eyes: glossy spheres with a small, bright pupil (an emissive disc), slightly too far apart, catching light. In darkness, show only the pupils as tiny glowing points; that's terrifying on a camera feed. Jaw: a separate lower jaw that hinges open, revealing two rows of flat, slightly dirty white teeth (small boxes) and a dark mouth interior where you can just see the metal endoskeleton teeth behind. Fur: a matte, slightly fuzzy material (use a noise-based normal map generated in a shader or a canvas texture, plus a subtle rim light to suggest fluff). Wear and tear: dirt and grime overlays (a canvas-generated noise texture multiplied in), some stains near the mouth, scuffs on the hands. Joints: show glimpses of the endoskeleton at wrists and ankles (dark grey metal cylinders). Posture: slightly slumped, head tilted, arms hanging. Never perfectly symmetrical; give each a small random tilt.

Lighting is everything. Characters on camera are lit by a single harsh light from above or from the camera's direction (like a cheap IR camera), with deep shadows. In the doorway light, they're lit from the side by the office's door light, so half the face is in shadow.

### 6C.2 Core roster visual specs (tribute mode)

Freddy: a big, round brown bear, about 2.0 m tall. Light tan muzzle and belly patch. Small black top hat and black bow tie. Holds a microphone (a thin black cylinder with a sphere on top) in his right hand. Round ears with darker inner circles. Blue eyes (pupils white-blue glow). Big, wide-set build. In darkness only his eyes show.

Bonnie: a tall, lean rabbit, about 2.1 m with ears. Purple-blue fur (#5B5FB8 range), lighter lavender muzzle and belly. Red bow tie. Long upright ears with pink inner faces, slightly bent. Red-magenta irises with white pupils. Carries a red electric guitar (simple extruded body and neck). Long thin limbs.

Chica: a yellow chicken, about 1.9 m. Orange beak with a hinged lower half, purple-pink irises. White bib that says "LET'S EAT!!!" in a chunky font (render the text into a canvas texture). Holds a pink cupcake on a plate with a single candle and two googly eyes on the cupcake. Wide hips, small wing-arms. Three small tufts on top of the head.

Foxy: a red fox pirate, about 1.95 m. Dull red fur, tattered and ripped with exposed endoskeleton showing through his legs and one arm. An eyepatch flipped up over his right eye. A silver hook on his right hand. Long snout with a hinged jaw full of sharp teeth, more menacing than the others. Yellow eyes. Torn brown pants.

Golden Freddy: Freddy's shape, but slumped on the floor, empty black eye sockets with tiny white pinpoint pupils, faded gold-yellow fur, dusty, with wires hanging from the eye sockets. Purple bow tie and hat. In his jumpscare his head fills the screen with jaw open wide.

The Puppet: very tall (2.4 m), thin, black body with white stripes on wrists and ankles, three white buttons down the chest, long thin arms and fingers. A white, smooth mask face with black hollow eyes containing white pupils, red cheek circles, a smiling red mouth, and purple lines running down from the eyes. Emerges from a large striped gift box with a bow.

### 6C.3 Original-mode roster (the fallback cast)

When `ROSTER_MODE=original`, the same mechanics, routes and silhouettes apply, but names, colours and props change enough to be clearly distinct characters. Implement these as alternate skins of the same builder functions, plus a name map.

| Role slot | Tribute | Original name | Original look |
|---|---|---|---|
| Leader bear | Freddy Fazbear | Barnaby Bear | Grey-blue bear, red bowler hat, yellow neckerchief, holds a banjo instead of a microphone |
| Rabbit | Bonnie | Rosie Rabbit | Mint-green rabbit with one floppy ear, plays a tambourine |
| Bird | Chica | Peggy Pelican | White-and-orange pelican with a huge pouch beak, carries a tray of pizza slices, bib says "MORE PIZZA!" |
| Fox | Foxy | Captain Rusty | Copper-orange raccoon pirate with a peg leg and a telescope instead of a hook |
| Golden | Golden Freddy | The Gilded One | Dusty bronze version of Barnaby with no hat, cracked face plate |
| Puppet | The Puppet | The Jester | Tall jester marionette with a crescent-moon mask and bells |
| Venue | Freddy Fazbear's Pizza | Barnaby's Big Bite Pizza Palace | |
| Company | Fazbear Entertainment | Big Bite Entertainment, Inc. | |
| Currency | Faz-Tokens | Bite Tokens | |

All UI copy and phone call text references characters through roster lookups (`roster.name('leader')`, `roster.venue()`, `roster.company()`), so the swap is complete.

### 6C.4 Guard characters (the player avatars)

In this free-roam game the guards are fully visible characters: teammates see each other walking, crouching, crawling, carrying cupcakes and hiding, and you see your own legs and hands in first person. So the guard model matters as much as the animatronics, and skins are on show all the time. Guards appear in-world (third person for others, first-person body for yourself), in the lobby (a 3D portrait on a turntable), in the Locker Room, on the downed and ghost states, on the Employee of the Month wall in the Lobby, on the paycheck screen and on the profile page. Hands and sleeves show the uniform's colours in first person.

The guard model is a stylised human built from primitives with a proper skeleton for procedural animation (Part 4.17): a shaped torso (lathe geometry), a head with a simple face (eyes, brows, nose, mouth as small shapes so emotes read), hands with four fingers and a thumb, a security cap, a badge, a uniform shirt with a collar and pockets, a belt with a radio holster, trousers and shoes. Built procedurally from a `GuardSkin` descriptor (Part 8.4). Keep the style slightly toy-like and low-poly so it matches the animatronics.

### 6C.5 Jumpscare animation spec

Each jumpscare is an 0.8 to 1.2 second animation played on the caught player's screen only (teammates see the third-person catch, Part 6.12):

1. Frame 0: the player's view is yanked (0.1 s) to face the animatronic's head at about 1.2 m away, which is already lunging. If the catch came from a hiding spot, the first frames show the spot being torn open.
2. 0 to 0.25 s: the animatronic's head rushes toward the camera (scale/position tween with an ease-out), jaw opening to max. The camera shakes violently (random offsets of 2 to 6 pixels equivalent, 60 Hz).
3. 0.25 to 0.8 s: head fills the frame, jaw snapping slightly, eyes rolling, body jittering. Heavy chromatic aberration and a red-white flash on the first 3 frames.
4. Audio: the scream sound (Part 11.7) starts on frame 0 at full volume (respecting the jumpscare volume setting).
5. Cut to static for 0.5 s, then the downed state (Part 4.14).

Foxy's jumpscare is a running lunge that knocks the player backwards; Golden Freddy's is a single still, full-screen, with the scream distorted and a faked crash; the Puppet's is a slow rise into frame followed by a sudden snap. Power-Out Freddy's is a forward lunge from total darkness.

Provide a "Reduced jumpscare intensity" option (Part 9.6) that removes the flash and screen shake and caps the scream volume.

### 6C.6 The roster file

`shared/content/roster.ts` exports a typed object. Each entry includes: id, slot, `names: { tribute, original }`, size class (large, small, special), home point, patrol graph (preferred zones and weighted nodes), default aggression per night, speed and perception overrides, flags (mask-able, freeze-when-watched, vent-capable, phases through doors), audio cue ids (footsteps, noticed sting, chase loop, idle), eye colour, jumpscare id, Custom Night description and counter tip, and the plugin module that implements its rule (Part 6D). Write it once and read from it everywhere: simulation, renderer, UI, tests.

---


---

## PART 6D: FREE-ROAM RULES FOR THE WHOLE ROSTER

This is the gameplay rule for every character beyond the core cast, rewritten for a walkable building. Each rule is a sim plugin (Part 6C.6 and 6B.7) with the same lifecycle hooks (`onNightStart`, `onTick`, `onNoise`, `onPlayerAction`, `onHour`, `onPowerChange`, `onCatch`). "Size" decides which navmesh it uses: Large (normal halls and rooms, can't enter vents or tubes), Small (can use vents, play tubes and the crawlspace), or Special (floats, phases, or doesn't physically walk). Every rule has a tell, a counter, and a unit test that proves the counter works.

### 6D.1 FNAF 2 cast

| Character | Size | Free-roam rule | Tell | Counter |
|---|---|---|---|---|
| Toy Freddy | Large | Slow, patient patroller that loves the Arcade; plays cabinets (stands at one, screen light on his face) for 20 to 40 s, then walks the Party Room Hall | Arcade jingle cuts out when he leaves a cabinet | Mask fools him; avoid the arcade when the jingle stops |
| Toy Bonnie | Small (vent-capable) | Moves through the vent network and pops out of floor grilles into rooms near players | Rapid vent banging growing closer, a guitar riff in the duct | Close vent grilles behind you; mask fools him in rooms |
| Toy Chica | Large | Patrols the Party Rooms; when she starts hunting she removes her beak (black sockets, white pupils) and moves 20% faster | Her beak clatters to the floor (sound) | Mask; she can't resist placed cupcakes (stops for 8 s) |
| Mangle | Small | Crawls along ceilings (walks the ceiling plane of rooms and halls) and through vents; drops onto players from above | Rising radio static on walkies and in your ears as she gets close; a garbled child's radio voice | Look up and keep your flashlight on her: she retreats into the nearest vent after 2 s of being lit |
| Balloon Boy | Small | Wanders the Play Zone and Arcade; if he reaches a player he latches on, giggling, and "steals" their flashlight (disables it for 30 s) and laughs loudly every few seconds, which attracts other animatronics | "Hello!" and giggles, balloon squeak | Don't let him reach you (he's slow); hide in a spot he doesn't fit (lockers); flashing him with a Faz-Cam sends him away |
| JJ | Small | Rare variant of BB that hides under tables; crawling under a table she's under gives a jump scare and steals one random small item, which she drops somewhere else in the building | A giggle from under a table | Check under tables with your flashlight before hiding |
| Withered Freddy | Large | A darker, slower Freddy who ignores the weeping-angel rule but follows the "Freddy prefers darkness" rule strongly; stands in dark zones and only moves when that zone's lights are off | Deep groaning when he moves | Light zones he's in; he won't advance into a lit zone |
| Withered Bonnie | Large | Faceless; can't see well (vision range halved) but hears twice as well | Wires sparking where his face should be; sparks light the area in bursts | Move slowly and quietly; crouch-walk past him |
| Withered Chica | Large | Lurks in the vent openings with her upper body in the vent and her jaw hanging; blocks one vent route at a time | Her jaw clacking inside the duct | Pick another route; the mask fools her |
| Withered Foxy | Large | Like Foxy but starts from Parts & Service and sprints at the nearest player who's been in the dark for 15+ seconds | A hook scraping along walls | Focus your flashlight on him: he's repelled by sustained light for 3 s and resets |
| Withered Golden Freddy | Special | Appears slumped in a random room a player is about to enter; if that player's flashlight lands on him, he vanishes; if the player walks past him in darkness, he catches them | Whispering, a golden glint | Sweep rooms with your flashlight before entering |
| The Puppet | Special | Part 6.8 | Part 6.8 | Music box |
| Shadow Freddy | Special | Appears in a lit zone's corner as a purple silhouette; if a player stares at him for 2 s, that zone's lights go out | A low hum | Glance, don't stare |
| Shadow Bonnie | Special | The glitch easter egg (Part 9.4); in Custom Night, staring at him for 3 s teleports you to a random room in the building | Visual glitch artefacts | Look away |
| Endo-01 / Endo-02 | Large | Bare endoskeletons that wake only when building power usage is high (more than 70% of circuits on): drawn to the brightest lit zone | Servo whine and metal footsteps | Keep usage down; mask fools them |
| Paperpals | Special | Paper cut-outs on walls that turn their heads to follow players; harmless paranoia | Paper rustling | None needed |

### 6D.2 FNAF 3 and FNAF 4 casts

| Character | Size | Free-roam rule | Tell | Counter |
|---|---|---|---|---|
| Springtrap | Large | A single relentless hunter (FNAF 3 style): always knows the general zone of the nearest player, moves one zone at a time, can open vents (but crawls slowly in them), and opens doors forcefully (holding a door only delays him 2 s) | Heavy, dragging footsteps; a death rattle breath; seen on cameras moving one camera at a time | Audio lures are the only reliable redirect: Security Office zone speaker lures pull him 100% of the time; noisemakers pull him 60% |
| Phantom Freddy | Special | Only when ventilation has failed: walks past a window or doorway near a player; if they look at him for 1 s he lunges (a phantom jumpscare, no catch) and the ventilation failure worsens (hallucinations double) | A burnt, smoky smell effect on screen edges | Fix ventilation; look away |
| Phantom Chica | Special | Ventilation failed: appears on the arcade screens; looking at her turns off the Arcade circuit | Arcade screens glitch | Fix ventilation |
| Phantom Foxy | Special | Ventilation failed: appears behind a player who stands still for 10 s; a phantom jumpscare that knocks their flashlight battery down by 25% | Pirate laugh behind you | Keep moving |
| Phantom BB | Special | Appears on cameras; if you watch him, he screams and the camera system fails | Static spikes | Switch camera quickly |
| Phantom Mangle | Special | Radio static: walkies stop working for 15 s | Garbled radio | Fix ventilation |
| Phantom Puppet | Special | Blocks a player's view with its face for 4 s (a full-screen overlay), freezing them in place | Ringing tone | Fix ventilation |
| Nightmare Freddy (with Freddles) | Large | Freddles (three small Freddy plush-robots) appear near a player who's been still (hidden or standing) for 30+ s and climb onto them; at three Freddles, Nightmare Freddy arrives at that player | Freddle giggles and squeaks | Shake them off by moving (sprint 3 s) or flashlight them |
| Nightmare Bonnie and Nightmare Chica | Large | They wait behind doors: when a player presses an ear to a door (Part 4.10) and hears breathing, opening that door or shining a light through its window triggers a catch; waiting 5 s makes them leave | Breathing behind doors | Listen at doors before opening; if you hear breathing, wait |
| Nightmare Foxy | Large | Hides inside a closet or locker hiding spot and waits; a player who enters that spot is caught | A low growl from the closet if you put your ear to it | Listen before hiding; the closet door twitches |
| Nightmare Fredbear | Large | Roams freely and swaps between left and right halls; laughs when he swaps sides | A distinct laugh | Track the laugh; close shutters |
| Nightmare | Special | Black, translucent version of Fredbear; only visible in darkness; standing in a lit zone makes you safe from him | Faint outline in the dark | Stay in light when he's active |
| Plushtrap | Small | Runs around the Play Zone; if caught in a flashlight beam exactly while standing on an "X" decal on the floor, he freezes and rewards an hour skip (Custom Night only); otherwise harmless | Pattering footsteps | Optional bonus |
| Nightmare BB | Small | Sits on a party table; turning your flashlight on while he's within 6 m and facing you makes him pursue | Giggle | Turn your light off near him |
| Nightmarionne | Special | If the music box hits 0 while he's active, he's instantly behind the nearest player (no travel) | Long tendrils on screen edges | Never let the music box run out |

### 6D.3 Sister Location and Pizzeria Simulator casts

| Character | Size | Free-roam rule | Tell | Counter |
|---|---|---|---|---|
| Circus Baby | Large | Talks to players over the PA in a synthesised voice ("Stay still. Stay very still.") targeting one named player; that player must stop moving for 5 s or she comes for them directly | Her voice line and the player's name on screen | Freeze when called |
| Ballora | Large | Glides through rooms with her music getting louder; players in the same room must not move (any movement above 0.5 m/s while her music is loud gets noticed) | Music volume | Freeze until it fades |
| Funtime Freddy and Bon-Bon | Large + Small | Funtime Freddy announces "Showtime!" and hunts the nearest player; Bon-Bon (the hand puppet) detaches and crawls through vents to steal the Faz-Pad | "Showtime!" voice line; Bon-Bon's squeaky laugh in vents | Play the stage lure within 10 s of his announcement to send him to the stage; close vent grilles |
| Funtime Foxy | Large | Lives in the Party Room Hall; a sign on the wall shows his "showtime" (an in-game hour); entering the hall at any other time is safe, entering during his showtime is deadly | The flashing light in the hall | Read the sign; avoid the hall at showtime |
| Minireenas | Small | Tiny dolls that climb onto players and block parts of the screen | Little footsteps; giggles | Shake them off by moving the mouse quickly or vaulting |
| Bidybabs | Small | Crawl through vents and try to open a vent grille near a player; if a player is crouched in front of an open grille, they get grabbed | Small knocking inside vents | Hold vent grilles shut (look at the grille and hold E) |
| Electrobab | Small | Charged with electricity: crackling blue arcs crawl along the walls of whatever room it's in; touching an electrified wall or standing in a puddle in that room stuns the player for 2 s (a scream, loud) | Arcs on walls, a buzzing hum | Avoid walls and puddles; cutting that zone's circuit at its switch panel discharges it |
| Ennard | Small | A mass of wires that travels through vents and play tubes; when it reaches a vent near a player, it reaches out with wire tendrils | Wire scraping, many glowing eyes in the duct | Close grilles, stay out of vents when you hear it |
| Yenndo | Large | Stands in room corners, harmless until a player looks at it twice within 10 s; then it follows them silently for 30 s | Nothing (that's the point) | Don't double-check corners |
| Lolbit | Special | Hijacks wall monitors and the Faz-Pad with "PLEASE STAND BY"; typing L-O-L on the keyboard clears it | Monitor glitch | Type LOL |
| Molten Freddy | Small | Moves through vents laughing; the vent junction he's in can't be passed | Laughter in the vents | Pick another route |
| Scrap Baby | Large | Stands motionless in one room; if a player is in the room for more than 10 s, she moves toward them in bursts; a controlled shock from a wall panel (Night 6 tool in the Breaker Room) stuns her | Rolling skate wheels | Don't linger; use the shock panel |
| Scraptrap | Large | Lurks in the basement; when a player opens a basement door, he may be on the other side | A creak and a rattle | Peek first; the flashlight focus makes him retreat for 5 s |
| Lefty | Large | Calm when the building is quiet and cool; agitated (hunts) after loud noises accumulate; noise meter visible on the clipboard when he's active | Agitation growl | Stay quiet |
| Rockstar Freddy | Large | Stands at a doorway and demands "five Faz-Tokens"; deposit 5 tokens (interact) or he blocks that doorway for the rest of the hour; using a Faz-Cam flash makes him malfunction for 30 s | Voice line demanding coins | Pay up or find another route |
| Rockstar Bonnie | Large | Loses his guitar somewhere in the building; return it to him (a large object) or he hunts | "Where's my guitar?" | Find the guitar |
| Rockstar Chica | Large | Stands outside a door with a "wet floor" sign; she leaves when you put the sign at a different door | Mop sounds | Move the sign |
| Rockstar Foxy | Special | Helpful: his parrot flies to a random player once per hour; interacting with the parrot gives a random boon (refill your flashlight, reveal all animatronics on the paper map for 10 s, or add 5% power), or sometimes a dud (the parrot squawks loudly) | Parrot squawk | None needed |
| Happy Frog, Mr. Hippo, Pigpatch, Nedd Bear, Orville Elephant | Small | Cheap animatronics that use the vent network; they're slow and loud; if they reach a player in a vent, it's a catch | Clunky clattering; Mr. Hippo rambling stories (synthesised babble) | Close grilles; avoid vents when you hear them |
| Music Man | Large | A noise meter for the whole team: every loud action fills it; at full, Music Man walks to the loudest recent noise and hunts there | Cymbals crashing louder as the meter fills | Be quiet as a team |
| El Chip | Special | An "advert" overlay appears on a random player's screen, blocking 30% of the view, until they click "skip" | Jingle | Click skip |
| Helpy | Small | Pops up next to a player and blasts an airhorn (very loud, attracts everyone within 30 m) unless the player clicks him within 1.5 s | His little "Helpy!" voice | Click him fast |

### 6D.4 Ultimate Custom Night extras and the digital era

| Character | Size | Free-roam rule | Tell | Counter |
|---|---|---|---|---|
| Old Man Consequences | Special | Once per hour, a fishing mini-game appears on one player's screen; catch the fish (timing) or that player's controls freeze for 8 s | Splash sound | Catch the fish |
| Dee Dee and XOR | Special | Dee Dee adds a random extra character for 2 minutes once per hour; XOR adds a shadow character | Her shout at the top of the screen | Adapt |
| Glitchtrap | Special | A digital entity in the cameras and terminals: while active, camera switching sometimes shows the wrong feed, the paper map shows a fake position for you, and terminals display messages addressed to a player by name | Purple glitch artefacts on screens | Run the antivirus at the Server Room terminal (hold 10 s) |
| Vanny | Large | Appears on cameras and at the ends of halls; if a player sees her and doesn't break line of sight within 2 s, she skips toward them; she never runs when watched in person, only on camera | A skipping, humming figure | Look away fast on cameras, hold her with a flashlight in person |
| Glamrock Freddy (helper) | Large | Friendly: follows one player around (the one with the lowest stress, Part 6.9) and lets players hide inside his chest cavity (a hiding spot that moves); occasionally he powers down to recharge and you must leave him | His friendly voice lines ("Superstar!") | None; he's a friend |
| Glamrock Chica | Large | Distracted by food: eats from bins and trays; a player can throw pizza to distract her for 15 s; she hunts by sight | Crunching sounds | Feed her |
| Montgomery Gator | Large | Smashes through doors after three hits (doors take visible damage); charges in straight lines and can't turn quickly | Bass guitar riffs and heavy stomps | Sidestep the charge; use shutters (he can't break shutters) |
| Roxanne Wolf | Large | A seeker with heightened sight (vision range +50%) who narrates out loud when she spots someone ("I see you!"), alerting other animatronics | Her voice lines | Stay out of her sight lines; hide fast |
| Sun and Moon (Daycare Attendant) | Special | Sun is harmless and cheerful while lights are on in the Play Zone; if the Play Zone lights go out (or a blackout), he becomes Moon and hunts anyone in the Play Zone or vents | Lights flicker and Sun screams "Lights out!" | Keep the Play Zone lit; flip its switch back on |
| Burntrap | Large | Moves only through the Stage Crawlspace and maintenance tunnels and emerges from hatches near players | Hatches rattling | Flashlight focus on him for 2 s sends him back down |
| The Mimic | Large | Adaptive: at the start of each in-game hour, copies the behaviour rule of another active character (randomly chosen) and takes on a silhouette hint of that character (a costume piece); in an hour without others it copies the core cast's rules in turn | Its costume piece changes, and its footsteps imitate the copied character's | Work out who it's imitating from the tells and counter accordingly |
| STAFF bots | Large | Wander on fixed routes; if one spots a player, it plays an alarm that alerts every animatronic to that location | A robotic "Please return to the party" voice | Avoid their sight lines; their routes are predictable |

### 6D.5 Which characters appear where

Campaign nights use the core cast (Part 5.11). Night 6 adds two random characters from Waves 2 to 3. Custom Night offers every built character. Showtime offers the core four, plus Springtrap, Circus Baby, Glamrock Chica and the Mimic as unlockable animatronic-player characters (each with their rule turned into abilities, using the same pattern as Part 6.10). The Archives gallery shows every character, with silhouettes for unbuilt ones.


---

## PART 7: WRITING (CALLS, TAPES, EMAILS, NOTES, POSTERS)

All text below is original. Use it as written or polish it in the same voice. Write the texts as templates with placeholders `{venue}`, `{company}`, `{leader}`, `{rabbit}`, `{bird}`, `{fox}`, `{puppet}`, `{golden}` so the roster mode swaps everything. The phone caller is the Day Manager, a friendly, slightly awkward guy recording messages for the new night shift. Don't name him.

Calls play from the Security Office phone at 12:05 AM (anyone within 6 m hears it, and walkie carriers hear it through the radio). Subtitles always available. Default voice: a muffled "talking" babble synthesised to match the rhythm of each line (Part 11.7), plus subtitles; optional Web Speech voice with a phone filter. Calls can be skipped by anyone answering and hanging up, but a skipped call's text stays readable on the office's answering machine (interact) for the rest of the night.

### 7.1 Night 1 call: "Orientation"

"Hey! Hello, hi. Okay, is this thing recording? Yeah. Okay. Welcome to the night shift at {venue}, Location Seven! I'm the day manager, and I've been asked to leave you all a few orientation notes. There's four of you this year, which is new. Corporate's never hired a whole team for nights before. Don't read into that.

So. First thing. The power. The building's on its last legs, electrically speaking. When you clock in, the main breaker's off to save money overnight. You'll need to head down to the basement, find the breaker room, and get the power back on. There's a panel with a big needle. Get the needle in the green, pull the big lever. If it bangs and sparks, you overdid it. Wait for it to cool and try again. Easy.

Then go round and turn the lights on, zone by zone. Some of the fuses are shot. There's spares in the supply closet off the west hall. Try not to leave every light on all night, though. The power doesn't last forever, and trust me, you don't want to be in here when it runs out.

Second thing. The music box. Prize Corner, back of the dining hall. There's a crank. Give it a good wind every now and then. It's been here longer than me. Just keep it playing, okay? Keep it playing.

Third thing. The cupcakes. Tonight was supposed to be a birthday party, and the kitchen made cupcakes, and corporate wants them out on the birthday tables for the morning. Five cupcakes, five tables with the little star cards. Don't eat them.

And, uh. The characters. {leader}, {rabbit}, {bird}, and our pirate pal {fox} back in the cove. They're on a free-roam mode at night. Something about the servos locking up if they stand still too long. They'll wander. If they see you, they might not, um, recognise you as a person. They might think you're a bare endoskeleton without a costume on, and that's against the rules here, so they'll try to help you into one. Which, the costumes are full of crossbeams and wiring. So. You'd rather not.

If one of them spots you, get out of sight. There's lockers, cupboards, tables, whatever. Hide, stay quiet, let them lose interest. If one of your team gets grabbed, they'll be shaken up but they'll live, probably, if you get to them fast and help them up. So stick close-ish.

Okay. That's it. Clipboard's by the time clock. Good luck, you four. I'll check in tomorrow."

### 7.2 Night 2 call: "Busy Night"

"Hey, hello! You all made it to night two! Great. I mean that. Last year's guy didn't, uh. Never mind.

So, things get a little busier from here. {rabbit} and {bird} get more curious. {rabbit} especially likes to pop up where you just looked, so keep checking behind you. {bird} lives in the kitchen if you let her. She can smell those cupcakes. Seriously. If you're carrying the whole tray past the kitchen, you're basically a walking dinner bell. Maybe split them up between you.

And {fox}. The pirate. He's back online tonight. He doesn't like being watched, but he hates being ignored. Somebody needs to check the cove every so often. In person, or on the cameras. If the curtain's open and he's gone, he's running. Down the west hall, usually. Fast. Get out of the hallway, get behind a door, or get hidden. You'll hear him coming.

The building might start acting up too. Cameras dropping out, the PA going quiet. There's a server room in the basement for the cameras. The stage booth fixes the speakers. Somebody can sit in the security office and keep an eye on everyone through the cameras, if you want. You can play sounds through the speakers to draw the characters away from your friends. Think of it as teamwork.

Okay! Talk soon!"

### 7.3 Night 3 call: "Showtime"

"Hello, hey, night three, look at you four! You're practically veterans. I've got a feeling you're the team that makes it.

Couple of things. The kitchen's out of ready-made cupcakes, so you'll have to bake them. Tray's in the pantry, oven's right there. It takes a bit, and the oven's loud. You know who likes loud ovens.

And the music box. Tonight it matters. I can't really explain the, uh, the thing in the box. Just, if the music stops, it comes out. And it doesn't stop coming until the music starts again. Doors don't help. Hiding doesn't help. Only the music. So whoever's closest, wind it. You can wind it from the cameras too, slower. Keep it above half if things get hairy.

And {leader}. He's going to start moving now. Here's the strange part: he doesn't move while you're looking at him. At all. So look at him. And if you need to turn your back, make sure somebody else has eyes on him. Cameras count. If he's out of sight, he's closer. He likes the dark, so lit rooms help.

Oh, and the breaker might trip once or twice. Old building. Back to the basement if it does. Sorry.

And if anybody sees a gold bear somewhere he shouldn't be, just, look away. Don't ask why. I don't know why. Okay, bye!"

### 7.4 Night 4 call: "Flooded"

"Uh, hello? Hey. Hi. Listen, if you're hearing this and you're all still together, great, I had a feeling you'd make it.

I'm, uh, I might not be around to record these much longer. It's been a rough few nights. The pipes burst under the dining hall, so the maintenance tunnel's flooded. Try not to go splashing through it unless you have to. Everything can hear you down there.

There's a backup generator in the boiler room. You'll want it running tonight. The battery's on a cart at the loading dock. It's heavy. Carry it together, or at least have somebody walking with whoever's carrying it.

Also, um, corporate wants something from the old storage room in the basement. The one with the padlock. The key's in my safe. The code's written somewhere in the building, I can never remember where I put it. There's an old tape in there, on the reel-to-reel. Just play it, and, uh. I don't know. Tell me what's on it, I guess. I never had the nerve.

If I don't record tomorrow's message, um, there's a key taped under the Backstage workbench. It opens the parts locker. I never got around to looking in there. Somebody should. I'm going to sit tight in the office here and hope the banging stops on its own.

[a long pause, then distant banging]

Oh, no...

[a music box melody, a groan, then a horrific screech and the line cuts to static]"

Implementation note: the banging, music box, groan and screech are synthesised sound events scripted at timestamps inside the call, not spoken text. Subtitles show "[banging]", "[music box]", "[screech]".

### 7.5 Night 5 transmission, Night 6 and Custom Night

Night 5: no manager. At 12:05 AM the phone rings, and whoever answers (and every walkie) gets 25 seconds of garbled transmission: synthesised random formant bursts, reverse-envelope noise and a low drone. The subtitles show nonsense characters that occasionally resolve into fragments: "...it's me...", "...five...", "...save them...", "...he's still here...", "...under the stage...". Players who read the subtitle file find a hidden Caesar-shifted message (shift 7) that decodes to "THEY WERE NEVER FOUND. LOOK UNDER THE STAGE." That's a pointer to the Night 5 secret in the Stage Crawlspace (Part 9.4).

Night 6: no call. Just rain, and the hum.

Custom Night: a sticky note on the time clock in the manager's handwriting: "This shift's off the books. Corporate doesn't know about it, so if anybody asks, you were never here."


### 7.5b Faz-Tapes (lore cassettes)

One tape spawns per night (Tape Recovery side task, Part 5.7). Players pick it up (it goes in a collection, not a slot) and can play it at the Security Office tape deck, at the Old Storage reel-to-reel, or later from the Archives. Each tape is 40 to 70 seconds of a synthesised voice (or subtitles plus babble) telling part of Location 7's story. They're written in the voice of different people. Keep them creepy and sad, never gory.

Tape 1, "Technician's Log, Day 1": "Log entry. The new units arrived today. Four performers, plus the old cove unit we're refurbishing. The facial tracking is very good. Too good, maybe. The rabbit kept turning to watch me while I worked on the bear. I told myself it's just the sensors calibrating. Making a note to dial the sensitivity down tomorrow."

Tape 2, "Technician's Log, Day 9": "The units are moving between shows now. Corporate says it's the free-roam maintenance cycle. I didn't install any free-roam cycle. I checked the code twice. It's not there. But they move. Last night I found the chicken standing in the kitchen with a cupcake in her hand. She doesn't have the dexterity for that. Somebody put it there. Somebody had to have."

Tape 3, "Party Host Training": a cheerful corporate training script that slowly goes wrong: "Remember, team, every child is a star at {venue}! Always count the children at the start of the party, and again at the end. The numbers should match. The numbers should always match. If the numbers don't match, do not, I repeat, do not check the back rooms alone. Call your manager. Smile! Every child is a star!"

Tape 4, "Reel-to-Reel, Old Storage" (Night 4 objective): an older, warped recording with heavy wow and flutter, from the original diner: a man's voice, calm: "...the spring locks must be wound tight before anyone wears the suit. Never wear the suit during rain. Never make sudden movements. If the locks give way..." then a loud mechanical snap, and the recording ends in hiss. Afterward, the room's golden bear head on its stand has turned to face the player. This is the most important lore beat in the campaign.

Tape 5, "Unknown": found on Night 5 in the Stage Crawlspace: five children's voices, synthesised and pitched, counting together from one to five, then silence, then one voice alone says "you found us". When this plays, all five birthday table candles in the building flicker at once (even unlit ones light up briefly).

Tape 6, "The Day Manager" (Night 6): the manager, recorded on the night of his Night 4 call, before the banging: "If someone finds this, I'm sorry I didn't tell you more. I wasn't allowed to. They said the building was safe as long as the music played. They said the night team was just there to keep things running. I think we're not there to keep things running. I think we're there to keep them busy."

### 7.5c Manager's terminal emails

Write 4 to 6 short emails per night on the terminal (Part 5.8), from senders like "Corporate Operations", "Facilities", "Legal", "HR", "Head Technician", "Marketing". Examples to set the voice:

From Facilities, "RE: RE: RE: Breaker panel": "We are aware the main breaker requires manual balancing. A replacement panel has been budgeted for next fiscal year. Until then please continue to 'aim for twelve.' Facilities."

From Legal, "Updated night staff waiver": "By accepting this position, staff acknowledge that {company} carries no liability for any injury, disappearance, or reassignment that occurs after closing. Incident paperwork will be processed once the affected area has been fully sanitised and refurnished."

From Marketing, "Cupcake programme results": "Great news! Customer satisfaction is up 4% since we introduced the 'Cupcakes for the Birthday Tables' overnight prep task! Please ensure night staff complete it every night. The characters seem to enjoy it too!"

From Head Technician, "Music box": "Do NOT let the box wind down. I don't care what it costs in overtime. I'm serious. Do not."

From HR, "Night team morale": "We've noticed some night staff asking about 'the noises.' Please remind staff that the building settles at night. Settling is normal. Thank you."

From Corporate Operations, "Location 7 closure" (Night 6): "Location 7 will close at the end of the month. Characters are to be placed in storage. The golden unit is to be found and destroyed. Do not share this email."

### 7.5d Notes and environmental storytelling

Scatter 20 to 30 short handwritten notes and props around the map that tell small stories: a staff schedule with one name crossed out every week; a child's drawing of the four characters with a fifth, purple figure in the corner, coloured over hard; a faded "Missing" poster for a former night guard named Dale Pruett on the Employee Lounge board (invent original names like this; never reuse canon guard names); a sticky note in the Security Office: "IF YOU HEAR BREATHING DON'T OPEN THE DOOR"; a list in the kitchen: "Cupcakes: 5. Plates: 5. Candles: 5. Children: (scratched out)"; a hand-drawn vent map in the Supply Closet with one duct circled and "NOT SAFE AFTER 3" written next to it; a Day Manager's coffee mug that says "World's OK-est Boss"; a pile of unopened letters addressed to a family at the Lobby. None of these use official canon names or text.

### 7.6 Newspaper clippings

Newspaper clippings hang in frames on the walls of the West Hall, East Hall, the Party Room Hall and the Employee Lounge, and some lie in the Old Storage boxes. Each night, rarely, a clipping changes. They're rendered as canvas textures with a yellowed paper look, a blackletter-ish masthead (use a free Google font like "UnifrakturMaguntia" for the masthead and "Special Elite" or "Courier Prime" for body text), headline, and two short paragraphs of text. Players walk up to a clipping and interact to hold it up close in first person, fully readable, with a paper rustle.

Write these six clippings for tribute mode (original mode swaps names):

1. "LOCAL PIZZERIA REOPENS UNDER NEW MANAGEMENT." {venue} reopens its doors after two years closed, with a brand-new show stage and four 'state-of-the-art' characters. A spokesperson for {company} says the restaurant 'has put the past behind it.' Night security staffing has been increased to four for the first time in the chain's history.
2. "BIRTHDAY GUESTS REPORT 'MOVING' MASCOTS." Families at a weekend party claim the characters turned their heads to follow children around the room, outside of showtimes. A {company} technician explained the behaviour as 'a facial tracking feature still being calibrated.' The feature has since been disabled. Officially.
3. "NIGHT GUARD MISSING AFTER SHIFT." A security worker employed at {venue} failed to return home after a night shift last Tuesday. Police found the guard's car still in the parking lot. The company declined to comment beyond noting that the guard 'had been briefed on all safety procedures.'
4. "FIVE CHILDREN, ONE BIRTHDAY, NO ANSWERS." Twenty years later, the case remains unsolved. A man in a uniform was seen leading the children to a back room. The suspect was charged, but the children were never found. A memorial plaque has been quietly removed from the location's entrance.
5. "{company} ANNOUNCES 'SAFE NIGHTS' PROGRAMME." Following an internal review, the company will install additional doors, a shared power system and a 'maintenance panel' at all locations. 'We take the safety of our staff seriously,' a statement reads.
6. "LOCATION SEVEN TO CLOSE BY YEAR'S END." Citing 'low attendance and maintenance costs,' the company confirms Location Seven will close. The characters will be 'retired' and placed in storage. The rare golden bear costume, long rumoured to exist, has not been located.

Clipping 1 shows on Night 1, clippings 2 and 3 can appear from Night 2, clipping 4 is rare (5% per night per poster), 5 appears from Night 3, and 6 only on Night 6.

### 7.6b Posters

Posters around the building (original designs, rendered on canvas): the band poster ("Celebrate!" style, the four mascots posing, with a honkable nose on the leader); "Let's Eat!" with the bird mascot; "Pirate Cove: Arrr You Ready?" with the fox; "Safety Rules: No running! No screaming! Stay with your group!"; a "Birthday Club" sign-up poster; "Employee of the Month"; a "Lost Child? Ask a Staff Member!" poster where the staff member's face has been scratched out. On later nights, some posters change subtly (eyes missing, an extra figure in the background).

### 7.7 UI copy voice

All menus are short, punchy, a little ominous, a little funny. Main menu: "Clock In" (play), "Locker Room" (skins), "Personnel File" (profile and stats), "Notice Board" (settings), "Archives" (extras), "Day Shift" (free explore), "Leave" (log out). Lobby: "Waiting for staff...", "Room code: ABCD (tell your crew)", "Pick a loadout item", "Ready" / "Not ready", "Start shift" (host only). Downed: "You've been grabbed. Hold on. Help is coming. Maybe." Ghost: "You didn't make it. You can still watch over them." 6 AM: big "6 AM", then "Shift complete. {n} of {m} guards clocked out." Paycheck: "Pay stub: {tokens} Faz-Tokens. Overtime: none. Hazard pay: denied." Errors: "Lost signal. Reconnecting to the building...", "That room's full. Max four guards per shift.", "Couldn't find that room. Check the code?"


---

## PART 8: ACCOUNTS, SKINS, ECONOMY AND THE DATABASE

### 8.1 Account system requirements

Players can create a real account with a username, email (optional but recommended for password reset) and password. They can also play as a Guest with a random name like "Guest_4821", which keeps progress only in that browser session; a guest can "Claim this account" at any time to convert to a full account and keep everything they've earned so far.

Account features, in order of priority:

1. Sign up with username + password (+ optional email). Usernames: 3 to 16 characters, letters, numbers, underscores, case-insensitive unique, profanity-checked against the same word list as chat, and a reserved list (admin, moderator, freddy, system, etc.).
2. Log in, log out, stay logged in (30-day rolling session).
3. Change display name (separate from username, 3 to 20 characters, changeable once per 24 hours).
4. Change password (requires current password).
5. Password reset via emailed link, only if an SMTP provider is configured through env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). If not configured, the "Forgot password" link shows "Password reset isn't set up on this server yet" and logs a warning at boot. Don't block launch on email.
6. Delete account (requires password, wipes all personal data, keeps anonymised match stats).
7. Profile page showing display name, stars, equipped skin preview (3D turntable), stats, achievements, and member-since date. Other players can view your public profile by clicking your name in a lobby.

### 8.2 Auth implementation

Passwords hashed with Argon2id (`@node-rs/argon2` is a good, prebuilt, fast choice; fall back to `bcryptjs` with cost 12 only if the native module can't install on Railway, and note it in DECISIONS.md). Parameters: memory 19 MiB, iterations 2, parallelism 1 (OWASP's recommended minimum).

Sessions: on login, create a row in `sessions` with a random 32-byte token (stored hashed as SHA-256 in the DB), and set an `httpOnly`, `Secure` (in production), `SameSite=Lax` cookie named `fr_session` containing the raw token. Rolling expiry: 30 days from last use, refreshed at most once per hour. This is simpler and safer than JWTs for a single-server game, and logout actually works (delete the row). The Socket.IO handshake reads the same cookie, so the socket is authenticated as the same user with no separate token dance.

CSRF: the REST API only accepts JSON bodies with `Content-Type: application/json` and checks the `Origin` header against `PUBLIC_URL` for state-changing requests. That plus SameSite=Lax is enough here.

Rate limits (in-memory per IP and per account, since we run one instance): login 10 attempts per 15 minutes per IP and 5 per 15 minutes per username; sign-up 5 per hour per IP; chat as in Part 4.15; lobby create 10 per 10 minutes per user. Return 429 with a friendly message.

Validation: use `zod` schemas for every REST body and every socket message, shared between client and server in `shared/protocol/`.

Guest accounts are real rows with `is_guest = true` and no password. The guest cookie works exactly like a normal session. Guests older than 30 days with no activity are purged by a daily job (a simple `setInterval` on boot that runs once every 24 hours is fine).

### 8.3 Database schema

Use PostgreSQL with Drizzle ORM (`drizzle-orm` + `drizzle-kit` for migrations) and the `postgres` driver. Drizzle is light, typed, and its migrations are plain SQL files you can read. Run migrations automatically at server boot (`migrate()` before `listen()`), and fail fast if they fail.

Tables:

```sql
users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,            -- lowercase canonical
  username_display text not null,           -- original casing
  display_name text not null,
  email text unique,                        -- nullable
  password_hash text,                       -- null for guests
  is_guest boolean not null default false,
  faz_tokens integer not null default 0 check (faz_tokens >= 0),
  stars integer not null default 0,
  equipped jsonb not null default '{}',     -- { guard: 'skin_id', flashlight: 'id', office: 'id', tablet: 'id', badge: 'id', title: 'id', animatronic: { freddy: 'id', ... } }
  settings jsonb not null default '{}',     -- synced client settings
  display_name_changed_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
)

sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
)

password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz
)

user_cosmetics (
  user_id uuid not null references users(id) on delete cascade,
  cosmetic_id text not null,                -- matches ids in shared/content/cosmetics.ts
  acquired_at timestamptz not null default now(),
  source text not null,                     -- 'default' | 'shop' | 'achievement' | 'preset' | 'event'
  primary key (user_id, cosmetic_id)
)

progress (
  user_id uuid not null references users(id) on delete cascade,
  mode text not null,                       -- 'nightshift' | 'classic' | 'showtime'
  highest_night integer not null default 0,
  presets_beaten text[] not null default '{}',
  primary key (user_id, mode)
)

achievements (
  user_id uuid not null references users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
)

stats (
  user_id uuid primary key references users(id) on delete cascade,
  nights_played integer not null default 0,
  nights_survived integer not null default 0,
  deaths integer not null default 0,
  deaths_by jsonb not null default '{}',    -- { freddy: 3, bonnie: 7, ... }
  camera_checks integer not null default 0,
  doors_closed integer not null default 0,
  power_used_total real not null default 0,
  showtime_kills integer not null default 0,
  showtime_wins_as_animatronic integer not null default 0,
  playtime_seconds integer not null default 0
)

matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  night integer not null,
  seed bigint not null,
  custom_ai jsonb,
  player_count integer not null,
  result text not null,                     -- 'win' | 'loss' | 'abandoned'
  ended_at_hour integer not null,
  power_left real,
  started_at timestamptz not null,
  ended_at timestamptz not null
)

match_players (
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  player_slot smallint not null,          -- 0..4 (4 = Showtime animatronic player)
  survived boolean not null,
  killed_by text,
  death_hour integer,
  tokens_earned integer not null,
  primary key (match_id, player_slot)
)
```

Indexes: `sessions(user_id)`, `sessions(expires_at)`, `matches(ended_at)`, `match_players(user_id)`.

All token awards and cosmetic purchases happen in database transactions on the server. The client never says "give me 50 tokens"; the server computes rewards from the authoritative match result.

### 8.4 The skin system (cosmetics)

Skins are a big part of why people come back, and you asked for them specifically, so build this properly.

Cosmetic categories:

| Category | Slot key | What it changes | Where it shows |
|---|---|---|---|
| Guard Uniform | `guard` | Shirt, trousers, cap, colours, patterns | Lobby portrait, first-person sleeves and gloves, death card, Showtime figures |
| Guard Accessory | `accessory` | Hat swap, glasses, eyepatch, headset, scarf | Lobby portrait, death card |
| Flashlight | `flashlight` | Flashlight model and finish | Your flashlight in first person and in teammates' view |
| Tablet | `tablet` | Faz-Pad frame colour, stickers, camera UI theme (green, amber, blue, glitch) | Your Faz-Pad and the Security Office monitors when you're seated |
| Office Decor | `office` | Desk props for the Security Office (fan model, plush, cupcake, drawings, poster set) | The Security Office desk while you're the one sitting in it, and in Mode D |
| Badge | `badge` | Badge emblem next to your name | Lobby list, chat, profile |
| Title | `title` | Text under your name ("Night Owl", "Pizza Purist", "Ultimate") | Lobby list, profile |
| Animatronic Skin | `animatronic.<id>` | Alternate look for one animatronic, used when you play that animatronic in Showtime, and shown to everyone in that match | Showtime, your solo games |

Each cosmetic is defined as data in `shared/content/cosmetics.ts`:

```ts
interface Cosmetic {
  id: string;                 // 'guard_classic_blue'
  category: CosmeticCategory;
  name: string;               // 'Classic Blue'
  description: string;        // 'Standard issue. Smells faintly of pizza.'
  rarity: 'standard' | 'rare' | 'epic' | 'legendary' | 'golden';
  price: number | null;       // Faz-Tokens; null = not purchasable (achievement/preset only)
  unlock?: { achievement?: string; preset?: string; night?: { mode: string; n: number } };
  params: Record<string, unknown>; // renderer parameters (colours, pattern ids, prop ids)
}
```

Renderer reads `params` to build visuals, so adding a skin is a data change only.

Ship at least these cosmetics at launch (40+ total). Guard uniforms: Classic Blue (default), Graveyard Grey (default), Midnight Black, Pizza Red, Mustard Yellow, Purple Night (cheeky nod, epic), Golden Guard (golden, from 4/20), Retro 1987 (legendary, from Night 6), Top Hat (from Old Friends preset), Endo Chic (exposed-wire print, epic), Party Staff (party hat and striped shirt, rare), Janitor (overalls, rare), Day Manager (tie and lanyard, rare). Accessories: Night-Vision Goggles, Eyepatch (Pirate's Revenge), Party Hat, Headset, Bow Tie, Bunny Ears, Chef Hat, Lucky Scarf. Flashlights: Standard, Red Lens, Candy Cane, Endo Mask, Gold. Tablets: Green CRT (default), Amber CRT, Ice Blue, Glitch, Sticker Bomb, Golden. Office decor: Default Desk, Cupcake (Ladies' Night), Plush Pals (small plush versions of the core four), Kid Drawings (crayon drawings taped on the wall, procedurally drawn on canvas), Golden Hour (gold-tinted desk props), Retro Arcade (tiny arcade cabinet on desk), Haunted (flickering candles, cobwebs). Badges: Rookie, Night 5 Survivor, Star 1/2/3, Ultimate, Puppeteer, Ghost Whisperer. Titles: "Rookie", "Night Owl", "Door Slammer", "Camera Hog", "Pizza Purist", "Puppeteer", "Ultimate", "It's Me".

Animatronic skins (Showtime cosmetics): Freddy: Classic, Shadow (dark purple), Rockstar (sunglasses, guitar), Withered (torn, faded). Bonnie: Classic, Glamrock (neon pink/blue), Withered (missing face plate, exposed endo). Chica: Classic, Rockstar, Party (balloons). Foxy: Classic, Captain (full pirate coat), Glitched (vertex-jitter shader).

Defaults: every new account owns Classic Blue, Graveyard Grey, Standard flashlight, Green CRT tablet, Default Desk, Rookie badge, Rookie title, and Classic animatronic skins.

### 8.5 Locker Room (skin changing UI)

The Locker Room screen is reachable from the main menu and from the lobby (a "Change skin" button next to your name, which opens the Locker Room as an overlay so you don't leave the lobby). It shows a 3D turntable of your guard on the left (drag to rotate), category tabs across the top, and a grid of items on the right. Owned items can be equipped with one click; the preview updates instantly. Locked items show a padlock and either a price (with a "Buy" button if you can afford it) or the unlock requirement ("Beat the 4/20 preset"). Equipping saves to the server immediately (`PUT /api/me/equipped`) and broadcasts to your current lobby, so other players see your new skin change on their lobby screen live. Skins are locked once a night starts (no mid-night swapping) and the server snapshots each player's equipped set when the night begins.

A "Shop" tab rotates four purchasable items daily (seeded by date so everyone sees the same rotation) plus the full catalogue of standard items always available. Prices: standard 100 to 200, rare 400 to 600, epic 1,000 to 1,500, legendary 3,000. Golden items can't be bought. No real money, ever.

### 8.6 Earning Faz-Tokens

| Event | Tokens |
|---|---|
| Survive a night (Night Shift) | 40 + 20 × night number |
| Survive as a Ghost (died, team won) | half of the above |
| Night Shift loss | 10 + 5 × hour reached |
| The Office (Mode D) night survived | 30 + 15 × night number |
| Custom Night win | 100 + sum of AI levels / 2 |
| Showtime: guard survives | 80 |
| Showtime: animatronic player takes a guard out | 30 per kill, +100 for a full wipe |
| First win of the day bonus | +100 |
| Playing with a full lobby of 4 | +15% |

Award and persist at the end of the match on the server, then show the paycheck screen. Rewards from abandoned matches: none for the leaver.

### 8.7 REST API

All under `/api`. JSON in, JSON out. Errors: `{ error: { code: string, message: string } }`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/signup` | `{ username, password, email? }` | `{ user }` and sets cookie |
| POST | `/api/auth/login` | `{ username, password }` | `{ user }` and sets cookie |
| POST | `/api/auth/guest` | `{}` | `{ user }` and sets cookie |
| POST | `/api/auth/claim` | `{ username, password, email? }` (guest only) | `{ user }` |
| POST | `/api/auth/logout` | `{}` | `{ ok: true }` |
| POST | `/api/auth/forgot` | `{ email }` | `{ ok: true }` (always, no user enumeration) |
| POST | `/api/auth/reset` | `{ token, password }` | `{ ok: true }` |
| GET | `/api/me` | | `{ user, cosmetics, progress, stats, achievements }` |
| PATCH | `/api/me` | `{ displayName?, settings? }` | `{ user }` |
| PUT | `/api/me/password` | `{ current, next }` | `{ ok: true }` |
| PUT | `/api/me/equipped` | `{ slot, cosmeticId }` | `{ equipped }` |
| DELETE | `/api/me` | `{ password }` | `{ ok: true }` |
| GET | `/api/cosmetics` | | full catalogue + today's shop rotation |
| POST | `/api/shop/buy` | `{ cosmeticId }` | `{ fazTokens, cosmetics }` |
| GET | `/api/profile/:username` | | public profile |
| GET | `/api/leaderboard/:board` | | top 50 (boards: `nights`, `showtime`, `custom`) |
| GET | `/healthz` | | `{ ok: true, uptime, version, db: 'ok' }` |

---


### 8.8 Free-roam cosmetic additions

Because teammates see each other's full characters all night, add these categories and items on top of the list above.

| Category | Slot key | What it changes |
|---|---|---|
| Emote | `emote.1` to `emote.4` | Which four emotes sit on your emote wheel (Part 4.16) |
| Flashlight beam | `beam` | Beam tint (subtle warm, cold, amber, faint red; never strong enough to change gameplay visibility) |
| Footstep sound | `footsteps` | Shoe type: sneakers (default), boots (heavier clump), squeaky trainers (comedy), slippers (soft); purely cosmetic, same noise radius |
| Walkie skin | `walkie` | Walkie-talkie colour and stickers |
| Ghost style | `ghost` | Your ghost's colour and trail (visible to other ghosts) |
| Name plate | `nameplate` | Frame around your name above your head |
| Backpack | `backpack` | A small backpack or bum bag model on your character (purely visual) |

Items to add: emotes (Wave, Point, Thumbs Up, Shrug, and unlockable Chicken Dance, Freddy Bow, Pirate Salute, Bunny Hop, Cower, Facepalm, Air Guitar); beams (Warm, Cold, Amber, Ember); footsteps (Sneakers, Boots, Squeaky, Slippers, Tap Shoes as a legendary joke); walkies (Standard, Pizza Red, Camo, Sticker Bomb, Gold); ghosts (Pale Blue, Purple, Gold, Static); nameplates (Plain, Star, Pizza, Golden, Endo); backpacks (None, Cupcake Bag, Freddy Plush Backpack, Toolbelt, Pirate Satchel).

Full-body skin sets: a few uniform skins should change the whole silhouette for fun: "Mascot Trainee" (a cheap fan-made bear costume suit, head off and tucked under one arm; hilariously, mask-able animatronics don't treat this as a mask), "Janitor", "Pizza Delivery", "Party Clown", "Hazmat Tech", "Purple Night" (an all-purple uniform with a golden badge; it's a cheeky nod that the fandom will love).

Skins never affect gameplay: no camouflage advantage, same hitbox, same noise.


---

## PART 9: META FEATURES, SECRETS, MINIGAMES AND SETTINGS

### 9.1 First launch and title screen

First launch shows a warning screen: "This game contains flashing lights, loud noises, jump scares and proximity voice chat with other players. Photosensitivity mode, reduced jump scares and voice options are in Settings." Buttons: "Continue" and "Open accessibility settings". Remember the choice.

The title screen is a live 3D scene rendered by the game engine: the Show Stage at night from the dining floor, the three performers standing in their poses under dim coloured spotlights, dust drifting through the beams, rain on the windows behind, heavy film grain, scanlines, a slow camera drift, occasional twitches (a head turn, an eye flash, a jaw clack). Every 20 to 40 seconds a light flickers and for one frame one of the animatronics is replaced with an endoskeleton or a withered version. A low drone and a faint, slow music box loop play. Menu options bottom-left in the typewriter font, stars under the title, the disclaimer at the bottom. Very rarely (1 in 20 loads), Golden Freddy sits slumped at the front of the stage, and he's gone the next time the camera drifts past.

### 9.2 Achievements

At least 40, each with an id, name, description, procedural SVG icon and optional cosmetic reward. Implement these (and invent more in the same spirit):

| Id | Name | Condition |
|---|---|---|
| `first_shift` | First Shift | Survive Night 1 |
| `night5` | Employee of the Week | Beat Night 5 |
| `night6` | Overtime | Beat Night 6 |
| `four_twenty` | Twenty Twenty Twenty | Beat the 4/20 Custom Night preset |
| `ultimate` | Ultimate | Beat the Ultimate preset |
| `its_me` | It's Me | Get caught by Golden Freddy |
| `lights_on` | Let There Be Light | Light every zone in a single night |
| `power_lever` | Aim For Twelve | Restore main power first try with no trips, five nights in a row |
| `retwist` | Retwist | Wind the music box from under 10% to 100% in one go |
| `lullaby` | Lullaby | Never let the music box drop below 25% on Night 5 |
| `cupcake_courier` | Cupcake Courier | Personally deliver all five cupcakes in one night |
| `beacon` | Walking Dinner Bell | Carry the full cupcake tray past Chica without being caught |
| `ball_pit` | Sunk | Hide in the ball pit while an animatronic walks through it, and survive |
| `coffin` | Rest In Pieces | Hide in the Spooky Party coffin while it's checked last... and survive |
| `locker_buddies` | Locker Buddies | Hide in the same locker as a teammate while an animatronic walks past |
| `vent_rat` | Vent Rat | Travel 200 m through vents in one night |
| `freddy_stare` | Don't Blink | Keep Freddy frozen by watching him for 60 seconds straight |
| `cove_watch` | Cove Watcher | Check Pirate Cove 20 times in one night |
| `fox_door` | Door In His Face | Stop Foxy's sprint with a closed door |
| `fox_light` | Not Today, Captain | Send Foxy back with a focused flashlight |
| `flash` | Say Cheese | Stun an animatronic with the Faz-Cam |
| `photo` | Portrait Mode | Take a Faz-Cam photo with all four core animatronics in frame |
| `revive_5` | Paramedic | Revive 5 teammates in one night |
| `clutch_revive` | Clutch | Revive a teammate with under 3 seconds of bleed-out left |
| `full_team` | Nobody Left Behind | All four guards survive Night 5 without anyone becoming a ghost |
| `last_one` | Last Guard Standing | Be the only non-ghost at 6 AM in a 4-player night |
| `early_exit` | Clocking Out Early | Leave through the front doors at 5 AM |
| `blackout` | Saved By The Bell | Survive a blackout by reaching 6 AM |
| `generator_hero` | Jump Start | Restart the backup generator during a blackout |
| `office_hero` | Eyes In The Sky | Spend a whole night in the Security Office and win |
| `lure_save` | Over Here! | Use a speaker lure to pull an animatronic off a teammate who was being chased |
| `mic_drop` | Rockstar | Sing into the stage microphone and survive the consequences |
| `honk` | Honk | Boop the leader's nose on the poster |
| `claw` | Claw Master | Win 5 plushes from the claw machine |
| `golden_ball` | Gold Rush | Find the gold ball in the ball pit |
| `newspaper` | Investigative Reporter | Read all six newspaper clippings |
| `tapes` | Archivist | Collect all six Faz-Tapes |
| `found` | Found | Complete the Night 5 crawlspace secret |
| `minigames` | Save Them | Complete all three Atari minigames |
| `ghost_help` | Ghost Whisperer | As a ghost, ping an animatronic that a living teammate then avoids |
| `showtime_win` | Showtime! | Win as the animatronic in Showtime |
| `showtime_survive` | Survivor | Win as a guard in Showtime |
| `fashion` | Dressed To Kill | Change your skin 10 times |
| `collector` | Collector | Own 30 cosmetics |
| `lifer` | Lifer | Play 100 nights |
| `day_shift` | Tourist | Visit every zone in Day Shift mode |

Achievement toasts appear in menus and on the paycheck screen. During a night they queue silently (except a tiny chime with no visual) so nothing breaks the immersion.

### 9.3 Atari-style minigames

FNAF 2 introduced 8-bit "death minigames" that hint at the lore. We have three original ones (160 × 120 canvas, nearest-neighbour upscale, a 16-colour palette, synthesised chiptune blips), and in free-roam they live inside the building as playable arcade cabinets that appear on certain nights, not just after deaths.

1. "Party Time" (arcade cabinet in the Arcade, Night 2+): you're a pixel {leader} delivering cake to six kids at tables; kids turn from grey to colourful as they get cake; outside the window a grey child cries and you can never reach them; a purple car drives up. When the minigame ends, the real cabinet's screen shows a jumpscare face of a pixel {puppet}, and the real Prize Corner music box drops by 20%. A deliberate trap that fans will discuss.
2. "Follow Me" (cabinet in Party Room 4, Night 3+): you're a pixel {rabbit}; a purple figure beckons you through rooms; at the end, dismantled pixel animatronics lie on the floor; the figure turns and the screen flashes. Playing it to the end spawns Bonnie (or the rabbit character) in the Party Room Hall, outside the door.
3. "Lights On" (cabinet in Old Storage, Night 4+): you're a small pixel child with a flashlight cone in a dark building; find five glowing party hats; each one plays a soft tone; when you find the fifth, a golden pixel bear appears behind you. Completing it unlocks the "Kid Drawings" office decor and opens a hidden compartment in Old Storage containing Tape 5's case art.

Playing a cabinet means standing at it in the real world, vulnerable, while your teammates guard you. Your character visibly plays it (hands on the controls, the screen lit). All three are replayable in the Archives once seen.

### 9.4 Easter eggs and secrets

The nose honk: every band poster's leader has a honkable nose.

Golden Freddy: Part 6.6.

Shadow Bonnie: a 1 in 3,000 chance per look at the Party Room 4 mirror (there's a small decorative mirror on the wall) to see a dark rabbit silhouette standing behind you in the reflection. Stare for 3 seconds and you're pulled into a 5-second "glitch dimension" (the whole building rendered as stretched, wireframe, purple-tinted geometry) before being returned to a random room. Unharmed.

The Night 5 crawlspace secret: following the decoded transmission ("LOOK UNDER THE STAGE"), a player crawls into the Stage Crawlspace on Night 5 after 3 AM and finds, in the darkest part, five party hats arranged in a circle around a small music box. Interacting plays Tape 5, the five candles flicker, and the player earns the "Found" achievement and the "Retro 1987" uniform. Freddy (if active) begins walking across the stage above, and his footsteps rain dust through the floorboards onto the player. They have to crawl out the other side.

The 1987 combo: typing 1, 9, 8, 7 on the title screen plays a music box sting and flashes Golden Freddy's face for one frame. Nothing else.

The Konami code on the title screen: the title animatronics become bobbleheads for the session.

The office jingle: Security Office light buttons in the pattern left-right-left-left-right (Part 3.6).

The phone: clicking the office phone's receiver in the last 5 seconds of the Night 4 call plays an extra 3 seconds of slowed child's laughter.

The fish: feeding the fishless fish tank (Part 5.7).

The photo booth: being found in the Arcade photo booth saves a "last photo" (Part 3.13).

The employee wall: the Lobby's Employee of the Month wall shows the four players' characters in their current skins; on Night 6, one of the photos is replaced with a purple figure.

Posters: in the West Hall, the band poster rarely (1%) shows the characters with black voids instead of eyes.

Rare kitchen sound: 1 in 50 nights, the kitchen's audio-only camera plays a slowed music box melody during the 4 AM hour.

The microphone: Part 3.10.

The gift box peek: Part 3.12.

### 9.5 Collectibles and Archives

Collectibles persist on the account: 12 plushes (claw machine and hidden spawns: one per core character plus golden versions), 6 Faz-Tapes, 6 newspaper clippings, 3 minigames, a hidden "drawings" set (5 children's drawings hidden in different rooms, each visible only on one specific night), and character discoveries (a character is "discovered" when a player first sees it in a night).

The Archives menu: character gallery (every discovered character on a turntable with the x-ray endo view, name, description and counter tip; undiscovered ones as silhouettes), tapes (play with subtitles), newspapers (readable), minigames (replay), drawings, the soundtrack (every ambient loop and sting you've heard), photos (your Faz-Cam match photos and photo booth "last photos", saved per account up to 50, server-side as small JPEGs in Postgres `bytea` or as data the client regenerates from a saved camera pose; the second is cheaper: store the scene state and camera pose, re-render on view), and the credits.

### 9.6 Settings (Notice Board)

Persist settings on the account (and in localStorage for guests).

Audio: master, ambience, effects, jumpscare (separate cap), voice chat volume, walkie volume, microphone device, voice mode (voice activation with sensitivity slider, or push-to-talk for proximity), walkie key, per-player mute, "mute all voice", "duck game audio when teammates speak" (off by default), spatial audio quality (HRTF on/off).

Video: quality preset (Low, Medium, High, Ultra; Part 11.10), render scale (50% to 150%), shadows (off, low, medium, high), shadow-casting light count (1 to 6), volumetric light (off, low, high), dust particles on/off, film grain intensity, CRT effect intensity (camera feeds), chromatic aberration on/off, bloom on/off, motion blur on/off (off by default), vignette, field of view (70 to 100), frame rate cap (30, 60, 120, unlimited), brightness/gamma calibration screen ("adjust until the left symbol is barely visible"), V-sync.

Controls: mouse sensitivity, invert Y, mouse smoothing, crouch toggle or hold, sprint toggle or hold, lean toggle or hold, full key rebinding for every action with conflict detection and reset, interact hold-to-toggle for long interactions (accessibility).

Accessibility: reduced jumpscare intensity (no flash, no shake, scream capped at 50%), photosensitivity mode (disables all flashes, strobes and rapid flicker, including hallucinations, Power-Out Freddy's flashing face, Faz-Cam flashes (replaced with a soft fade), lightning in the windows, and sparks' light pulses), reduced motion (no head bob, no camera sway, no screen shake), subtitles (on by default, size, background opacity, speaker names), visual sound cues (on-screen directional icons for important sounds within earshot: footsteps by character, doors, vents, breathing, laughs, music box warnings, Foxy's sprint), heartbeat intensity, colourblind-friendly indicators (shapes and labels on switch panels, fuse boxes and LEDs, not only red/green), high-contrast objective markers, a "hold breath" assist (auto-release before you gasp), and "Hide gore" (there's no real gore, but this softens the jumpscare imagery).

Gameplay: objective markers (off, Night 1 only, always), nameplates (on, off, only when talking), show noise indicator, show clock on HUD (off by default; the clipboard has the hour), show power on HUD (off by default), chat profanity filter, "show my own body" toggle.

### 9.7 Leaderboards and stats

Leaderboards (weekly and all-time): fastest Night 5 completion with all objectives (by team), most nights survived, Custom Night high scores (score multiplier × survival), Showtime wins as animatronic, Showtime wins as guard. Teams of guests can't post. Stats on the profile: nights played, nights survived, catches by character, revives given, revives received, metres walked, metres crawled in vents, time hidden, music box winds, cupcakes delivered, fuses replaced, favourite hiding spot (most used), most feared animatronic (most catches), playtime.


---

## PART 10: TECHNICAL ARCHITECTURE

### 10.1 Stack (decided, don't relitigate)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 5.x, strict | One language for client, server and shared sim |
| Package manager | npm workspaces | Works cleanly with Railway's builders |
| Client bundler | Vite 5 | Fast dev server, simple static build |
| 3D renderer | Three.js (pin an exact recent 0.16x/0.17x release you know is stable) | Real-time 3D with full lighting and shadows |
| Post-processing | `postprocessing` (pmndrs), pinned | Bloom, SMAA, noise, vignette, chromatic aberration, god rays in a merged effect pass |
| Collision | `three-mesh-bvh`, pinned | Fast capsule-vs-level collision on client and server (it runs in Node) |
| Navigation | `recast-navigation` (recast-navigation-js, WASM), pinned | Navmesh baking, pathfinding and crowd avoidance in Node and the browser |
| UI | Preact + plain CSS for menus and HUD overlays | Small, fast, separate from the 3D canvas |
| Server | Node 20, Fastify 4 | Fast HTTP, static serving via `@fastify/static` |
| Realtime | Socket.IO 4 with `socket.io-msgpack-parser` | Rooms, reconnection, acks; binary msgpack keeps 30 Hz snapshots small |
| Voice | WebRTC (browser native) with Socket.IO signalling | Mesh for 4 players, no media server |
| DB | PostgreSQL (Railway) + Drizzle ORM + `postgres` driver | Typed, readable SQL migrations |
| Validation | zod | Shared schemas for REST and socket messages |
| Auth hashing | `@node-rs/argon2` | Argon2id, prebuilt binaries |
| Tests | Vitest, Playwright | |
| Lint/format | ESLint flat config + Prettier | |
| CI | GitHub Actions | Lint, typecheck, unit, integration, E2E on every push |

If any pinned library won't install or run on Railway's Node 20 image (the WASM navmesh is the most likely suspect), fall back as follows and log it in DECISIONS.md: for navigation, a custom waypoint graph with A* plus simple steering (the level data already has navHints; extend them into a dense graph); for collision, a custom capsule versus axis-aligned box solver (the level is mostly boxes).

### 10.2 Repository layout

```
FNAF-Replica/
  package.json  tsconfig.base.json  railway.json  .nvmrc  .env.example  README.md  PROMPT.md
  docs/ DECISIONS.md PROGRESS.md BALANCE.md DEPLOY.md PROTOCOL.md ART.md map.svg screenshots/
  shared/
    src/
      config.ts  rng.ts  math.ts
      content/   roster.ts cosmetics.ts achievements.ts nights.ts calls.ts tapes.ts emails.ts newspapers.ts presets.ts items.ts
      world/     level.ts build.ts collision.ts navmesh.ts circuits.ts zones.ts props.catalog.ts
      sim/
        world.ts           # World state + createWorld(seed, mode, night, players)
        step.ts            # step(world, inputsByPlayer, dt) -> events   (deterministic)
        player/            controller.ts stamina.ts flashlight.ts inventory.ts interact.ts hiding.ts downed.ts
        objectives/        power.ts breaker.ts fuses.ts generator.ts cupcakes.ts musicbox.ts failures.ts exit.ts sidetasks.ts
        ai/                agent.ts perception.ts states.ts director.ts nav.ts
                           characters/ freddy.ts bonnie.ts chica.ts foxy.ts golden.ts puppet.ts powerout.ts
                           plugins/  (one file per extended roster character)
        noise.ts  doors.ts  cameras.ts  items.ts  showtime.ts  scoring.ts
      protocol/  messages.ts api.ts snapshot.ts (delta encoding helpers)
  server/
    src/
      index.ts env.ts
      db/ schema.ts client.ts migrations/
      auth/ routes.ts sessions.ts passwords.ts ratelimit.ts
      api/ me.ts shop.ts profile.ts leaderboard.ts cosmetics.ts photos.ts
      game/ lobbyManager.ts match.ts netcode.ts interest.ts lagcomp.ts rewards.ts bots.ts voiceSignal.ts
      jobs/ cleanup.ts
    test/
  client/
    index.html
    src/
      main.ts
      net/ socket.ts prediction.ts interpolation.ts voice.ts clock.ts
      input/ bindings.ts pointerlock.ts
      ui/ screens/ hud/ clipboard/ map/ terminal/
      render/
        renderer.ts post.ts quality.ts
        world/ levelMeshes.ts materials.ts textures/ lights.ts culling.ts decals.ts
        characters/ endo.ts guard.ts freddy.ts bonnie.ts chica.ts foxy.ts golden.ts puppet.ts ... animation/
        fx/ sparks.ts arcs.ts dust.ts volumetric.ts smoke.ts rain.ts water.ts hallucinations.ts jumpscare.ts
        views/ firstPerson.ts hidingViews.ts camerasCRT.ts officeSeat.ts ghostView.ts
      audio/ engine.ts bank.ts synth/ music/ spatial.ts occlusion.ts footsteps.ts
      minigames/ partyTime.ts followMe.ts lightsOn.ts
  scripts/ balance.ts map-render.ts bake-navmesh.ts
  e2e/ fourPlayers.spec.ts
  .github/workflows/ci.yml
```

### 10.3 Server boot, env and shutdown

Boot: validate env with zod (fail fast with a clear list of what's missing), connect Postgres, run Drizzle migrations, load the level, build collision BVH, load or bake the navmesh (cache `navmesh.bin` in the build output; bake during `npm run build` with `scripts/bake-navmesh.ts` so production boot is instant), start Fastify with `@fastify/cookie`, `@fastify/static` serving `client/dist` (immutable cache on hashed assets, `no-cache` on `index.html`), register API routes, attach Socket.IO, start jobs, `listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })`. SPA fallback for non-API GETs. `trustProxy: true`.

Env vars: `DATABASE_URL` (Railway reference to the Postgres service), `SESSION_SECRET` (generate with `openssl rand -hex 32`), `PUBLIC_URL`, `NODE_ENV`, `PORT` (injected), `ROSTER_MODE` (tribute/original), `FAST_NIGHT` (1 = 10-second hours), `TEST_SEED` (only honoured when not production), `SMTP_*` and `MAIL_FROM` (optional, password reset), `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` (optional, voice relay), `LOG_LEVEL`, `MAX_LOBBIES` (default 50, protects the single instance).

Graceful shutdown on `SIGTERM`: stop new lobbies, notify sockets ("Server restarting for an update. Your progress is saved."), persist in-progress matches as `abandoned` without penalties, close DB, exit within 10 seconds.

### 10.4 Lobbies

As before: 4-letter codes (alphabet without I, L, O), up to 4 players in Night Shift (5 in Showtime: 4 guards + 1 animatronic), host controls, public/private, Quick Play, one lobby per user, empty lobbies destroyed after 2 minutes, host migration on disconnect. Lobby state includes each player's equipped cosmetics snapshot and loadout choice.

### 10.5 Simulation model

The server runs one `Match` per active night with a fixed 30 Hz simulation tick. Each tick: apply buffered player inputs (movement, look, actions) for that tick; step player controllers (shared code, same as client prediction); resolve interactions (server checks range, line of sight to the interactable, item requirements, cooldowns); step objectives, power and circuits; step AI (with staggered perception and pathing, Part 6.1); generate events (noises, catches, sounds, state changes); then the netcode layer builds per-player snapshots.

Determinism: the shared `step()` uses a seeded PRNG and fixed dt, so the balance script and tests can replay a night from a seed and an input log. Floating-point determinism across machines isn't guaranteed for physics, and that's fine; server authority makes it irrelevant for gameplay. Determinism only needs to hold within one Node process for tests and replays.

### 10.6 Netcode: prediction, reconciliation, interpolation, lag compensation

Free-roam first-person movement must feel instant, so the client predicts its own player.

Input: the client samples input every frame and sends input commands at 30 Hz: `{ seq, tick, moveX, moveZ, yaw, pitch, buttons (bitfield: sprint, crouch, jump, lean L/R, flashlight, focus, interact held, breath), actions[] }`. Actions are discrete intents (`interact(targetId)`, `useItem(slot)`, `drop`, `throw(dir, power)`, `ping(point, targetId)`, `emote(id)`).

Client-side prediction: the client applies its own inputs immediately with the shared controller code against the shared collision, keeping a ring buffer of inputs and predicted states.

Reconciliation: each server snapshot includes the last processed input `seq` for that player and their authoritative state. The client rewinds to that state, re-applies unacknowledged inputs, and smooths any remaining error over 100 ms (snap instantly if the error exceeds 1.5 m, which only happens on real desync or teleports like the glitch dimension).

Interpolation for others: remote players and animatronics are rendered 100 ms in the past, interpolating between buffered snapshots (positions, rotations, animation params). Extrapolate up to 150 ms if packets are late, then freeze.

Lag compensation for catches and interactions: the server keeps a 500 ms history of player positions. When it evaluates an animatronic catch, it checks the victim's position as the victim saw it (rewound by the victim's estimated latency, capped at 200 ms), so a player who dodged around a corner on their screen isn't caught. Conversely, for player interactions like "I held the door shut", validate against the rewound state of the door. Keep it simple and capped; fairness for the victim beats precision.

Snapshots: 20 Hz to each client (every other tick is fine at 30 Hz sim; send the latest), delta-compressed against the last acknowledged snapshot, msgpack-encoded. Quantise positions to centimetres, angles to 1/256 of a circle, and send animation params as small integers.

Interest management (fairness and bandwidth): each client receives only what it should perceive: its own full state; teammates always (positions are needed for proximity voice and nameplates); animatronics that are within 35 m, or in line of sight from the player's eyes, or currently emitting a sound the player can hear (footsteps within 25 m, laughs, shrieks), or visible on the camera the player is viewing; doors, lights, circuits and objectives always (they're public); items within 40 m or in the player's zone. This stops a hacked client from drawing every animatronic through walls while keeping 3D audio working. Ghosts receive everything.

Events: one-shot events (catches, sounds, objective completions, phone call cues, hallucination seeds) are sent reliably and attached to snapshots with tick stamps so the client schedules them precisely.

Clock sync: ping exchange on connect and every 10 s to estimate offset and RTT; the client keeps a server-tick estimate for interpolation timing.

Bandwidth budget: under 20 KB/s down per client during a busy night, under 5 KB/s up. Measure with a debug overlay showing bytes per second.

Reconnection: on reconnect, `resume { lobbyCode, lastAckTick }` returns a full snapshot. A disconnected player's character stays in the world, standing still and vulnerable, for 60 seconds ("AFK" nameplate); if they don't return, they become a ghost (their items drop). If they return later the same night, they rejoin as a ghost.

### 10.7 Collision and navigation on the server

Collision: build a static BVH from the level's wall, floor, ceiling, prop and collider geometry once at boot. The shared controller does capsule sweeps against it (slide along walls, step up small heights, ground check). Doors are dynamic colliders (oriented boxes updated when they move). Hiding spots are triggers. Vents and tubes are geometry like everything else, with low ceilings that force crawl.

Navigation: navmesh baked from walkable geometry at build time for the two agent sizes (Part 6.11), with off-mesh connections for doors (marked with door ids so agents wait for the door to open), ladders and vent grilles. Path queries run on the server only. Agents use DetourCrowd for avoidance with up to 16 agents. Debug: the dev overlay can draw the navmesh and paths on the client (the server sends debug data only in development).

### 10.8 Bots

`server/src/game/bots.ts` implements scripted guard bots used by tests, the balance script, and an optional "fill with bots" lobby setting (off by default, no rewards). Bots navigate the navmesh, do objectives in a sensible order (power first, then fuses and lights, music box whenever it drops below a threshold, cupcakes), hide when they hear chase sounds nearby, revive teammates, and check the cove. Skill profiles: novice (slow reactions, forgets the cove, rarely hides well), average, expert. Bots only use information a player in their position would have (they read the same per-player interest-filtered view). For the balance script, bots can run headless at 20x speed.

### 10.9 Voice implementation

WebRTC full mesh (max 4 peers each, 6 connections total). Signalling via Socket.IO (`voice:offer`, `voice:answer`, `voice:ice`). STUN `stun:stun.l.google.com:19302`; TURN from env vars if set. Opus at 24 to 32 kbps mono, echo cancellation and noise suppression on (browser defaults), auto gain on.

Spatialisation on each listener: for each remote peer, a Web Audio chain: `MediaStreamAudioSourceNode` (Chrome needs the remote stream attached to a muted `<audio>` element too, a known quirk) → walkie chain (only when that peer is transmitting on walkie and the listener has a walkie: band-pass and distortion, bypassing distance) → `PannerNode` (HRTF, inverse distance, refDistance 2 m, maxDistance 25 m, rolloff tuned so 25 m is near silent) positioned at the peer's interpolated head position → occlusion `BiquadFilterNode` (low-pass whose cutoff drops from 20 kHz to 900 Hz with the number of walls between listener and speaker, computed client-side by raycasting against the level every 200 ms) → gain (per-player volume and mute). Whispering when hidden is a sender-side gain tweak broadcast as a flag. Ghost voice routing: the server tells each client which peers it may hear (living hear living; ghosts hear ghosts; lobby option to mix), and the client mutes accordingly; a ghost's voice never plays for the living unless that option is on.

Voice-activity detection: compute RMS on the local mic stream to drive the speaking indicator and the "animatronics can hear voice" option (the client reports "speaking loudly" events at most 4 per second; the server turns them into noise events).

### 10.10 Database

Same schema as Part 8.3, plus: `photos (id, user_id, match_id, created_at, scene jsonb)` storing camera pose and entity states needed to re-render a photo client-side, capped at 50 per user; `collectibles (user_id, collectible_id, found_at)`; stats columns from Part 9.7 (`metres_walked`, `metres_vent`, `time_hidden_seconds`, `revives_given`, `revives_received`, `cupcakes_delivered`, `fuses_replaced`, `music_box_winds`, `catches_by jsonb`, `hiding_spot_uses jsonb`).

### 10.11 Socket protocol

Define every message in `shared/src/protocol/messages.ts` with zod and document it in `docs/PROTOCOL.md`.

Client to server: `lobby:create { mode, night, options }`, `lobby:join { code }`, `lobby:leave`, `lobby:ready { ready }`, `lobby:loadout { item }`, `lobby:settings { night, custom, options }` (host), `lobby:start` (host), `lobby:kick { userId }` (host), `lobby:skin { equipped }`, `showtime:pick { character }`, `input { seq, tick, move, look, buttons, actions[] }`, `chat { text }`, `callout { id }`, `voice:offer|answer|ice { to, data }`, `voice:loud { level }`, `resume { lobbyCode, lastAckTick }`, `clock:ping { t0 }`, `terminal:cmd { text }` (manager terminal), `keypad { digits }` (safe), `claw { dx, dz, drop }`.

Server to client: `lobby:state { lobby }`, `lobby:error { code, message }`, `night:start { seed, mode, night, levelVersion, you, roster, startsAt }`, `snap { tick, ack, delta, events }`, `night:end { result, perPlayer, rewards, achievements, photos }`, `chat`, `callout`, `voice:*`, `voice:routing { canHear: userId[] }`, `clock:pong { t0, t1 }`, `server:notice { text }`, `terminal:out { text }`.

### 10.12 Anti-cheat and trust

The server owns all randomness, AI, timers, power, objectives, item spawns and rewards. Clients send only inputs and intents. Validate movement: reject speed above the state's max plus 10% tolerance (snap back and log), reject noclip (the server's own controller step is authoritative, so client positions are never trusted; the client only sends inputs). Validate interactions by range (2.5 m with lag compensation slack), line of sight, and item requirements. Interest management hides out-of-perception animatronics. Rate-limit inputs (40 messages per second hard cap) and chat. Malformed messages: three strikes then disconnect. Leaderboards ignore guest-only teams.

### 10.13 Performance budgets (server)

One Railway instance must handle at least 10 concurrent 4-player matches. Per match per tick: player controllers under 0.3 ms, AI under 2 ms, snapshot building under 0.5 ms. Profile with a `--prof` run of the balance script. If CPU gets tight, reduce AI perception frequency for agents far from all players (agents more than 50 m from every player update at 2 Hz) and skip snapshot building for clients with nothing new.


---

## PART 11: GRAPHICS, LIGHTING, EFFECTS AND AUDIO

The owner wants full, detailed graphics and real lighting effects, with every character and all the electrical detail. In a walkable 3D building that's a bigger job than in an office game: the player can walk up to anything, look at it from any angle, and shine a flashlight on it. This part tells you how to make a browser game look like a moody, detailed horror game, entirely from procedural code, at 60 fps on an ordinary laptop. Write `docs/ART.md` as you go, documenting every material, texture generator and lighting rule.

### 11.1 Art direction

A grimy 1980s-to-90s family pizzeria after closing, half-abandoned, lovingly detailed. Checkerboard tiles (scuffed, chipped, with grime in the grout), confetti-pattern wallpaper on the lower walls above a wooden dado rail, faded paint above, stained drop-ceiling tiles (some missing, revealing wires and ducts), party streamers, balloons losing helium, kids' drawings taped everywhere, posters, cheap plastic chairs, neon signs, CRT monitors, arcade glow, exposed conduit and junction boxes in back-of-house, concrete and pipes in the basement. Colour palette: deep blue-black shadows, sickly green and teal in emergency-lit areas, warm tungsten pools from bulbs, harsh cold white from fluorescents and flashlights, saturated red from emergency lights and exit signs, purple and pink from neon and the arcade. High contrast. Most of the frame is dark most of the time. Light is earned.

The reference feel: the pre-rendered stills of the original games, brought to life in real time, with the free-roam presence of Security Breach and Secret of the Mimic. Not photorealism. Stylised realism with chunky shapes, rich materials, and lighting doing the heavy lifting.

### 11.2 Renderer setup

`THREE.WebGLRenderer` with `antialias: false` (SMAA in post), `powerPreference: 'high-performance'`, `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping` (exposure around 1.0, adjusted by the brightness setting), `shadowMap.enabled = true`, `shadowMap.type = PCFSoftShadowMap`. Pixel ratio = `min(devicePixelRatio, 2) × renderScale`. Use WebGL2. (WebGPU is tempting but riskier in browsers today; stick to WebGL2.)

Materials: `MeshStandardMaterial` for most surfaces; `MeshPhysicalMaterial` for glossy plastics (Toy and Glamrock characters, arcade cabinets, play tubes), glass, eyes (clearcoat), wet floors (clearcoat plus low roughness in puddle areas via a mask). An environment map: generate a small PMREM from a procedurally built "dark interior" scene at load, so metals and glossy surfaces have soft reflections; regenerate per zone type (pizzeria, back-of-house, basement) for variety.

Pointer lock for mouse look (request on click into the game canvas; show a "Click to resume" overlay when lost).

### 11.3 Procedural textures and materials

All textures generate at load on `OffscreenCanvas` (in a Web Worker so the main thread stays responsive) or via one-off GLSL passes into render targets, then cached in IndexedDB keyed by generator version and seed. Show progress on the loading screen with flavour lines ("Mopping the floors... Restocking cupcakes... Charging flashlights... Winding the music box...").

Generators you need (each takes a seed and parameters, outputs colour, roughness and normal maps at 512 or 1024 px; normals derived from a height map by Sobel filter): checkerboard tile (chips, scuffs, grout grime, slight per-tile colour variation, wet-patch mask), confetti wallpaper (random coloured shapes, faded, peeling seams), painted plaster (subtle mottling, water stains, cracks), wood (dado rail, desk, stage, crates), drop-ceiling tile (fissured pattern, brown water stains, a few missing tiles handled in geometry), concrete (basement floor and walls, with cracks, damp patches and painted safety lines), brick (backstage walls), metal (brushed steel for the kitchen, galvanised for ducts with seams and rivets, painted metal for doors and lockers with chipped paint revealing primer, rusted for the basement, diamond plate for the loading dock), fabric (curtains with velvet sheen, tablecloths, dust sheets), carpet (arcade cosmic carpet with an emissive blacklight mask, party room carpet), plastic (play tubes, chairs), fur (base noise + directional strand streaks, plus a fuzzy rim shader term), rubber (mats), glass grime, paper (posters, newspapers, notes, drawings; text rendered with fonts), circuit board, wiring insulation, and a generic grime/dirt overlay applied by world-space triplanar projection to break up repetition.

Decals: a decal system (use `DecalGeometry` or a projected-texture shader) for scuffs, stains, footprints, scorch marks, cracks, graffiti doodles, water puddles (reflective), spilled soda, confetti scattered on floors, cupcake crumbs (the Night 5 crumb trail). Wet footprints: players walking out of the flooded tunnel or the restroom puddle leave fading wet footprints for 20 seconds (cosmetic, nice detail).

### 11.4 Building the level geometry

The level generator (Part 3.1) outputs wall segments with openings. Turn them into detailed meshes: walls get a baseboard, a dado rail and wallpaper below, paint above, and crown trim in public areas; door openings get frames with architraves; windows get frames, sills and glass; ceilings get a drop-ceiling grid with tiles (instanced) and some missing tiles revealing ducts and cable trays above; back-of-house walls get exposed conduit runs (tube geometry along wall paths with junction boxes every few metres, generated procedurally along each wall); the basement gets pipe runs along ceilings (tube geometry with flanges, valves and labels). Merge static geometry per zone by material to keep draw calls down.

Props: a prop catalogue (`client/src/render/world/props/`) of procedural builders, each returning a `THREE.Group` and a collision shape. At minimum: party table with tablecloth, plastic chair, party hat, plate, cup, balloon (with string, gently bobbing via a vertex shader), cupcake (with candle and flame), cupcake tray, birthday star card, pizza box, arcade cabinet (with a screen running a canvas-rendered attract loop), claw machine (with plushes inside), skee-ball lane, photo booth, prize counter with plushes, gift box, music box with crank, giant plush bear, ticket machine, stage with curtains, drum kit, speaker stack, microphone stand, spotlight rig, neon sign (tube geometry with emissive glow, flicker), Pirate Cove props (ship's wheel, treasure chest, palm tree, rope netting), ball pit balls (instanced, thousands, with simple physics around players), play tubes and soft play platforms, slide, kitchen range with pots, pizza oven, prep island, shelves with ingredients, walk-in freezer with strip curtain, sink with dishes, lockers (with opening doors), benches, vending machine (glowing front, items inside), fridge, microwave, desk, swivel chair, CRT monitors, desk fan (spinning), phone, filing cabinet, wall safe with keypad, fish tank, toilets, stall partitions, sinks, mirrors, hand dryer, mop and bucket, janitor cart, laundry cart, crates, pallets, flour sacks, pallet jack, roller door, breaker panel (with 12 breakers, a master lever, analogue meters, LEDs), fuse boxes (hinged doors, fuses), generator (with pull cord and a battery slot), boiler (with glowing furnace window), catwalk with railings and ladder, pipes and valves, server racks with blinking LEDs, reel-to-reel tape player, old diner props, wall maps, posters, newspaper frames, security cameras with blinking LEDs, exit signs, emergency lights, fire extinguishers, vent grilles. Each prop has a "detail" level: close-range props get bevelled edges (use `RoundedBoxGeometry` from three's examples) and small extra parts; far props use simpler versions (LOD).

Physics props: small loose props (cups, party hats, balloons, plush toys, cans, the skee-balls) can be nudged by players and animatronics walking through them (a simple local physics solver on the client only, purely cosmetic and not synced, except throwables which the server owns).

### 11.5 Lighting strategy

A pizzeria has hundreds of light fixtures. Real-time engines can't run hundreds of dynamic lights in a browser, so we fake most of them and spend real lights where they matter.

Light tiers:

Tier 1, real shadow-casting lights (max 4 per frame on Medium, 6 on High, 2 on Low): the local player's flashlight (always, 1024 shadow map, 2048 on High); the nearest teammate flashlight pointed into view; and up to two "hero" fixtures nearest the camera from a list of fixtures marked `hero: true` in level data (the Backstage swinging bulb, the Security Office overhead, the Breaker Room fluorescent, the stage spotlights, the Kitchen's red emergency light, the Boiler furnace glow). Shadow casters are chosen each frame by a priority score (distance, visibility, importance) with hysteresis so shadows don't pop.

Tier 2, real non-shadow lights (max 16 active): other nearby fixtures in lit zones, other teammates' flashlights, animatronic eye lights within 10 m, spark and arc flashes (pooled), the arcade screens' coloured spill, Power-Out Freddy's face glow. Pre-create a fixed pool of point and spot lights at load and reassign them to the nearest relevant fixtures each frame (never add or remove lights at runtime: changing light counts recompiles shaders and stutters; just move pooled lights and set intensity to 0 when unused).

Tier 3, faked lights (unlimited): every fixture has an emissive mesh (the bulb or tube glows, with bloom), a glow sprite (soft additive halo), and a "light pool" decal on the floor and nearby walls (an additive projected gradient in the fixture's colour and shape, cone-shaped under spots, rectangular under fluorescent tubes). This sells far-away lit zones very cheaply.

Baked ambient: precompute a simple ambient occlusion and bounce approximation per zone at build time on the CPU (ray-cast AO baked into vertex colours or a low-res lightmap per merged zone mesh), stored with the level build, so corners and under-table areas are darker even without dynamic shadows. Two variants per zone: "lights off" (very dark, emergency tint) and "lights on" (warmer, brighter); blend between them when a zone's lights switch on over 1 second, which makes switching the lights on look spectacular.

Zone lighting state: each zone's lights are driven by circuit state (off, on, flickering, emergency). Emergency lighting: red strip lights and exit signs on, everything else off, ambient tinted dark red-blue. Lights-on: fixtures on, the "lights on" bake blended in, more Tier 2 lights assigned there.

Light flicker: a `Flicker` helper drives fixture intensity (and its emissive, glow sprite and floor pool together) with layered noise and occasional dropouts, synced to a buzz sound. Used for broken tubes, near-danger tells (lights in the zone around a hunting animatronic flicker subtly), power failures, and the Night 5 final hour.

Flashlight look: a cookie texture (a procedurally drawn flashlight lens pattern with a hot centre, a soft ring and slight imperfections) via a custom spotlight shader chunk, slight warm tint, dust particles visible inside the beam, a volumetric cone visible to others. When focused, the cone narrows and the hot centre intensifies. Low battery flicker. When it sweeps across an animatronic's eyes, the eyes flare (eye-shine), a key horror image.

Animatronic eyes: emissive pupils (character colour) plus a tiny Tier 2 light when within 10 m. In darkness beyond flashlight range, eyes are the only visible part, and they're visible from 30 m. When an animatronic enters CHASE, its eye intensity doubles and the colour shifts slightly (Freddy's go from pale blue to white; Foxy's yellow to orange; Bonnie's red brighten; Chica's purple to pink).

Windows: the sodium street light and passing car headlights outside project moving light through the Lobby and Dining Hall windows (a projected texture with rain streaks animating down it). Occasional lightning (every 2 to 4 minutes, disabled in photosensitivity mode) flashes through every window, briefly revealing the whole dining hall, and is followed 1 to 3 seconds later by thunder; lightning can reveal an animatronic silhouette that you didn't know was there.

Power outage: all fixtures stutter and die over 1.5 seconds, the ambient bake switches to a near-black variant, the only lights are flashlights, exit signs (on battery, dim), the boiler's furnace glow, animatronic eyes, and Power-Out Freddy's face. The darkness should be genuinely frightening.

### 11.6 Effects

Volumetric beams: cone meshes with an additive shader that fades with distance from the apex and with view angle, modulated by scrolling 3D noise for dust, for flashlights, stage spots, the swinging bulb, the projector-like light through windows, and light shafts through floor grates and crawlspace slits. Dust motes as `Points` clouds visible only inside lit volumes (a vertex shader test against the cone). God rays post effect on High for the strongest light in view.

Sparks: per Part 6B.1, from damaged animatronics, faulty fixtures (Parts & Service bulb), fuse boxes when a fuse is blown or replaced, breaker trips, and the Electrobab. Each burst lights the area with a pooled point light flash.

Electrical arcs: `LightningArc` (jagged regenerated polylines rendered as glowing tubes with bloom, a flickering light, a crackle sound) for breaker panel trips, the Electrobab, Ennard, damaged panels, and the main power restoration moment (a satisfying arc across the breaker panel as the master lever clunks home, then every LED going green).

Smoke and steam: soft particle sprites with lighting approximation (tinted by nearby light) for the boiler room's steam jets, the kitchen's faint steam, Phantom characters, burnt props, a blown fuse puff, and the Faz-Cam's after-flash haze.

Rain: outside the windows only (we never go outside): rain streaks on glass (a shader with droplets running down), splashes on the window sill, rain audible everywhere at varying volume. Under the loading dock's roller door, a thin stream of water and a puddle.

Water: the flooded tunnel uses a planar water surface with normal-mapped ripples, reflections of flashlights (a screen-space reflection approximation or a simple reflection probe), ripples spawned where players and animatronics wade, and a murky volume fog below the surface.

Mirrors: restroom mirrors and the Party Room 4 mirror use a `Reflector` (three's examples) at reduced resolution, only rendered when within 6 m and in view; needed for the mirror secrets.

Hiding view overlays: locker slats (geometry slats in front of the camera with light leaking between them and dust), under-table fringe, ball pit (screen covered by coloured sphere sprites with an underwater blur and muffled tint), curtain (fabric edges, a gap), freezer (frost creeping in from edges, breath fog sprites in front of the camera), coffin (a thin crack of light). Each overlay is a small screen-space scene layered over the main view.

Mask view: plastic interior overlay with two eye holes, a shake with breathing, and limited vision.

Downed view: desaturated, dark red vignette, blurred edges, a slow pulse; the world tilted as if lying on the floor.

Ghost view: a cold blue-white filter, a faint outline effect on the level geometry, animatronics with red outlines, other ghosts as translucent figures, the living as warm silhouettes.

Camera feeds (Security Office monitors and Faz-Pad): render the chosen camera into a 640×480 target at 15 to 20 fps, then apply the CRT shader: barrel distortion, scanlines, phosphor mask on High, animated grain, vignette, chromatic aberration at the edges, occasional horizontal sync jitter and a rolling interference band, desaturation with a tint per skin (green, amber, blue), a timestamp, camera label and REC dot overlay, static bursts on switch (120 ms) and on animatronic movement through the viewed room (0.6 s). The Security Office monitors show this on their screens in the 3D world (the render target becomes the screen's emissive map), so anyone walking into the office sees the feeds playing on the CRTs.

Post-processing (main view): SMAA, bloom (high threshold so only emissives bloom: eyes, bulbs, LEDs, neon, screens, flashlight hotspot), film grain (subtle, adjustable), vignette, slight chromatic aberration, optional motion blur, and a "danger" pass that adds a heartbeat-synced vignette pulse and slight desaturation when a hunting animatronic is within 8 m (disabled in photosensitivity mode).

Jumpscares: Part 6C.5 plus a bespoke camera: a strong under-light and red rim light on the animatronic, an exposure spike, heavy chromatic aberration, fast shake, and for hiding-spot catches the spot's geometry being torn open in the first frames. Pre-compile every jumpscare's shaders during loading (`renderer.compile`) and keep the jumpscare models warm in memory so the first scare never stutters.

### 11.7 Character rendering

Characters (Parts 6B and 6C) are built from primitives with three LODs: LOD0 (within 8 m: full detail, bevelled parts, separate fingers, visible wiring and endo parts in tears, fur shader with rim fuzz), LOD1 (8 to 25 m: merged parts, simpler hands, no wiring), LOD2 (beyond 25 m: a merged low-poly silhouette, but the eyes are always rendered with full emissive brightness). Characters have a simple skeleton driven by the procedural animation system (Part 6.11), and their meshes are skinned or parented to bones (parenting rigid parts to bones is fine for animatronics; they're robots, rigid parts look right).

Animatronic material details: fur with dirt gradients toward the feet and hands, matted patches, stains around the mouth; plastic parts (Toy, Glamrock) with clearcoat, scratches and fingerprints; metal endo parts with grime, scratches and oil; costume tears with frayed fabric edges around the openings; eyes with clearcoat corneas, emissive irises and slight bloodshot detail texture (faint red veins on the eye whites, a creepy touch, not gory).

Guard characters: Part 6C.4 and Part 8. Skin colours and materials are parameters. Wet clothes darken slightly after wading.

### 11.8 Audio

Audio engine on the Web Audio API with buses (master, ambience, sfx, footsteps, jumpscare, voice, ui, music-box), each with gain linked to settings, ending in a compressor and limiter. All sounds are synthesised or composed in code, rendered once into AudioBuffers with `OfflineAudioContext` (in a worker where supported) and cached. Spatial sounds use `PannerNode` with HRTF.

Occlusion and reverb: every positional sound is filtered by occlusion (the same wall-count raycast as voice, cached per source per 200 ms) and sent to a reverb matching the listener's zone. Generate impulse responses procedurally (exponentially decaying filtered noise with early reflections) for presets: small room, office, hallway, large hall (dining), kitchen (bright, tiled), restroom (very bright tile), back-of-house concrete, basement (long, dark), vent (metallic, short, ringy), ball pit and play tubes (muffled plastic), freezer (dead), flooded tunnel (watery echo). Crossfade presets as the listener moves between zones.

Footsteps: per surface (tile, carpet, concrete, metal grating, wood stage, water, ball pit, soft play, vent metal) and per character type (guard shoes per footsteps cosmetic, each animatronic's distinct heavy step: Freddy deep and slow, Bonnie quick and clanky, Chica clunky with a metallic rattle, Foxy fast and light with a scrape, Springtrap dragging, the Puppet silent).

Sound list (add to the classic set from earlier versions of this spec; recipes are starting points, tune by ear):

Ambience: building hum (low detuned sines plus filtered brown noise, rises with power usage), rain (layered filtered noise with random drop transients, louder near windows and the dock), thunder (low rumble with crackle), fluorescent buzz (120 Hz saw through a narrow band-pass, per fixture, positional), pipes knocking and ticking (resonant filtered clicks), drips (short sine blips with pitch drop, positional, per leak), HVAC whoosh in vents, fridge and freezer compressors, the soda fountain hum, arcade attract loops (original chiptunes, quiet, positional per cabinet), the neon sign buzz, the boiler roar, the generator diesel rumble, server room fans.

Interactions: door open/close/slam (wood vs metal variants), shutter drop (motor whine plus heavy clang), locker open/close (rattly metal), hiding entry/exit rustles, vent grille clank, crawl thunks in vents, ladder steps, switch panel clunk, fuse pull and insert (snap and electrical zap), breaker flips (heavy clacks), master lever (a huge clunk followed by the building's power-up "whomp" and rising hum), breaker trip (bang plus arc crackle), generator pull-cord (a rope zip and engine sputter; success a roaring start), music box crank ratchet (rhythmic clicks), music box melody ("Pop Goes the Weasel" on a music-box voice: sine with fast-decaying harmonics and a click per note, slowing and detuning as it unwinds via playback-rate and detune modulation), oven (gas whoosh and hum, a ding when done), cupcake placement (soft plate clink), item pickup (per item), battery swap, flashlight click, Faz-Cam flash (a capacitor whine charging and a pop-flash), noisemaker drum and squeak, walkie squelch and static, phone ring (two-tone 440 + 480 Hz pattern), PA chime, the 5 AM door chain drop, keypad beeps, terminal keyboard clacks, claw machine motor and drop, skee-ball roll.

Threat sounds: each animatronic's noticed sting (Bonnie's guitar twang, Chica's beak clack and a squawk-like synth, Foxy's pirate shriek, Freddy's laugh), chase loops (a distinct low pulsing synth per character, layered under footsteps), Freddy's laugh (formant-filtered pulses for an "o" vowel, pitched down, reverbed), Chica's kitchen clatter and breathing, Foxy's shanty hum and sprint, the Puppet's high ringing tone and frantic box melody, Golden Freddy's whisper (filtered noise shaped like speech) and crash-scream, Power-Out Freddy's Toreador March (Bizet's public-domain melody arranged by you on the music-box voice with wow-and-flutter), servo whines, jaw clacks, the "moan" of an animatronic entering a hiding check, extended roster voice lines (synthesised chirps and formant babble, never real speech recordings).

Jumpscare screams: layered harsh FM-modulated sawtooth sweeps, a resonant band-passed noise burst, a sub-bass hit, hard clipping; 0.8 to 1.2 s; per-character variations; respect the jumpscare volume cap.

6 AM: a clock chime striking six (bell-like inharmonic partials), then a crowd "Yay!" built from about 20 layered formant bursts with randomised pitches, plus party horn squeals. In free-roam, the chime plays through the whole building's PA, so every player hears it echo through the halls, followed by all the lights in the building switching on in a wave from the stage outward. That's the release.

Dynamic tension layer: no music during gameplay, but a subtle tension bed that responds to the Director's stress estimate for the local player: a sub-bass drone that rises in level and gains a slow pulse as threats get close, cutting to near silence right before scripted scares. Never melodic.

Mix rules: ambience quiet but always present; gameplay-relevant sounds (footsteps, stings, laughs, the music box) clearly audible over ambience; jumpscares loudest by a margin; voice chat sits on top of everything except jumpscares.

### 11.9 UI visual style

Menus: black background with the live title scene behind, typewriter font (Google Fonts "Special Elite") for body, a heavy display face for headings, red as the accent, a static overlay at low opacity, a slight text flicker on hover, ">>" cursors. In-game UI is mostly diegetic (the clipboard, the paper map, the Faz-Pad, wall maps, terminal screens), with a minimal HUD: a small crosshair dot (hidden when not near interactables, setting to always show), interaction prompts, the noise indicator ring, the stamina bar (only visible when not full), the flashlight battery (a small icon only when below 40%), the item hotbar (fades out when idle), teammate status (small portraits top-left with alive/downed/ghost states and a speaking indicator), subtitles centred low, pings and callouts.

### 11.10 Quality presets and performance budgets

Targets: 60 fps at Medium on a mid-range laptop with integrated graphics (Intel Iris Xe or Apple M1); 60 fps at High on a GTX 1660-class GPU; 30+ fps at Low on older integrated GPUs. Initial download under 5 MB gzipped (everything procedural). Time to first playable frame under 8 seconds on broadband including texture generation, with caching making later loads under 3 seconds.

Presets: Low (render scale 0.75, 2 shadow casters at 512, no volumetrics, no god rays, no dust, LOD distances halved, 8 Tier 2 lights, camera feeds 480×360), Medium (1.0, 4 casters at 1024, volumetric cones, dust on, 12 Tier 2 lights), High (up to 1.5 on high-DPI, 6 casters, flashlight shadow 2048, god rays, phosphor mask, more particles, 16 Tier 2 lights), Ultra (high plus motion blur option, higher shadow resolution, full-resolution mirrors). Auto-detect on first run with a 3-second benchmark on the title scene.

Budgets: under 600 draw calls per frame in the busiest view at Medium (instancing for chairs, tables, hats, balloons, ceiling tiles, ball pit balls, lockers, LEDs, cans; merged static geometry per zone per material), under 1.5 million triangles in view, zone-based culling (render the current zone, zones visible through open doorways via a simple portal graph from level data, and their neighbours; skip everything else), frustum culling on everything, lights outside the rendered zones disabled. Profile with `renderer.info` and the browser performance panel and keep a dev overlay with FPS, frame time, draw calls, triangles, active lights and shadow casters.


---

## PART 12: BUILD PLAN, TESTING AND DEPLOYMENT

### 12.1 Milestones (in order; push and deploy after each)

Each milestone ends with: lint and typecheck clean, tests green, a commit, a push to `main`, Railway deploying successfully (from Milestone 2 on), and `docs/PROGRESS.md` updated. Don't start a milestone while the previous deployment is red.

**Milestone 1: Skeleton (already done; verify).** The existing repo already has workspaces, strict TypeScript, ESLint, Prettier, Vitest, CI, `railway.json` and `/healthz`. Verify everything builds and tests pass, read the progress docs, write your free-roam plan into `docs/PROGRESS.md` (a new checklist for Milestones 3 to 15 below), and add the new dependencies (`three-mesh-bvh`, `recast-navigation`, `socket.io-msgpack-parser`) pinned.

**Milestone 2: Railway pipeline live (already done; verify).** It exists: project `arcade`, service `fnaf-replica`, Postgres, public domain. Confirm the latest `main` is deployed and healthy and whether push-to-deploy works (the Railway GitHub App note in `docs/DEPLOY.md`). If you were starting from scratch it would go like this: find the Open Arcade project. Add a PostgreSQL database to it for this game (name it `fnaf-db` if you can). Create the `fnaf-replica` service, connect it to the GitHub repo `elliotread250-source/FNAF-Replica` on `main` with auto-deploy. Set env vars (`DATABASE_URL` as a reference to the Postgres service, `SESSION_SECRET`, `NODE_ENV=production`, `PUBLIC_URL`, `ROSTER_MODE=tribute`). Generate a public domain. Set the health check path. Push and confirm a green deploy serving the placeholder. Write `docs/DEPLOY.md`.

**Milestone 3: The walkable building (single player, no threats).** Level data for every zone in Part 3, the level generator, `docs/map.svg`, procedural textures and materials, the prop catalogue (start with the props needed for the Dining Hall, Show Stage, halls, Security Office, Kitchen and Utility Corridor; fill in the rest during the milestone), collision, the first-person controller (walk, sprint, crouch, crawl, lean, jump, vault, ladders), doors, the flashlight, zone lighting with the light tiers, ambience and footsteps. This is essentially Mode E (Day Shift) with lights on and off. Deploy it. I should be able to walk the whole building on the Railway URL at this point.

**Milestone 4: Accounts (mostly done; extend).** Accounts, sessions and rate limits exist. Add the new stats columns, collectibles and photos tables with forward migrations, and replace the title screen with the live 3D stage scene from the free-roam world (Part 9.1).

**Milestone 5: Shared simulation and the first threat (single player).** Move the controller into the shared sim with the server-authoritative loop (a lobby of one), the navmesh bake, the AI framework (perception, states, search, catch), Bonnie as the first animatronic, hiding spots (lockers, under tables, closets) with view overlays, noise, the catch and jumpscare, the downed state. Debug overlay. Unit tests for the controller, perception and hiding. Now it's a horror game.

**Milestone 6: Multiplayer.** Socket.IO lobbies, room codes, ready-up, prediction and reconciliation, interpolation, lag compensation, interest management, third-person guard models with procedural animation, nameplates, pings, callouts, text chat, revives, ghosts, reconnection. Integration tests with four socket clients. Playwright test with four browsers walking around. Four friends can now explore together.

**Milestone 7: Objectives and the full core night.** Power grid and circuits, the breaker puzzle, fuse boxes and zone switches, the music box, the cupcakes, the generator, system failures, side tasks, the clipboard, the paper map, wall maps, item spawns and inventory, all small items, the Security Office (seat mode, doors, lights, cameras, lures, PA), the Faz-Pad, phone calls, the 6 AM sequence, the paycheck. Chica, Foxy, Freddy, the Puppet, Golden Freddy and Power-Out Freddy. Nights 1 to 6 tables. The AI Director. Player-count scaling.

**Milestone 8: Proximity voice and walkies.** WebRTC mesh, spatial voice with occlusion, whispering when hidden, walkie channel with radio filter, ghost routing, settings.

**Milestone 9: Skins and economy.** The full cosmetics catalogue (Part 8 plus 8.8), the Locker Room with 3D turntable, live lobby skin updates, shop rotation, rewards, emotes, first-person body and hands showing your skin, the Employee of the Month wall.

**Milestone 10: The rest of the map's content.** Every remaining zone detail, prop, hiding spot type (ball pit, coffin, freezer, stalls with perching, costume rack, photo booth), the vent network fully connected, the Stage Crawlspace, the flooded tunnel, the Manager's terminal and safe, posters, newspapers, notes, tapes, emails, collectibles, easter eggs, the Atari cabinets.

**Milestone 11: Custom Night, stars, achievements, Archives, leaderboards.**

**Milestone 12: The full roster, in waves.** Wave 2, 3, 4, 5 (Parts 6B and 6D). Each character: model with endo and wiring at three LODs, animation, jumpscare, sounds, plugin rule with tests, Archives entry. Push after each wave.

**Milestone 13: Showtime mode.**

**Milestone 14: The Office (Mode D)** using the classic FNAF 1 rules in Part 5.12.

**Milestone 15: Polish, balance, performance, accessibility.** Run the balance script and tune. Quality presets and auto-detect. Performance budgets (Part 11.10). Accessibility (Part 9.6). Final README with screenshots.

### 12.2 `railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/healthz",
    "healthcheckTimeout": 180,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5,
    "numReplicas": 1
  }
}
```

If Railway's default builder for new services is Railpack and Nixpacks causes trouble, switch to `RAILPACK` with the same commands and note it in DECISIONS.md. Pin Node 20 via `"engines": { "node": "20.x" }` and `.nvmrc`. One replica only: lobbies and matches live in memory. WebSockets work through Railway's public domain; the client connects same-origin. Navmesh baking happens in `npm run build`, so make sure the WASM module works in the build environment, or commit the baked `navmesh.bin` as a build artifact in the repo (regenerated by `npm run bake` whenever the level changes, and checked in CI that it's up to date).

### 12.3 CI

`.github/workflows/ci.yml` on push and PR to `main`: checkout, setup Node 20 with npm cache, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (unit + integration, with a `postgres:16` service container), `npm run build`, then the Playwright job (install Chromium, start the built server with `FAST_NIGHT=1` and `TEST_SEED=1234`, run `e2e/`, upload traces and screenshots on failure). WebGL in headless Chromium: launch with `--use-gl=swiftshader` or `--use-angle=swiftshader` so Three.js renders (slowly, which is fine for tests). Keep CI under 15 minutes. Enable Railway's "Wait for CI" on the service if available, or tell me to toggle it.

### 12.4 Tests you must write

Shared simulation unit tests (Vitest):

1. Controller: walking speed, sprint speed and stamina drain/regen, crouch and crawl heights, step-up, slope limit, no tunnelling through walls at max speed, vault over a 0.9 m table, can't stand up under a 1.0 m ceiling.
2. Doors: open, close, hold (delays a non-Foxy agent 3 to 5 s), Foxy smashes through, locked door requires the right key.
3. Noise: each action emits the configured radius; walls attenuate by 0.6 each; closed doors by 0.75.
4. Perception: a crouched, still player in a dark zone with flashlight off at 10 m isn't spotted by an aggression-10 agent within 5 s; the same player with flashlight on pointed at the agent is spotted within 2 s; a player at 1 m in the cone is spotted instantly; occlusion blocks sight.
5. Hiding: entering unseen means the agent must search; entering seen means it goes straight to the spot; the 0.8 s warning fires before a check; exiting during the warning gives a head start; breath hold suppresses noise and gasps on expiry; double lockers catch both.
6. Search: after losing a player, the agent checks the configured number of spots, closest to the last known position first.
7. Catch: 1.0 m range, frontal 90 degrees only, lag compensation honours the victim's rewound position, downed state starts, the attacker leaves after the satisfied state.
8. Revive: 4 s hold, interrupted by moving away, max 2 revives per player per night, third catch goes straight to ghost.
9. Freddy: never moves while any living player sees him (frustum, range, occlusion and light conditions all tested, including camera feeds); never catches a player who saw him within the last 0.4 s; moves at most 6 m per unseen second.
10. Foxy: cove stage progression, freeze when watched, neglect bonus, sprint path, closed door stops him and drains power with the increasing knock rule, flashlight focus in the first 2 s sends him back, hiding loses him.
11. Chica: smells cupcake carriers within 20 m through walls; stops at placed cupcakes; drawn to the running oven.
12. Bonnie: relocation only between nodes unseen by all players and never into an occupied zone.
13. Puppet: emerges at 0%, passes through regular doors but not shutters, ignores hiding and masks, returns when the box passes 50%, its catch skips downed.
14. Golden Freddy: trigger odds per night, appears only behind the triggered player, 3 s look-away window, Faz-Cam dismisses him, vanishes after 6 s if ignored, max twice per night.
15. Power: circuit drains match config; outage kills circuits, opens and jams shutters, puts other animatronics dormant, starts Power-Out Freddy; generator restart restores 20% once per night and ends the outage.
16. Breaker puzzle: correct load band holds the master lever; overload trips with a noise event and a 15 s cooldown; underload drops it.
17. Fuses: blown fuses block zone switches; replacing a fuse (with and without a wrench) restores them.
18. Music box: unwind rates per night, wind rates in person and remote, warnings at 30/15/5%, Puppet trigger at 0.
19. Cupcakes: carry limits, tray drop scatters cupcakes, placement on birthday tables, all-five jingle, Night 3 baking, Night 5 missing cupcake.
20. Early exit: doors unlock at 5 AM only if all required objectives are done; exiting players count as survived with the bonus.
21. 6 AM: night won if any player isn't a ghost; animatronics return to stage.
22. Interest management: a client never receives an animatronic that's beyond 35 m, out of line of sight, silent and not on their viewed camera.
23. Movement validation: the server rejects speed hacks.
24. Determinism: a seeded night with a recorded input log replays to identical event logs.
25. Director: never spawns or teleports agents in view; lull after a catch; logs adjustments within clamps.
26. One test per extended-roster plugin proving its counter and its threat.
27. Fairness: the balance script's "unfair-looking catch" count is zero across 1,000 simulated nights.

Server integration tests (Vitest + real Postgres): auth flows; guest claim; equip owned skin ok, unowned rejected; shop purchase transaction; match-end rewards exactly per the rewards table; four socket clients join by code, start a FAST_NIGHT with bots executing objectives, and all receive the same `night:end`.

E2E (Playwright, `e2e/fourPlayers.spec.ts`): server with `FAST_NIGHT=1`, `TEST_SEED=1234`, and a `TEST_HOOKS=1` flag (never in production) that exposes a tiny `window.__test` API for teleporting the local player to named interactables and triggering interactions, because driving first-person mouse movement in headless browsers is flaky. Four browser contexts sign up; player 1 creates a lobby and reads the code from the DOM; players 2 to 4 join; player 2 opens the Locker Room and equips "Graveyard Grey" and player 1's lobby shows it; all ready up; the night starts; assert all four spawned in the Staff Entrance and see each other's models (query render state via the test API); player 1 teleports to the Breaker Room and solves the panel via the test API; player 2 teleports to the Prize Corner and winds the box; players 3 and 4 deliver cupcakes; assert the clipboard ticks on all four clients; wait for 6 AM; assert the 6 AM screen and the paycheck with tokens on all four; assert `/api/me` shows `nights_survived = 1` for each. Save screenshots at each step.

Visual smoke test (manual, after deploy): a Playwright script against the live URL that walks through the Day Shift mode and saves screenshots of the Dining Hall (lights off and on), the Show Stage, Pirate Cove, the Kitchen, the ball pit, a locker hiding view, the Breaker Room with arcs, a vent interior, the Security Office monitors and a jumpscare frame into `docs/screenshots/`, used in the README.

### 12.5 The balance script

`scripts/balance.ts` runs N headless nights per (night, player count, bot skill) using the real sim and bots, in worker threads at accelerated speed. Report: survival rate (at least one non-ghost at 6 AM), average players surviving, objectives completion rate, early exits, average power left, catches by character, average revives, chases per player per night, average time between threat encounters (pacing), and the unfair-catch count. Targets with `average` bots at four players: Night 1 about 95% survival, Night 2 about 85%, Night 3 about 70%, Night 4 about 55%, Night 5 about 40%, Night 6 about 20%; with `expert` bots, Night 5 at 75%+ and Night 6 at 45%+; with `novice` bots, Night 1 still at 80%+. At least two chases per player per night on Night 2+, and no player going more than 4 minutes without a threat encounter on Night 3+. Tune config until these land within about 10 points and write the final table into `docs/BALANCE.md`.

### 12.6 Security checklist

Argon2id passwords; random session tokens hashed at rest, httpOnly, Secure, SameSite=Lax; Origin check on state-changing REST; zod validation everywhere; rate limits (auth, chat, lobby creation, inputs); no user enumeration; parameterised SQL only; no secrets in the repo; server-authoritative state, movement, interactions and rewards; interest management against wallhacks; CSP (self scripts, Google Fonts styles and fonts, `wss:` self, `blob:` and `wasm-unsafe-eval` for the navmesh WASM and audio workers); `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; user text escaped (never `innerHTML` with user content); `TEST_HOOKS` and `TEST_SEED` ignored in production (assert at boot).

### 12.7 README contents

Title and pitch, screenshots, live URL, disclaimer, how to play (controls table, objectives, co-op tips, hiding and vents, voice), modes, how to run locally (Node 20, Postgres via Docker, `cp .env.example .env`, `npm i`, `npm run db:migrate`, `npm run dev`), how deployment works (GitHub `main` to Railway `Open Arcade` / `fnaf-replica`, env vars table), roster mode switch, balance tuning, test commands, credits ("Created by elliotread250-source with Claude Code. Inspired by Five Nights at Freddy's by Scott Cawthon. All assets original.").

### 12.8 Final acceptance checklist

Go through this on the deployed Railway URL before you report back. Every line must be true.

1. The URL loads the warning, then the live 3D title scene with the disclaimer.
2. Sign up, log out, log in, guest play, guest claim all work.
3. Locker Room shows my guard on a turntable; I can equip a different uniform and accessory; it persists after reload; other players in my lobby see the change live.
4. A lobby code lets three other browsers join; we spawn together at the Staff Entrance and can see each other's skinned, animated characters.
5. We can walk the entire building: every zone in Part 3, the basement, the vents, the play tubes, the crawlspace; doors, ladders and vaulting work; no falling through floors or getting stuck in walls.
6. The building starts dark; our flashlights cut through it with shadows and visible beams; restoring main power at the breaker panel makes the building hum to life with an arc and every LED going green; flipping zone switches lights zones with a satisfying transition.
7. Fuses, the music box crank, the cupcakes, the generator, failures and side tasks all work and tick off on everyone's clipboard.
8. Animatronics roam, notice us (with tells), chase us, search hiding spots, and catch us with full jumpscares; we can hide in lockers, under tables, in the ball pit, in stalls, in the freezer and in the coffin; we can escape through vents.
9. Freddy freezes when watched (in person and on camera); Foxy sprints when the cove is neglected and stops at closed doors; Chica hunts cupcake carriers; the Puppet comes out if the music box runs down and goes back when it's wound.
10. Downed players can be revived; ghosts can spectate and ping; reconnecting works.
11. Proximity voice is spatial and muffled through walls; walkies work across the building; whispering in hiding spots works.
12. The Security Office works: doors, lights, cameras on the CRTs, lures, PA; the Faz-Pad works anywhere.
13. Power can run out; the blackout and Power-Out Freddy's Toreador sequence play; the generator or 6 AM can save us.
14. 6 AM rings through the building, all lights come on, the animatronics walk back to the stage, the paycheck awards tokens, stats update.
15. Graphics: real-time shadows from flashlights and hero lights, volumetric beams with dust, flickering fixtures, glowing animatronic eyes in the dark, visible endoskeletons, wiring and sparks on damaged characters, electrical arcs at the breaker panel, the CRT camera look, rain on windows, lightning, water in the flooded tunnel; 60 fps at Medium on an ordinary laptop.
16. Every character I shipped appears in the Archives with an x-ray endo view; unbuilt ones show as silhouettes and are listed in PROGRESS.md.
17. Custom Night, stars, achievements, collectibles and Showtime work (or are listed in PROGRESS.md as next if the session ended first).
18. Accessibility toggles work, especially photosensitivity, reduced jumpscares, subtitles and visual sound cues.
19. CI is green on the latest commit; Railway's latest deployment is that commit and healthy.
20. Setting `ROSTER_MODE=original` on Railway and redeploying changes every character, venue, company and currency name everywhere.

### 12.9 What to tell me when you're finished

The live URL; the GitHub repo link; a short paragraph on what's in the game; anything from this prompt you didn't finish or changed, with reasons; the balance table summary; how to switch roster mode; and anything I need to click in Railway or GitHub myself. Short and specific.

---

## APPENDIX A: CONFIG FILE STARTING POINT

Every tunable lives in `shared/src/config.ts`, in seconds, metres and percents, converted to ticks in one place.

```ts
export const CONFIG = {
  TICK_HZ: 30,
  SNAPSHOT_HZ: 20,
  HOUR_SECONDS: process.env.FAST_NIGHT === '1' ? 10 : 150,
  HOURS_PER_NIGHT: 6,

  player: {
    WALK: 2.8, SPRINT: 5.0, CROUCH: 1.5, CRAWL: 1.4, WADE: 1.7, CARRY_WALK: 2.0, CARRY_SPRINT: 3.0, MASKED: 1.2,
    HEIGHT_STAND: 1.75, HEIGHT_CROUCH: 1.1, HEIGHT_CRAWL: 0.6, RADIUS: 0.3,
    EYE_STAND: 1.62, EYE_CROUCH: 0.95, EYE_CRAWL: 0.45,
    JUMP_HEIGHT: 0.45, STEP_HEIGHT: 0.35, VAULT_MAX: 1.0, LEAN: 0.35,
    STAMINA_DRAIN: 14, STAMINA_REGEN: 10, STAMINA_REGEN_HIDDEN: 6, STAMINA_REGEN_DELAY: 1.2, STAMINA_MIN_TO_SPRINT: 25,
    BREATH_HOLD: 8, BREATH_REFILL: 6,
    INTERACT_RANGE: 2.0,
    BLEED_OUT: 45, REVIVE_TIME: 4, MAX_REVIVES: 2,
    AFK_GRACE: 60,
  },

  noise: { WALK: 6, SPRINT: 16, CROUCH: 2, CRAWL_VENT: 6, CRAWL_SOFT: 2, WADE: 12, LAND: 8, VAULT: 8,
           DOOR_OPEN: 6, DOOR_SLAM: 14, DOOR_FORCE: 18, DROP: 8, BREAKER_TRIP: 30, GENERATOR_MISS: 25,
           OVEN: 12, CRANK: 5, NOISEMAKER: 30, GASP: 10, FLASH: 14, WALL_FACTOR: 0.6, DOOR_FACTOR: 0.75 },

  flashlight: { DRAIN: 1.2, FOCUS_MULT: 3, BATTERY_PACK: 50, RANGE: 22, CONE: 28, FOCUS_RANGE: 35, FOCUS_CONE: 12 },

  ai: {
    PATROL_SPEED: [1.6, 2.4], CHASE_SPEED: [4.4, 5.4], DECISION_INTERVAL: [6, 2],
    VISION_DARK: [8, 12], VISION_LIT: [18, 26], DETECT_TIME: [1.4, 0.6], HEARING_MULT: [1.0, 1.4],
    SEARCH_DURATION: [20, 40], SPOTS_PER_SEARCH: [2, 4],
    CONE_H: 100, CONE_V: 70, NOTICE_THRESHOLD: 0.3, INSTANT_SPOT_RANGE: 1.5,
    CATCH_RANGE: 1.0, CATCH_ARC: 90, SATISFIED: [4, 8], CHECK_WARNING: 0.8, CHECK_TIME: [1.2, 2.0],
    ANTI_CAMP_SECONDS: 90, SPAWN_PROTECTION_N1: 90, SPAWN_PROTECTION: 45,
    FREDDY_MAX_UNSEEN_STEP: 6, FREDDY_GRACE: 0.4, FREDDY_VIEW_RANGE: 30,
    BONNIE_RELOCATE_AFTER: 20,
    FOXY_FREEZE: [1, 15], FOXY_NEGLECT: 60, FOXY_NEGLECT_BONUS: 4, FOXY_SPRINT_SPEED: 7.0, FOXY_SPRINT_MAX: 60,
    FOXY_KNOCK_DRAIN_START: 2, FOXY_KNOCK_DRAIN_STEP: 2,
    CHICA_SMELL: 20, CHICA_EAT: [15, 40],
    PUPPET_SPEED: 3.6, PUPPET_RETURN_SPEED: 8, PUPPET_RECALL: 50,
    GOLDEN_ODDS: { 3: 1/2000, 4: 1/2000, 5: 1/2000, 6: 1/500, custom: 1/200 }, GOLDEN_WINDOW: 3, GOLDEN_VANISH: 6,
    POWEROUT_SPEED: 4.0, POWEROUT_SONG: [15, 25],
  },

  power: { START: { 1: 100, 2: 90, 3: 85, 4: 75, 5: 70, 6: 60 }, BASE: 4, PER_CIRCUIT: 1.5, SHUTTER: 3, OFFICE_DOOR: 3,
           OFFICE_LIGHT: 2, MONITOR: 2, STAGE_LURE: 2, OVEN: 3, GENERATOR_BONUS: 20,
           BREAKER_BAND: [10, 14], BREAKER_COOLDOWN: 15 },

  musicBox: { UNWIND: { 1: 0.35, 2: 0.4, 3: 0.5, 4: 0.58, 5: 0.65, 6: 0.8 }, WIND: 10, WIND_REMOTE: 4, WARN: [30, 15, 5] },

  objectives: { BLOWN_FUSES: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6 }, FAILURES: { 1: 0, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7 },
                FUSE_INSERT: 2, FUSE_INSERT_WRENCH: 1.2, OVEN_TIME: 30, EARLY_EXIT_HOUR: 5, EARLY_EXIT_BONUS: 0.25 },

  lures: { STAGE_RANGE: 35, STAGE_DURATION: 25, STAGE_COOLDOWN: 90, ZONE_RANGE: 15, ZONE_COOLDOWN: 30 },

  scaling: { AGGRESSION: { 1: 0.6, 2: 0.75, 3: 0.9, 4: 1.0 }, MUSIC_BOX: { 1: 0.7, 2: 0.85, 3: 1.0, 4: 1.0 } },

  rewards: { /* Part 8.6 values */ },
} as const;
```

## APPENDIX B: GLOSSARY

Aggression: the 0 to 20 number that drives how active and perceptive an animatronic is (the free-roam version of FNAF's AI level). Move opportunity: a timed roll of 1 to 20 against aggression that decides whether an animatronic makes a hunting decision. Zone: a logical area of the map with its own lights, circuit, reverb and camera. Circuit: a power line controlling zones, switched at the breaker panel and zone switches. Hiding spot: a place a player can enter to be hidden from sight. Search: an animatronic's routine of checking hiding spots after losing a player. Downed: the state after being caught, revivable within the bleed-out time. Ghost: a player out for the night who can spectate and ping. Director: the pacing system that nudges the AI. Interest management: sending each client only what it should perceive. Endo: endoskeleton. Springlock: the spring mechanism in early suits. Tribute mode and original mode: classic names versus original names. Faz-Tokens: earned currency for cosmetics only.

## APPENDIX C: TONE REMINDERS FOR YOU, THE BUILDER

Quiet is the main course. Darkness is the map. Hiding is the heart. Every catch must be explainable in one sentence. Polish the first ten minutes most: the warning, the title, walking in through the staff door, the first flashlight sweep across the dark dining hall, the breaker panel roaring to life, the first time the Dining Hall lights flood on, the first guitar twang in the distance, the first locker you hide in while footsteps stop outside. If those land, people play all night with their friends. Keep it fair, keep it funny between the scares, and keep it terrifying when it counts.

Now go build it. Start with Milestone 1, and don't stop until the acceptance checklist is all green on the live Railway URL.


# FNAF REPLICA: THE MASTER BUILD PROMPT

You are Claude Code. You're about to build, test, commit, push and deploy a complete online multiplayer survival horror game called FNAF Replica. It's an unofficial, non-commercial fan tribute to Scott Cawthon's Five Nights at Freddy's series. Up to four players join a lobby over the internet, sign into real accounts, pick and change skins, and try to survive five nights (plus bonus nights) as night guards at a haunted family pizzeria while animatronic characters roam the building and hunt them.

This document is long on purpose. It's around thirty thousand words, and every section exists because a vague spec produces a vague game. Read the whole thing before you write a single file. Then work through the build plan in Part 12 in order. When this prompt gives you an exact number, use it. When it gives you a range or says "tune", pick a sensible value, put it in the central config file, and move on. When something isn't covered, make the call a seasoned indie horror developer would make and write a one-line note about it in `docs/DECISIONS.md`.

Don't stop to ask me questions unless you're truly blocked (for example, a credential is missing and there's no way around it). I want to come back to a deployed, playable game with a live URL.

---

## PART 0: THE MISSION, THE TARGETS, THE RULES

### 0.1 What "done" means

You're done when all of the following are true, and not before.

1. The code lives in the GitHub repository `elliotread250-source/FNAF-Replica` on the `main` branch. That repository already exists and has a starter README and a Node `.gitignore`. Pull it, build on top of it, and push to it.
2. The game is deployed on Railway inside my existing Railway project called **Open Arcade**, as its own service named `fnaf-replica`, wired to auto-deploy from the GitHub repository's `main` branch. This is my standard pipeline: GitHub is the source of truth and Railway deploys from GitHub on every push. Never deploy by uploading a local folder with `railway up` as the permanent setup; that's acceptable only as a one-off smoke test, and the final state must be GitHub-connected.
3. A Railway PostgreSQL database is attached to that service (inside the Open Arcade project) and the game's accounts, skins, stats and unlocks persist across redeploys.
4. The service has a public Railway domain (generate one, something like `fnaf-replica-production.up.railway.app`) and the health check at `/healthz` returns `200`.
5. I can open the URL on a desktop browser, create an account, log in, change my skin, create a lobby, share a four-letter room code with three friends, and all four of us can play Night 1 together, in sync, with jumpscares, power, doors, lights and cameras all working.
6. The README explains how to run it locally, how the deployment works, and what each environment variable does.
7. Automated tests pass in CI (GitHub Actions) and locally: unit tests for the simulation, integration tests for the socket protocol, and a Playwright test that spins up four headless browser clients and plays through a scripted short night.

### 0.2 Hard deployment targets

| Item | Value |
|---|---|
| GitHub owner | `elliotread250-source` |
| GitHub repo | `FNAF-Replica` |
| Default branch | `main` |
| Railway project | `Open Arcade` (already exists, find it, don't make a new one) |
| Railway service name | `fnaf-replica` |
| Railway database | PostgreSQL, added to the Open Arcade project, referenced by the service as `DATABASE_URL` |
| Runtime | Node.js 20 LTS |
| Health check path | `/healthz` |
| Public port | whatever Railway injects as `PORT` (never hardcode 3000 in production) |

If you have Railway MCP tools available in your session, use them (`list-projects` to find Open Arcade, `create-service`, `connect-service-source` to link the GitHub repo, `set-variables`, `generate-domain`, `list-deployments`, `get-logs`). If you don't, install and use the Railway CLI (`npm i -g @railway/cli`, then `railway login`, `railway link`, and so on). If Railway auth is missing entirely, finish everything else, push to GitHub, and write the exact click-by-click steps for me in `docs/DEPLOY.md` and in your final message. That's the only acceptable reason to stop short of a live URL.

### 0.3 Legal and IP guardrails (read this carefully, it affects every asset you make)

Five Nights at Freddy's, its characters, logos, art, music, sound effects, voice lines and text are owned by Scott Cawthon. Fan games are a long, loved tradition in this community, and Scott has historically supported non-commercial fan projects. That tolerance has limits, so this project follows strict rules.

The game mechanics are fair game. Mechanics, systems, rules and genre conventions aren't protected by copyright. Doors, lights, power, cameras, AI levels, a six-hour night, an animatronic that moves when you're not looking: all of that you can replicate faithfully, and you should, down to the timing tables.

The assets must be 100% original. You will not download, rip, trace or embed a single image, model, sound, song or voice line from any official FNAF game, film, book or merchandise, and you won't pull fan-ripped assets from sites like Spriters Resource, Sketchfab or YouTube either. Every visual is generated by you in code (Three.js geometry, shaders, canvas drawing, SVG). Every sound is synthesised by you at runtime with the Web Audio API, or composed as data (note arrays) in the repo. The only exception to "compose it yourself" is music that's in the public domain, such as Bizet's "Toreador Song" from Carmen (1875), which the original game used as Freddy's power-out jingle. You can play that melody because Bizet's score is public domain, but you must synthesise it yourself from notes, not sample any recording.

Phone call scripts must be original writing. You'll find guidance in Part 7 on tone and content. The Phone Guy's real lines are copyrighted text, so write new calls that hit the same beats (friendly, rambling, darkly funny, increasingly worried) in your own words.

Character names: the game ships with a roster file that supports two modes. `ROSTER_MODE=tribute` (the default) uses the classic names Freddy, Bonnie, Chica, Foxy and Golden Freddy, because this is a tribute and those names are what players expect. `ROSTER_MODE=original` swaps in original names and colourways (defined in Part 6) with a single environment variable change, so the owner can flip to a fully original cast in thirty seconds if they ever receive a takedown request or want to monetise. Every place in the code that shows a character name must read it from the roster, never hardcode it.

Title screen and footer must carry this disclaimer, verbatim: "FNAF Replica is an unofficial, non-commercial fan game. Five Nights at Freddy's and all related characters are the property of Scott Cawthon. This project is not affiliated with or endorsed by Scott Cawthon or Steel Wool Studios. All art, audio and code in this game are original." Add a `/legal` page with the same text plus a contact email placeholder `TODO_CONTACT_EMAIL` I'll fill in.

No monetisation. No payments, no ads, no paid skins. All cosmetics are earned through play. Don't add Stripe or any payment SDK, even as a stub.

### 0.4 Working style for this build

Commit early and often with clear messages (`feat(sim): add Bonnie pathing`, `fix(net): resync after reconnect`, and so on). Push to `main` at the end of every milestone in Part 12 so Railway deploys continuously and I can watch progress. If CI goes red, fix it before starting the next milestone. Keep a running `docs/PROGRESS.md` with a checklist of milestones, ticked as you go.

Write TypeScript everywhere, with `strict: true`. No `any` unless you write a comment explaining why. Format with Prettier, lint with ESLint (flat config). Keep functions small. Keep the simulation pure and deterministic so it's testable without a browser or a network.

When you're unsure between two options, pick the simpler one that still feels good to play. Feel beats architecture. A FNAF game lives or dies on three things: the dread of the quiet, the clarity of the rules, and the fairness of the scare. Every decision you make should serve those three.

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

The sequels show how FNAF stays fresh: each game swaps one core defence for a new one. Our multiplayer game uses this idea to give each player in the lobby a distinct station with a distinct mechanic (Part 3). Here's the menu we'll draw from.

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

Information is the currency. You only know where things are if you look, and looking costs power and attention. Every camera check is a choice between watching one threat and leaving another unwatched. In multiplayer, sharing information between players becomes the core skill. The design should make communication valuable but not free (Part 3 introduces a "radio" with limited bandwidth).

Constraints breed dread. You can't run, you can't fight, you can't save. You can only manage resources. Never give the guards a weapon. Never let them leave their station during a night (except in specific scripted task moments).

The rules are learnable. A good FNAF death is one where you immediately know what you did wrong ("I didn't check the left light"). Every threat must have tells (audio cues, visual cues on camera, door-light silhouettes, error buzzes), and the tells must be consistent. Tune for fairness first, then raise difficulty by stacking rules and raising AI, never by hiding tells.

Silence is an instrument. Most of the time the game is quiet: fan whir, a hum, distant thumps. Sound design is half of the experience. Don't put music over gameplay. Ambient drones only.

Jumpscares are a punctuation mark, not a sentence. They're short, loud and final. And they end the night (for that player).

Low fidelity helps. The grainy, flickering, half-lit cameras make your imagination do the work. Our renderer will lean into CRT noise, scanlines, low resolution, vignetting and harsh contrast rather than chasing realism.

Mystery sells. Hidden minigames, rare events, cryptic newspaper text and secrets keep a community theorising. We'll plant several (Part 9).

---

## PART 2: THE GAME WE'RE BUILDING (HIGH-LEVEL DESIGN)

### 2.1 The pitch in one paragraph

FNAF Replica takes the original 2014 formula and splits it across four players. The pizzeria now has four security stations instead of one office, each with its own doors, its own tools and its own blind spots, all running off one shared building power supply. The animatronics roam the same building and can approach any station. Players talk over a crackly in-game radio, warn each other about what they see on camera, and decide together who spends power and when. Survive until 6 AM with at least one guard still alive and the whole team gets paid. Lose everyone and it's game over. Solo players can play the classic single-office version, and it plays almost exactly like the 2014 original.

### 2.2 Game modes

The game ships with four modes. Build them in the order listed; the first two are the heart of the product.

**Mode A: Night Shift (co-op, 1 to 4 players).** The main mode. One to four players pick stations and play Nights 1 through 5, then unlock Night 6 and the Custom Night. Difficulty scales with player count (Part 5.6). Progress is per-account: each player's highest beaten night is saved on their account, and a lobby can start any night that the lobby host has unlocked. Players who haven't unlocked that night can still join (they'll unlock it for themselves on a win).

**Mode B: Classic Office (solo).** A faithful single-player recreation of FNAF 1. One office, two doors, two lights, eleven cameras, four animatronics plus Golden Freddy, the exact AI and power tables in Part 1.3. This is the "museum piece" and it's also our testbed: if the simulation feels right here, the multiplayer version will too. It runs on the same server-authoritative engine as everything else (a lobby of one), so there's no separate code path to maintain. It also works offline-free (still needs a connection, that's fine).

**Mode C: Showtime (asymmetric versus, 2 to 4 players).** One player controls the animatronics; the other one to three players are guards. The animatronic player sees a top-down "animatronic map" of the building, picks which animatronic to move, and can only move each one at a limited rate (each has its own cooldown, mirroring the movement opportunity intervals). The AI still drives any animatronic the player isn't controlling at a modest level, so the building never feels empty. The animatronic player wins by jumpscaring every guard before 6 AM. The guards win by surviving. Build this after Night Shift is stable. Give it its own leaderboard.

**Mode D: Custom Night (co-op or solo).** Unlocked by beating Night 5 (for Night 6) and Night 6 (for Custom Night) on your account. A screen with every animatronic's portrait and an AI slider from 0 to 20 each, plus preset challenges (Part 5.5). Like Ultimate Custom Night, it also lets the host toggle optional threats from the extended roster on and off. Beating specific presets awards stars and exclusive skins.

### 2.3 The building map

The co-op building is larger than FNAF 1's, with four stations placed so each one has a distinct "approach geometry". Represent the building as a graph of nodes (rooms) and edges (doorways/halls/vents). Animatronics move between nodes along edges. Cameras are attached to nodes. Doorways into stations are special edges guarded by doors or other defences.

Here is the canonical node list for the co-op map. Every node has an id, a display name, a camera code if it has a camera, and a list of connections. Put this in `shared/content/map.coop.ts` as typed data. Coordinates are in a 2D layout grid (0 to 100 on each axis) used for the tablet map, the animatronic player's map in Showtime, and the debug view.

| Id | Display name | Cam | Layout (x,y) | Connects to |
|---|---|---|---|---|
| `stage` | Show Stage | CAM 01 | (50,10) | `dining` , `backstage` |
| `backstage` | Backstage | CAM 02 | (72,6) | `stage`, `parts` |
| `parts` | Parts & Service | CAM 03 | (88,14) | `backstage`, `east_hall` |
| `dining` | Dining Area | CAM 04 | (50,30) | `stage`, `cove`, `west_hall`, `east_hall`, `kitchen`, `arcade`, `party_a` |
| `cove` | Pirate Cove | CAM 05 | (24,22) | `dining`, `west_hall` (Foxy sprint lane only) |
| `kitchen` | Kitchen | CAM 06 (audio only) | (70,34) | `dining`, `restrooms`, `east_hall` |
| `restrooms` | Restrooms | CAM 07 | (86,40) | `kitchen`, `east_corner` |
| `arcade` | Prize Corner & Arcade | CAM 08 | (30,44) | `dining`, `west_corner`, `vent_hub` |
| `party_a` | Party Room 1 | CAM 09 | (50,50) | `dining`, `party_b`, `vent_hub` |
| `party_b` | Party Room 2 | CAM 10 | (50,64) | `party_a`, `south_hall` |
| `west_hall` | West Hall | CAM 11 | (14,46) | `dining`, `cove`, `west_corner`, `supply` |
| `supply` | Supply Closet | CAM 12 | (6,58) | `west_hall` |
| `west_corner` | West Hall Corner | CAM 13 | (18,64) | `west_hall`, `arcade`, door: `office_west` |
| `east_hall` | East Hall | CAM 14 | (82,52) | `dining`, `kitchen`, `parts`, `east_corner` |
| `east_corner` | East Hall Corner | CAM 15 | (82,66) | `east_hall`, `restrooms`, door: `office_east` |
| `south_hall` | South Hall | CAM 16 | (50,78) | `party_b`, door: `office_south_left`, door: `office_south_right` |
| `vent_hub` | Ventilation Junction | CAM 17 | (40,58) | `arcade`, `party_a`, vent: `office_control` |
| `office_west` | West Office (Station 1) | none | (18,82) | door from `west_corner` |
| `office_east` | East Office (Station 2) | none | (82,82) | door from `east_corner` |
| `office_south` | South Office (Station 3) | none | (50,92) | two doors from `south_hall` |
| `office_control` | Control Room (Station 4) | none | (34,74) | vent from `vent_hub` |

The four stations are deliberately different. The West Office is the classic left-door FNAF experience with a long hall and Pirate Cove's sprint lane. The East Office is the classic right-door experience with the kitchen and restrooms route. The South Office has two doors close together onto one hall, so it's the "busy" station. The Control Room has no doors at all; it's reached only through a vent, and it's where the Engineer lives, managing power, maintenance and lures for everyone (FNAF 3 style).

Draw this map. Build a debug overlay (toggle with `F9` in development builds only) that renders the node graph with animatronic positions so you can watch the AI live.

The Classic Office map (Mode B) uses the FNAF 1 camera list from Part 1.3 exactly, with one office and two doors. Put it in `shared/content/map.classic.ts`.

### 2.4 Stations and roles

Each player occupies one station. In the lobby, players pick a station (first come, first served, host can reassign). Stations come with role names for flavour and with different tool kits. When fewer than four players are in a lobby, unused stations are "sealed" (their doors are welded shut for the night and animatronics won't path into them), and the remaining stations get the tool consolidation rules in Part 5.6.

| Station | Role name | Defences | Unique tool |
|---|---|---|---|
| West Office | Night Guard (West) | Left door, left light | Flashlight beam down the West Hall (pushes Foxy back to the cove if flashed while he's in the hall's first half) |
| East Office | Night Guard (East) | Right door, right light | Kitchen microphone: hear the kitchen clearly and get a direction cue on footsteps |
| South Office | Night Guard (South) | Two doors (south-left, south-right), two lights | Freddy mask: wear a mask to fool a "mask-able" visitor in the office (FNAF 2 mechanic) |
| Control Room | Technician | Vent seal (one shutter), vent light | Maintenance panel: reboot systems, reroute power, play audio lures, wind the music box |

Every station also has a camera tablet that shows all cameras, but with an important twist for co-op: each player's camera feed costs power individually. Four players all staring at cameras drains the building four times as fast. That's the main tension lever in co-op. The team must split watching duties.

### 2.5 Core loop of a night

1. Lobby. Players join with a code, pick stations, pick skins, ready up. Host picks the night.
2. Intro. A three-second black screen with "12:00 AM" and "Night N" in the classic typewriter font style (our own font choice, see Part 11), plus the station name.
3. Phone call. The phone rings in every station. The call plays in sync for everyone (server-timed). Any player can vote to mute; if half or more of the living players hit mute, it mutes for all. Calls for Nights 1 to 5 are written in Part 7.
4. The night. Six in-game hours. Animatronics move. Players watch, talk, close doors, flick lights, use station tools. Power drains.
5. Deaths. When a guard is jumpscared, that player sees the full jumpscare and a short static "game over" card, then becomes a Ghost (Part 3.10) for the rest of the night and can still watch cameras (free of power cost) and ping things for the living. Ghosts can't press anything that affects the world.
6. Victory or defeat. At 6 AM, if any guard is alive, everyone (alive or ghost) sees the 6 AM chime and the cheer. Living guards earn full pay; ghosts earn half. If all guards die before 6 AM, everyone sees the game over screen.
7. Paycheck screen. Shows earnings (Faz-Tokens), achievements earned, and stats (power used, cameras checked, doors closed, close calls, time of death). Then back to the lobby. The same lobby can go again.

### 2.6 What players can and can't do

Guards can look left and right inside their station (mouse pan or arrow keys or A/D, see Part 11.5). They can click doors, lights and tools. They can raise and lower the camera tablet (Space or S or right-click). On the tablet they can switch cameras by clicking a map or using number keys. They can hold the push-to-talk radio (Part 3.9). They can ping a camera to flag it for the team ("Bonnie on 11!"). They can't walk, can't leave their station, can't fight, can't see another station's office directly. That's it. The constraint is the game.

---

## PART 3: SYSTEMS SPEC (STATIONS, DOORS, LIGHTS, CAMERAS, POWER, RADIO)

Everything in this part runs inside the server simulation in `shared/sim/` (shared because the client also runs a predicted copy for responsiveness, see Part 10.6). The server is authoritative. Clients send intents ("I pressed the left door"), the server validates and applies them, then broadcasts state.

### 3.1 Simulation clock

The simulation runs at a fixed 20 ticks per second (50 ms per tick). All gameplay timers are expressed in ticks internally, but the config file expresses them in seconds for readability and converts once at load. Never use `Date.now()` inside the simulation; it receives `dt` and a tick counter. Use a seeded PRNG (mulberry32 or xoshiro128**) for every random roll so a night can be replayed from its seed for debugging and tests. Store the seed in the match record.

A night's in-game hour length defaults to 89 seconds, like the original, making a night about 8 minutes 54 seconds. Expose `HOUR_SECONDS` in config. For development and for the Playwright test, an environment variable `FAST_NIGHT=1` sets it to 5 seconds so a full night finishes in 30 seconds.

The clock displays 12 AM, 1 AM, 2 AM, 3 AM, 4 AM, 5 AM, then 6 AM triggers victory. Show only the hour, like the original. Don't show minutes. Not knowing exactly how close 6 AM is matters to the tension.

### 3.2 Doors

Every door has state `open` or `closed`, plus a `jammed` flag and a `cooldown` timer.

Pressing the door button toggles it. The door takes 0.25 seconds to slam shut or slide open (visual animation and a heavy metallic clunk sound). For logic purposes, a door counts as closed the instant the close is accepted by the server, because input latency already adds delay and players must never feel cheated by an animation. A closed door adds 1 usage bar for its station.

A door can be jammed by certain events: an animatronic inside the office disables the door button for that side (pressing gives a harsh error buzz and the button light flickers red), a power outage forces all doors open and jams them, and the Technician's maintenance failure "Door Controls (Station X)" can jam a station's doors in the position they're in until rebooted.

The door button has a 0.1 second cooldown to prevent spam toggling exploits. Spam beyond 10 presses per second from a client is rate-limited server side.

### 3.3 Lights

Every doorway has a light. Lights are momentary in our game: hold the button (or hold the key) to keep it on, release to turn it off. In the original you click to toggle, and players fumbled; holding feels better and naturally limits power use. Add a setting "Toggle lights instead of hold" for purists.

A lit doorway shows whatever is standing in the blind spot just outside the door (the "door node", which is the corner camera node with a sub-position `at_door`). If an animatronic is at that door, the light reveals its silhouette in the doorway with eyes catching the light, and a short, loud musical sting plays the first time per approach (the original's window scare sound, recreated with our own synthesised sting). A light adds 1 usage bar while on. Lights flicker randomly when an animatronic is close but not at the door (in the corner node) as a subtle tell, implemented as a 15% chance per 0.5 seconds of a 60 ms flicker.

### 3.4 Cameras

The tablet shows one camera at a time, with a map overlay in the bottom right listing all cameras. Switching cameras plays a short static burst (120 ms) and a click. Each camera feed is a rendered view of a node (Part 11.3). If an animatronic is in a node, it's visible in that camera's view in one of several pose spots for that node (each node defines 1 to 3 pose spots so animatronics don't overlap).

Cameras have these special behaviours. The Kitchen camera is audio only: the feed shows "-CAMERA DISABLED- AUDIO ONLY" over static, and if an animatronic is in the kitchen, you hear clattering pots and pans, louder for Chica, deeper thuds for Freddy. When an animatronic moves into or out of the node a player is watching, that feed glitches with heavy static for 0.6 seconds and goes briefly dark. This is the original's "camera cuts out when they move" trick, and it means you never see the actual movement, only the before and after. Freddy and Golden Freddy can't move while any player is watching their node. Foxy's progression is slowed while any player watches Pirate Cove (see Part 4).

Camera tablet raise/lower takes 0.3 seconds, with a flip animation and a whoosh. While the tablet is up, the player can't see their office. They also can't operate doors or lights (they're holding the tablet). This matches the original's tension, where you had to put the monitor down to react.

Each player with the tablet up adds 1 usage bar. In co-op, usage is summed across all stations (Part 3.6).

### 3.5 The camera ping

While viewing any camera, a player can press `Q` or click the ping button to drop a ping on that camera. Pings appear on every player's tablet map as a pulsing marker with the pinger's name and colour for 8 seconds, and play a soft radio blip for others. Max one active ping per player. Pings are free (no power cost). This is the main non-voice communication tool and it's essential for players who don't want to use voice.

Ghosts (dead players) can ping too, and their pings are shown in a pale ghostly colour.

### 3.6 Power (shared grid)

In Night Shift co-op, all stations draw from one shared building power pool shown on every HUD as a percentage, along with "Usage" bars per station and a total usage bar.

Base the drain model on the original and then scale it. Each station has a usage count: 1 for being occupied and alive, plus 1 per closed door, plus 1 per lit light, plus 1 if the tablet is up, plus 1 per active station tool (Part 3.7). Sealed or dead stations count 0 (dead players' stations go dark).

The total drain rate per second equals the sum over occupied stations of `BASE_DRAIN_PER_USAGE[usage]` multiplied by `CO_OP_POWER_SCALE[playerCount]`, plus the night's passive drain. Use these defaults in config:

```ts
// percent of total power drained per second, for ONE station at a given usage level
// derived from FNAF 1: 1% per 9.6s at usage 1, per 4.8s at usage 2, etc.
BASE_DRAIN_PER_USAGE = { 1: 1/9.6, 2: 1/4.8, 3: 1/3.2, 4: 1/2.4, 5: 1/1.9, 6: 1/1.6 };

// the pool is shared, so each additional station must drain less per station,
// or four players would black out by 2 AM. Tune these in playtests.
CO_OP_POWER_SCALE = { 1: 1.0, 2: 0.6, 3: 0.45, 4: 0.36 };

// extra passive drain (percent per second) by night, mirrors FNAF 1's interval drain
PASSIVE_DRAIN = { 1: 0, 2: 1/6, 3: 1/5, 4: 1/4, 5: 1/3, 6: 1/3, 7: 1/3 };
```

The target feel: on Night 1 with four careful players, the team ends the night with 30% to 50% power left. On Night 5 with four average players, the team should be scraping 0% to 15% by 6 AM, and the outage should happen in maybe a third of attempts. Add a balancing script (`npm run sim:balance`) that runs a few thousand simulated nights with scripted "bot guards" of different skill profiles (Part 12.5) and prints average remaining power and survival rates per night per player count. Use it to tune these numbers before calling the game finished. Record the final tuned numbers and the bot results in `docs/BALANCE.md`.

When power hits 0% in co-op, every station goes dark at once. Doors in all stations open and jam. Lights and tablets die. The fan spins down (the audio pitch slides down over two seconds). After a 3 to 8 second random pause, the Power-Out Freddy sequence begins (Part 4.7), but in co-op it happens at one station at a time, picked at random among living guards, and then moves to the next station after the first jumpscare. 6 AM can still save everyone who's left, so the power-out sequence for each station takes 15 to 25 seconds, and an in-game hour still ticks. This gives co-op blackouts the same "will 6 AM come in time?" prayer as the original.

### 3.7 Station tools in detail

**West Office: Flashlight.** A wide beam down the West Hall from the office's left doorway. Hold `F` (or click and hold the flashlight button). It shows the West Hall Corner and the far end of the West Hall at once as a view in the office (the player sees through the open doorway into the hall). Holding costs 1 usage while on. It has a separate battery too: 100%, drains 4% per second while on, recharges 1% per second while off. If Foxy is in the first half of his sprint (sprint progress < 50%) when the flashlight lands on him, he stumbles back to the cove and resets to stage 1 (FNAF 2's flashlight-on-Foxy rule). If he's in the second half, the flashlight just reveals him (and you'd better close the door). It also blinds Bonnie for 3 seconds if he's in the West Hall Corner, adding 3 seconds to his next movement timer, once per approach.

**East Office: Kitchen Mic.** A toggle (`F` or button) that pipes the kitchen and restrooms audio into the player's headset at full volume, with stereo panning based on which side of the kitchen the sound is from. Costs 1 usage while on. While on, footsteps of any animatronic in `east_hall`, `kitchen`, `restrooms` or `east_corner` play louder and with a clear direction. It also lets the East guard hear Freddy's laugh clearly with a hint of position (the laugh reverb tells you which node he's in, each node has a different reverb preset). This tool turns the East guard into the team's listener, a FNAF 4 style role.

**South Office: Mask.** Press `M` to put on the mask. It takes 0.4 seconds to raise. While wearing it, you can't use the tablet, lights or doors (FNAF 2 rule). Some animatronics are "mask-able": if one enters the South Office while the South guard is wearing the mask, or if the guard puts it on within 1.5 seconds of the animatronic appearing in the office, the animatronic stands there for 3 to 6 seconds, then leaves back to `south_hall`, with lights flickering. If the guard isn't masked in time, jumpscare. In tribute mode Bonnie and Chica are mask-able, Freddy only on Nights 1 to 4, Foxy never (he charges). Wearing the mask has no power cost, but the guard can't do anything else. The mask's visual is the inside of a cheap Freddy head (or the original-mode bear's head): dark, with two eye holes, heavy breathing audio.

**Control Room: Maintenance Panel.** The Technician has a second screen (toggle with `Tab` or the panel button) showing a list of building systems with status lights:

| System | What fails | Effect when failed |
|---|---|---|
| Cameras | Camera network | All players' tablets show static only until rebooted |
| Audio Devices | Lure speakers | Technician can't play audio lures |
| Ventilation | Air flow | After 20 seconds failed, all players begin hallucinating (Part 3.8) |
| Door Controls (each station) | That station's doors | Doors jam in current position |
| Power Routing | Grid efficiency | Total drain increases by 25% until rebooted |

Systems fail on a random schedule that ramps by night (Part 5). Also, certain events (an animatronic in the vent hub, a phantom appearing) force a failure. Rebooting one system takes 5 seconds. "Reboot All" takes 12 seconds. During a reboot, the Technician's station can't do anything else, and their panel shows a progress bar with the classic "rebooting..." flavour.

The Technician also has: audio lures (pick any camera node on their map, press "Play Audio", and a child's laughter plays there for 2 seconds, which pulls one non-Freddy animatronic in an adjacent node toward it with 70% chance, 30-second cooldown, needs Audio Devices working); the music box (a dial that slowly unwinds from 100% at 1.5% per second on Nights 3 and later; the Technician holds `W` or a button to wind it at 8% per second; if it hits 0%, the Puppet threat activates, see Part 4.8); and power routing (the Technician can "boost" one station for 20 seconds, which halves that station's drain, 60-second cooldown; this is how a good Technician saves a struggling teammate).

The Control Room has no doors. Its only entrance is the vent from `vent_hub`. It has a vent shutter (`E` or button, costs 1 usage while closed) and a vent light (hold, costs 1 usage). An animatronic in the vent shows as a silhouette crawling in the vent light. Vents are slower: an animatronic in the vent takes 6 to 10 seconds to reach the vent opening, and the vent hub camera shows them entering.

### 3.8 Hallucinations (Ventilation failure)

When ventilation has been failed for 20 seconds, every living player starts hallucinating until it's rebooted. Hallucinations are visual only and never directly kill, but they cost attention and nerve. Every 6 to 14 seconds per player, roll one effect: a phantom animatronic face flashing in the office for 200 ms (a burnt, darker version of a roster character); the screen tinting red with a low heartbeat; a fake camera feed showing an animatronic at a camera where there isn't one (only on that player's client); the text "IT'S ME" flashing over the camera feed; or the office wobbling with chromatic aberration. Hallucinations are client-side cosmetic effects triggered by server events with a seed, so they're consistent in recordings but cheap to run. Add a setting to tone them down (Part 9.6, photosensitivity).

### 3.9 The radio (voice and text chat)

Communication is part of the game, so we build it in rather than relying on Discord.

Push-to-talk voice: hold `V` (rebindable) to transmit. Voice uses WebRTC peer-to-peer audio in a full mesh (four players max means at most six connections, fine for mesh). Signalling happens over the existing Socket.IO connection. Use public STUN (`stun:stun.l.google.com:19302`); TURN is optional and configured through env vars `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` if I add one later. If voice fails to connect, the game still works, and text chat remains.

The radio effect: run each incoming voice stream through a Web Audio chain (high-pass at 300 Hz, low-pass at 3,400 Hz, light waveshaper distortion, a burst of noise on key-down and key-up "squelch"). This makes it sound like a walkie-talkie and fits the setting. While power is out, the radio still works, but heavier static is mixed in.

Ghost voice: dead players can speak only to other dead players, unless the "Ghosts can talk to the living" lobby option is on (default off, because a dead player's commentary takes away the living's isolation, but casual groups will want it).

Text chat: press `Enter` to open a one-line chat input. Messages show for 6 seconds at the top left with the sender's name. Profanity filter on by default for display (a small built-in word list, toggle in settings). Messages capped at 120 characters and rate limited to 1 per second.

Quick commands: also add a radial "callout" wheel on `C` with eight preset callouts ("Left door!", "Right door!", "Check cams!", "Low power!", "Foxy's running!", "Freddy's moving!", "I'm fine", "Help!"). Each plays a short synthesised voice-like radio blip and shows text. Good for players without mics.

### 3.10 Ghosts (death and spectating)

When a player dies, they see their jumpscare, then 3 seconds of a static game over card with their station name, the time of death and the killer's name ("Bonnie got you at 3 AM"). Then they become a Ghost.

Ghosts see a monochrome blue-tinted camera tablet with every camera available at zero power cost, plus a "station view" mode that lets them watch any living player's office view (read-only, delayed by 1 second so it's useless for real-time cheating via screen share, though honestly it's co-op and cheating hurts nobody but the cheater). Ghosts can ping cameras. Ghosts can't press doors, lights or tools.

When the last guard dies, everyone sees a final shared shot of the building's show stage with all animatronics back in place, then the game over card.

### 3.11 Station takeover and disconnects

If a player disconnects mid-night, their station enters "autopilot" for up to 60 seconds: doors stay as they were, the tablet goes down, and the character is considered present but passive (vulnerable). If they reconnect within 60 seconds, they resume with full state. If not, the station is marked abandoned: its doors close and stay closed (the station is sealed), it stops drawing power, and animatronics heading there re-path. The player's guard counts as "survived" only if they reconnect before 6 AM. This avoids griefing by disconnect while being fair to people with bad Wi-Fi.

If the host disconnects, the lobby keeps running; the host role passes to the longest-connected remaining player. Lobbies are owned by the server, never by a client.

---

## PART 4: ANIMATRONIC AI SPEC

This is where the game gets its personality. Each animatronic is a small state machine that runs inside the simulation. Write a base class or shared helper for the common parts (AI level, movement timer, the 1-to-20 roll, pathing on the node graph) and a module per character for their quirks. All per-character numbers live in `shared/content/roster.ts` so they can be tuned without touching logic.

### 4.1 The shared movement model

Every animatronic has these fields:

```ts
interface AnimatronicState {
  id: AnimatronicId;          // 'freddy' | 'bonnie' | 'chica' | 'foxy' | 'golden' | 'puppet' | ...
  aiLevel: number;            // 0..20, can change during the night
  node: NodeId;               // current node
  subPos: 'room' | 'at_door' | 'in_office' | 'in_vent';
  targetStation: StationId | null; // which station it's currently hunting
  moveTimer: number;          // ticks until next movement opportunity
  stage: number;              // per-character progression (Foxy's cove stages, etc.)
  frozenTicks: number;        // can't take opportunities while > 0
  attackTimer: number | null; // counting down to a jumpscare once in an office
  lastSeenTick: Record<StationId, number>; // last tick each station's player watched this node
  flags: Record<string, boolean | number>; // per-character extras
}
```

On each tick, decrement `moveTimer`. When it hits zero, reset it to the character's interval (in ticks) and take a movement opportunity: if `frozenTicks > 0` skip; otherwise roll `rng.int(1, 20)` and if the roll is `<= aiLevel`, call the character's `onMove()`. That's the whole core, and it's faithful to FNAF 1.

Pathing: characters move one edge per successful opportunity along a weighted route toward their target. Each character has route preferences defined as data: a list of allowed nodes, and for each node a weighted list of next nodes. For example, Bonnie at `dining` might go to `west_hall` (weight 4), `arcade` (weight 3) or `backstage` (weight 1). Weighted randomness keeps them unpredictable but readable. Never let an animatronic move into a node already occupied by two others (max two per node, so camera pose spots don't collide), except offices.

Target station selection (co-op only): when a character leaves the stage, pick a target station among the living, non-sealed stations that its route data allows. Each character has a set of stations it can hunt (Part 4.2 onward). Weight the choice toward stations with fewer recent attacks and toward stations that haven't been visited for a while, so no one player gets all the action. Re-target if the target dies or seals.

Door approach: when a character reaches the node adjacent to its target station's door, its next successful opportunity moves it to `subPos = 'at_door'`. From `at_door`, its next successful opportunity attempts entry. If the door is closed, the attempt fails: the character gives up and retreats to a node two or three steps back along its route (FNAF 1 behaviour: Bonnie at a closed door eventually wanders back toward the dining area). If the door is open, it enters: `subPos = 'in_office'`.

In office: in FNAF 1, Bonnie and Chica inside your office disable your door and light on that side and wait until you lower the monitor, then attack. Replicate this. When a character enters an office, set `attackTimer`. If the player has the tablet up, the character waits; the moment the tablet goes down, play the jumpscare after a 0.2 second delay. If the player never raises the tablet, the attack happens after `IN_OFFICE_ATTACK_DELAY` (default 1.5 to 3 seconds random) anyway. There's a rule from the original worth keeping: if a player is looking at cameras for too long with an animatronic in their office, the animatronic forces the tablet down after 10 to 25 seconds and attacks. A subtle tell must exist: when a character slips into your office while your tablet is up, you hear a faint metallic groan (a "moan" sound) and the in-office breathing ambience starts. Sharp players will learn to hear it.

### 4.2 Freddy (the leader, the slow inevitability)

Role: patient, mostly invisible, deadly late. Hunts the East Office and the South Office in co-op (tribute geography: he takes the right-side route). In Classic mode he follows the FNAF 1 route exactly.

| Param | Value |
|---|---|
| Movement interval | 3.02 s |
| Co-op route | `stage` → `dining` → `restrooms` → `kitchen` → `east_hall` → `east_corner` → East Office; or `dining` → `party_a` → `party_b` → `south_hall` → South Office |
| Watched rule | Can't take movement opportunities while any living player is viewing his current camera |
| Active from | Night 3 in Night Shift (AI 0 on Nights 1 and 2), Night 3 in Classic per the AI table |
| Office rule | Can only enter while the target station's player has the tablet up and the door is open; he waits at the door otherwise |
| Light behaviour | Not visible in door lights. Players must use cameras on the corner node to see him; on camera he's often in darkness with only eyes glowing |
| Audio | Deep laugh when he successfully moves (any listener with the Kitchen Mic gets a positional version). Music box tune (a short, original, eerie melody) plays faintly when he's in `east_hall` or `south_hall` |

Freddy's design tension: you need to watch him to stop him moving, but watching costs power and attention. In co-op, one player babysitting Freddy is a legitimate strategy, and it's expensive. Good.

When his AI level is high (Night 5+), give him a "rush" flag: if he's on the stage at 4 AM or later and no one has looked at the stage camera for 30 seconds, he can take two edges per opportunity.

### 4.3 Bonnie (the fast, visible one)

Role: the most active early threat, teleport-happy. Hunts the West Office and the Control Room (vent) in co-op.

| Param | Value |
|---|---|
| Movement interval | 4.97 s |
| Co-op route | `stage` → `dining` or `backstage` → `west_hall` or `supply` or `arcade` → `west_corner` → West Office; or `arcade` → `vent_hub` → vent → Control Room |
| Skip rule | Can move up to two edges in one opportunity if the intermediate node isn't watched (FNAF 1 Bonnie is notorious for appearing out of nowhere) |
| Office rule | Standard in-office rule: disables that side's door and light buttons and waits for the tablet to go down |
| Visible in light | Yes, a tall purple-blue silhouette with long ears and white pupils filling the doorway |
| Audio | Footsteps (heavy, quick), a groan when entering the office, a guitar-string twang in the vent |
| Camera tell | In `backstage` he occasionally stares straight into the camera (a closer pose with eyes catching the light) |

### 4.4 Chica (the hungry one)

Role: noisy, slower to commit, East side. Hunts the East Office and the South Office.

| Param | Value |
|---|---|
| Movement interval | 4.98 s |
| Co-op route | `stage` → `dining` → `kitchen` or `restrooms` → `east_hall` → `east_corner` → East Office; or `dining` → `party_a` → `party_b` → `south_hall` → South Office |
| Kitchen rule | When in the kitchen she lingers: her next 1 to 3 successful opportunities are spent "eating" (she stays put) and pans clatter loudly. This gives the East guard warning time |
| Office rule | Standard in-office rule |
| Visible in light | Yes, a yellow silhouette with a bib, mouth open, cupcake on a plate in hand |
| Audio | Pots and pans in the kitchen, heavy footsteps, a wet mechanical breathing outside the door |

### 4.5 Foxy (the sprinter)

Role: punishes neglect. Only threatens the West Office in co-op (the cove's sprint lane runs down the West Hall). In Classic, the original left-door Foxy.

Foxy doesn't roam. He progresses through cove stages on successful opportunities:

| Stage | Cove camera shows |
|---|---|
| 0 | Curtains closed, star pattern |
| 1 | Curtains parted slightly, one eye visible |
| 2 | Head and hook out, leaning forward |
| 3 | Cove empty, "SORRY! OUT OF ORDER" sign. He's gone: sprint begins |

| Param | Value |
|---|---|
| Movement interval | 5.01 s |
| Watched rule | Whenever any living player views the cove camera, set `frozenTicks` to a random 0.83 to 16.67 seconds worth of ticks (the FNAF 1 range). But in co-op, also count total team watch time: if nobody has looked at the cove for 60+ seconds, his roll gets +3 (neglect bonus) |
| Sprint | At stage 3 he begins a sprint lasting 25 seconds if no one checks the West Hall camera; the moment anyone views `west_hall` (CAM 11) during the sprint, he becomes visibly running in the feed and his remaining sprint time drops to 1.5 seconds. Either way he arrives at the West Office door |
| Door closed | He bangs on the door three times (loud, metallic, synced to a short animation of the door shaking) and drains power: 1% on his first knock of the night, then 6%, 11%, 16% and so on (+5% each time). Then he resets to stage 0 or 1 at random |
| Door open | Instant jumpscare |
| Flashlight | West guard's flashlight in the first half of the sprint sends him back (Part 3.7) |
| Audio | Fast running footsteps down the hall (pan left), a humming sea shanty fragment (original melody) from the cove at stage 2 |

### 4.6 Golden Freddy (the myth)

Role: rare, unfair-looking but avoidable. Can appear at any station.

Mechanic: each time any player views the poster camera (in co-op, the poster is in `west_corner` CAM 13; in Classic, Cam 2B), roll a very small chance (`1/10,000` per view per player on Nights 1 to 5, `1/1,000` on Night 6+, `1/500` in Custom Night) for the poster to change to a Golden Freddy close-up. If it does, the next time that player lowers their tablet, a slumped golden bear sits in their office in the middle of the room. Whispers play. The player has 4 seconds to raise the tablet again, which makes him vanish. If they don't, he lifts his head, a full-screen crash-style jumpscare plays with a distorted scream, and then (this is the fun part) that player's client shows a fake "crash" screen for 2 seconds before revealing they're a Ghost. No real crash, obviously; we're not monsters.

Also: on any night, if Custom Night AI is set to 1/9/8/7 for Freddy/Bonnie/Chica/Foxy, Golden Freddy appears to the host immediately at the start of the night and kills them, exactly like the original's easter egg. The other players see a radio message "...it's me..." and continue.

Golden Freddy hallucination: while Golden is "armed" on a player (poster seen), that player's screen occasionally flashes "IT'S ME" for 100 ms.

### 4.7 Power-Out Freddy

Triggered by the power going out (Part 3.6). Sequence at a target station:

1. Darkness. The fan winds down. All ambient hum stops. Total silence for a beat.
2. After 3 to 8 seconds, two glowing eyes appear in that station's left or main doorway, and Freddy's face lights up in a flashing rhythm while the Toreador Song plays on a tinny music box (synthesised square/triangle wave with a slight wobble; see Part 11.7 for the note data and arrangement guidance). The song lasts up to 20 seconds; there's a 20% chance per 5 seconds that it ends early.
3. Darkness again. Then within 0 to 10 seconds (random, rolled in 2-second slices with 20% chance each), the jumpscare.
4. If 6 AM arrives at any point in this sequence, the player survives.

In co-op, after a station's player is caught, the sequence starts over at the next station after a 2 to 5 second pause.

### 4.8 The Puppet (Nights 3+ in Night Shift, tied to the music box)

Role: a team-wide threat the Technician must manage. In tribute mode it's "The Puppet", a tall, thin, black-and-white marionette with a white mask, rosy cheeks, purple tear streaks and long striped arms. It lives in the Prize Corner (`arcade`), inside a large gift box.

If the music box (Part 3.7) reaches 0%, a warning plays: a faster, tinny version of the music box melody ("Pop Goes the Weasel" is public domain and was what FNAF 2's box played; use our own synthesised arrangement of that public-domain tune) and a flashing alert on every HUD. The Puppet leaves the box and heads for the Control Room through the vent hub, at a fixed speed (8 seconds per edge, ignoring AI rolls). Doors and the vent shutter don't stop it. Only winding the box back above 50% before it reaches the Control Room sends it back. If it reaches the Control Room, it kills the Technician. Then it heads for the next station by shortest path and kills that guard too, and keeps going. While it's out, any player can wind the box from their tablet when viewing CAM 08 (Prize Corner), at half the speed the Technician winds. That's the team mechanic: the Technician is responsible, but if the Technician is dead or overwhelmed, others must step up, and stepping up costs tablet time and power.

If the Control Room station is sealed (fewer than 4 players), the music box is managed from the tablet by any player at full speed, and the Puppet hunts the nearest living station.

### 4.9 Optional extended roster (Custom Night and later nights)

These are original characters inspired by series archetypes (they are not copies of any official character), available as toggles in Custom Night and introduced on Night 6. Each has one simple counter rule, Ultimate Custom Night style. Implement them after the core four are solid. They make Custom Night genuinely replayable.

| Id | Name (tribute mode) | Name (original mode) | Rule |
|---|---|---|---|
| `bb` | Balloon Kid | Bobby Balloon | Appears in a random office's doorway at random and laughs; if he's there when a player turns on a light, he steals the light: all lights in that station stop working for 20 seconds. Counter: don't use lights while you hear him giggle |
| `mangle` | Tangle | Tangle | A broken, jumbled animatronic that crawls through the ceiling. Radio static increases as it nears a station. Counter: that station closes its door at the exact moment the static peaks |
| `phantom_foxy` | Phantom Fox | Ashen Fox | Hallucination-only unless ventilation is down; if vents are down, it can cause a real jumpscare that doesn't kill but disables that player's tablet for 10 seconds |
| `nightmare` | Nightmare | The Hollow | Only exists when a station has its door closed for 30+ seconds continuously: it starts breathing behind the door. Counter: open the door briefly. Punishes door camping |
| `spring` | Spring Rabbit | Rot Rabbit | A single slow hunter (FNAF 3 style) that ignores normal rules: only audio lures steer it, and it can be seen on cameras moving one node at a time. Counter: the Technician lures it away; doors only delay it for 10 seconds before it forces them |
| `shadow` | Shadow Bear | Shade | Appears on a random camera; if any player stares at it for more than 2 seconds, all cameras fail for everyone. Counter: look away fast |
| `toy` | Toy Bear | Shiny Bear | A newer-model mask-able bear that only goes for the South Office. Counter: the mask |
| `vent_crawler` | Vent Crawler | Gutterbot | Moves only through vents; it can enter any station through a hidden vent if the Technician hasn't sealed the vent hub in the last 30 seconds. Counter: Technician pulses the vent seal |

Each of these needs: a roster entry, original visual design notes (Part 6), sounds, a camera pose, a jumpscare, and a short "how to counter" line in the Custom Night info panel.

### 4.10 Showtime mode (player-controlled animatronics)

In Showtime, the animatronic player (the "Puppeteer") sees a top-down map (Part 2.3 layout) with the guards' stations marked, each animatronic's position, and their cooldown rings.

Controls: click an animatronic to select it, then click an adjacent node to move it there, or click its target station door to attempt entry. Each animatronic can only act when its cooldown ring is full; cooldowns equal its movement interval times `SHOWTIME_COOLDOWN_SCALE` (default 2.0, so Freddy every 6 s, Bonnie every 10 s and so on). All usual rules still apply: Freddy can't move while watched, Foxy's cove still freezes when watched, doors still block, the mask still works. The Puppeteer also gets two "abilities" with long cooldowns: Lights Out (cut the lights at one station for 10 seconds, 90 s cooldown) and Static (make one guard's tablet show static for 5 seconds, 60 s cooldown).

Fog of war: the Puppeteer sees only what the animatronics "see": each animatronic reveals the node it's in and adjacent nodes. The Puppeteer always knows each station's door state (closed doors appear as red bars) but not whether guards are on cameras unless an animatronic is adjacent to that station.

Uncontrolled AI: any animatronic not moved by the Puppeteer for 20 seconds starts moving on its own with AI level 5, so a Puppeteer can't just camp one character.

Win conditions are as listed in Part 2.2. Award the Puppeteer more Faz-Tokens per kill and the guards more for surviving.

---

## PART 5: NIGHTS, DIFFICULTY AND SCALING

### 5.1 Night Shift AI tables (co-op)

Starting AI levels per night. Values are for a four-player lobby; Part 5.6 explains scaling. These are deliberately close to FNAF 1, then pushed a bit harder because four people share the load.

| Night | Freddy | Bonnie | Chica | Foxy | Golden poster odds | Puppet active | Maintenance failures |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 1 | 1 | 0 | 1/10,000 | No | Rare (1 per night average) |
| 2 | 0 | 4 | 3 | 2 | 1/10,000 | No | 2 per night |
| 3 | 2 | 4 | 6 | 4 | 1/10,000 | Yes (slow unwind 1.0%/s) | 3 per night |
| 4 | 3 | 6 | 7 | 7 | 1/10,000 | Yes (1.3%/s) | 4 per night |
| 5 | 5 | 8 | 9 | 8 | 1/10,000 | Yes (1.5%/s) | 5 per night |
| 6 | 8 | 12 | 14 | 16 | 1/1,000 | Yes (1.8%/s) | 7 per night, plus two extended roster characters at AI 8 |
| 7 (Custom) | set | set | set | set | 1/500 | toggle | toggle |

Hourly increments: at 2 AM Bonnie +1; at 3 AM Bonnie, Chica, Foxy +1; at 4 AM Bonnie, Chica, Foxy +1; and in Night Shift only, at 5 AM Freddy +1 (a small extra to make the final hour sweat). Clamp everything to 20.

### 5.2 Classic Office AI table (solo, faithful)

Use the FNAF 1 table from Part 1.3 exactly, with the FNAF 1 hourly increments, FNAF 1 movement intervals, FNAF 1 power drain, FNAF 1 Foxy knock drain (1%, then +5% each), and Freddy, Bonnie, Chica and Foxy following their original routes on the Classic map. The goal is that a FNAF 1 veteran sits down at Classic Night 5 and their muscle memory works.

### 5.3 Maintenance failure scheduling

At night start, generate a failure schedule: N failure events (from the table above) placed at random times between 1 AM and 5:30 AM with a minimum 25-second gap. Each event picks a random system weighted Cameras 3, Ventilation 3, Audio 2, Door Controls 2 (split across occupied stations), Power Routing 1. Systems also fail on demand from events (Puppet out forces Audio; Bonnie in the vent hub forces Ventilation with 30% chance; any animatronic in `parts` forces Cameras with 10% chance per opportunity). If the Control Room is sealed, maintenance failures are disabled except Cameras, which then auto-reboot after 8 seconds.

### 5.4 Phone calls schedule

Night 1 to 5 calls play at 12 AM. Night 6 has no call, only a distorted garbled transmission at 12 AM (synthesised reversed speech-like noise). Calls are subtitled; if Web Speech synthesis is available in the browser, offer a "Voice" toggle that reads them with a low-pitch voice and a radio filter. Default to subtitles plus a muffled "talking" babble sound (synthesised formant-ish noise bursts) so the call feels voiced without a voice actor. Calls are skippable via the mute vote described in Part 2.5.

### 5.5 Custom Night presets

Custom Night lets the host set each character's AI 0 to 20 and toggle extended roster characters. Include these presets, each awarding a star and an exclusive cosmetic on first completion by the account:

| Preset | Settings | Reward |
|---|---|---|
| Golden Freddy (easter egg) | 1/9/8/7 | Instant death. Rewards the "It's Me" achievement and the "Golden Hour" office decor |
| Old Friends | 20/0/0/0 | Freddy only, at max. Reward: Top Hat guard skin |
| Pirate's Revenge | 0/0/0/20 | Foxy only. Reward: Eyepatch accessory |
| Ladies' Night | 0/0/20/0 + toggles off | Chica only. Reward: Cupcake desk prop |
| 4/20 | 4/20/20/20 | The classic. Reward: Gold Badge guard skin and the third star |
| 10/20 | All four core at 20 plus Puppet at 1.8%/s | Reward: Endo Mask flashlight skin |
| Everyone (UCN tribute) | Core four at 20, all extended roster at 10 | Reward: "Ultimate" title on profile, Glitch office theme |

### 5.6 Scaling by player count

Different lobby sizes must all feel good. The rules below are a starting point; run the balance script (Part 12.5) and adjust.

One player in Night Shift: only the West Office and the East Office merge into a "Solo Station" that has both doors, both lights and the Kitchen Mic and flashlight (like FNAF 1 with extras). The Technician's maintenance tasks are disabled (cameras auto-reboot), the music box is wound from the tablet, AI levels are multiplied by 0.75 and rounded. Honestly, for one player we steer people toward Classic Office in the UI ("Playing alone? Try Classic Office, the way it began").

Two players: West Office and East Office are used. South and Control are sealed. The Puppet is enabled from Night 3 but wound from the tablet. AI multiplier 0.85. Maintenance failures limited to Cameras (auto-reboot after 8 s).

Three players: West, East and Control are used (Control is preferred over South so the Technician role exists). South sealed. AI multiplier 0.95.

Four players: all stations, AI multiplier 1.0.

Also apply a co-op "catch-up" rule: when a player dies, the AI levels of characters targeting the remaining stations do not change, but their targeting re-weights to spread across survivors. Don't make dying make the game easier; that just rewards death. Don't make it harder either; one death already removes a pair of eyes.

### 5.7 Stars and progression

Each account has stars, shown on the title screen like the original: one star for beating Night 5, two for Night 6, three for 4/20 in Custom Night. Plus a fourth hidden "golden star" for beating every Custom Night preset. Stars appear next to the player's name in lobbies, which is a nice flex.

Each account tracks the highest night beaten per mode. Night Shift and Classic have separate progress.

---

## PART 6: CHARACTERS, VISUAL DESIGN AND THE ROSTER FILE

All characters are built procedurally in Three.js from primitives (spheres, capsules, cylinders, boxes, tori, lathe geometry) with custom materials, in `client/src/render/characters/`. No external models. This is very doable: FNAF animatronics are chunky, rounded, plush-meets-machine designs, which suit primitive modelling, and our CRT/grain post-processing hides the low poly count. Each character is a function `buildFreddy(skin: CharacterSkin): THREE.Group` returning a rigged-ish hierarchy (head, jaw, torso, arms, hands, legs, ears, eyes) so poses and jumpscare animations can rotate parts.

### 6.1 The look that makes animatronics creepy

Uncanny comes from a few specific things, so get these right. Eyes: glossy spheres with a small, bright pupil (an emissive disc), slightly too far apart, catching light. In darkness, show only the pupils as tiny glowing points; that's terrifying on a camera feed. Jaw: a separate lower jaw that hinges open, revealing two rows of flat, slightly dirty white teeth (small boxes) and a dark mouth interior where you can just see the metal endoskeleton teeth behind. Fur: a matte, slightly fuzzy material (use a noise-based normal map generated in a shader or a canvas texture, plus a subtle rim light to suggest fluff). Wear and tear: dirt and grime overlays (a canvas-generated noise texture multiplied in), some stains near the mouth, scuffs on the hands. Joints: show glimpses of the endoskeleton at wrists and ankles (dark grey metal cylinders). Posture: slightly slumped, head tilted, arms hanging. Never perfectly symmetrical; give each a small random tilt.

Lighting is everything. Characters on camera are lit by a single harsh light from above or from the camera's direction (like a cheap IR camera), with deep shadows. In the doorway light, they're lit from the side by the office's door light, so half the face is in shadow.

### 6.2 Core roster visual specs (tribute mode)

Freddy: a big, round brown bear, about 2.0 m tall. Light tan muzzle and belly patch. Small black top hat and black bow tie. Holds a microphone (a thin black cylinder with a sphere on top) in his right hand. Round ears with darker inner circles. Blue eyes (pupils white-blue glow). Big, wide-set build. In darkness only his eyes show.

Bonnie: a tall, lean rabbit, about 2.1 m with ears. Purple-blue fur (#5B5FB8 range), lighter lavender muzzle and belly. Red bow tie. Long upright ears with pink inner faces, slightly bent. Red-magenta irises with white pupils. Carries a red electric guitar (simple extruded body and neck). Long thin limbs.

Chica: a yellow chicken, about 1.9 m. Orange beak with a hinged lower half, purple-pink irises. White bib that says "LET'S EAT!!!" in a chunky font (render the text into a canvas texture). Holds a pink cupcake on a plate with a single candle and two googly eyes on the cupcake. Wide hips, small wing-arms. Three small tufts on top of the head.

Foxy: a red fox pirate, about 1.95 m. Dull red fur, tattered and ripped with exposed endoskeleton showing through his legs and one arm. An eyepatch flipped up over his right eye. A silver hook on his right hand. Long snout with a hinged jaw full of sharp teeth, more menacing than the others. Yellow eyes. Torn brown pants.

Golden Freddy: Freddy's shape, but slumped on the floor, empty black eye sockets with tiny white pinpoint pupils, faded gold-yellow fur, dusty, with wires hanging from the eye sockets. Purple bow tie and hat. In his jumpscare his head fills the screen with jaw open wide.

The Puppet: very tall (2.4 m), thin, black body with white stripes on wrists and ankles, three white buttons down the chest, long thin arms and fingers. A white, smooth mask face with black hollow eyes containing white pupils, red cheek circles, a smiling red mouth, and purple lines running down from the eyes. Emerges from a large striped gift box with a bow.

### 6.3 Original-mode roster (the fallback cast)

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

### 6.4 Guard characters (the player avatars)

Players mostly see through their own eyes, but their guard appears in several places: the lobby (a 3D portrait on a turntable), the death "stuffed in a suit" game over card, the paycheck screen, the profile page, and, in Showtime, as figures in the Puppeteer's top-down view. Guards also appear as hands in first person: when you press a door button, a gloved hand reaches out; when you raise the tablet, two hands hold it. Hands and sleeves show the guard's skin colours. This is what makes skins feel worth having even in a first-person game.

The guard model is a simple stylised human: a capsule body, a sphere head, cylinder limbs, with a security cap, a badge, a uniform shirt, trousers and shoes. Built procedurally from a `GuardSkin` descriptor (Part 8.4). Keep the style slightly toy-like and low-poly so it matches the animatronics.

### 6.5 Jumpscare animation spec

Each jumpscare is an 0.8 to 1.2 second animation played on the killed player's screen only:

1. Frame 0: the screen cuts instantly from whatever the player was looking at to a close-up camera on the animatronic at about 1.2 m away, already lunging.
2. 0 to 0.25 s: the animatronic's head rushes toward the camera (scale/position tween with an ease-out), jaw opening to max. The camera shakes violently (random offsets of 2 to 6 pixels equivalent, 60 Hz).
3. 0.25 to 0.8 s: head fills the frame, jaw snapping slightly, eyes rolling, body jittering. Heavy chromatic aberration and a red-white flash on the first 3 frames.
4. Audio: the scream sound (Part 11.7) starts on frame 0 at full volume (respecting the jumpscare volume setting).
5. Cut to static for 0.5 s, then the game over card.

Foxy's jumpscare comes from the left doorway with a running lunge; Golden Freddy's is a single still, full-screen, with the scream distorted and a faked crash; the Puppet's is a slow rise into frame followed by a sudden snap. Power-Out Freddy's is a forward lunge from total darkness.

Provide a "Reduced jumpscare intensity" option (Part 9.6) that removes the flash and screen shake and caps the scream volume.

### 6.6 The roster file

`shared/content/roster.ts` exports a typed object. Each entry includes: id, slot, `names: { tribute, original }`, movement interval, route graph per map, hunted stations, flags (can be masked, is visible in light, frozen when watched), audio cue ids, camera pose specs per node, jumpscare id, Custom Night description and counter tip. Write it once and read from it everywhere: simulation, renderer, UI, tests.

---

## PART 7: WRITING (PHONE CALLS, NEWSPAPERS, FLAVOUR)

All text below is original. Use it as written or polish it in the same voice. The phone caller is "the Day Manager", a friendly, slightly awkward guy recording messages for the new night shift. Don't name him. In the original-mode roster, the venue and character names swap through the roster lookups, so write the call texts as templates with placeholders `{venue}`, `{company}`, `{leader}`, `{rabbit}`, `{bird}`, `{fox}`, `{puppet}`.

### 7.1 Night 1 call

"Hey! Hello, hi. Okay, is this thing recording? Yeah. Okay. Welcome to the night shift at {venue}, Location Seven! I'm the day manager, and I've been asked to leave you all a few, uh, orientation notes. Since there's four of you this year. Which is new. Corporate's never staffed four guards before. Don't read into that.

So. You've each got a station. Doors, lights, a camera tablet. The building's on one power supply, a shared one, so, uh, be polite with it. If one of you leaves your camera up all night, the rest of you are going to be sitting in the dark around five, and nobody wants that. Especially you. Trust me.

Now, the characters. {leader}, {rabbit}, {bird}, and our pirate pal {fox} back in the cove. They're, uh, they're on a free-roam mode at night. Something about the servos locking up if they stand still too long. They wander. It's fine. Mostly.

There is, um. There's a thing I'm required to read. 'By accepting this position, staff acknowledge that {company} carries no liability for any injury, disappearance, or, uh, reassignment that occurs after closing. Incident paperwork will be processed once the affected area has been fully sanitised and refurnished.' Refurnished. Okay. Lawyers, right?

Here's the honest version. The characters don't really get people at night. Their facial recognition wasn't built for that. They might see one of you and think you're a bare endoskeleton without a costume on, and that's against the rules here, so they'll try to, uh, help you into one. And the costumes are full of crossbeams and wiring. So. That would be uncomfortable. Briefly.

So close your door if one of them is standing at it. Use the lights to check. Use the cameras, but take turns, okay? Talk to each other. That's literally the whole job. Talk, look, close doors, and don't waste power.

Alright. Good luck, you four. I'll check in tomorrow. Probably."

### 7.2 Night 2 call

"Hey, hello! You all made it to night two! Great. I mean that. Last year's guy didn't, uh. Never mind.

So, things get a little busier from here. {rabbit} and {bird} get, let's say, more curious. They'll come right up to your doors. The window lights are your best friend. If you flip a light on and someone's standing there, shut the door, wait, and they'll lose interest eventually.

One more thing. If one of them gets inside your office, and you notice your buttons don't respond, that's, uh. That's bad. Don't pull your tablet up. Actually, it doesn't matter what you do at that point. Just know that the rest of the team still has a shot, so, keep talking to them. Even if you're, you know. Spiritually.

Oh! And {fox}. The pirate. He doesn't like being watched, but he also doesn't like being ignored. Check the cove every so often. If he's gone, the West station needs to slam that door fast, because he sprints. Like, sprints. You'll hear it.

Also, the West station has a flashlight now. Corporate sent one after the, um, incident. If you catch him early in the hall with it, he gets embarrassed and goes back. That's my professional theory.

Okay. Talk soon!"

### 7.3 Night 3 call

"Hello, hey, night three, look at you four! You're practically veterans. I'm proud, genuinely. I've got a feeling you're the team that makes it.

So starting tonight, the Technician, Control Room, you've got a music box to wind. There's a, uh, a prize-corner attraction. Sits in a box. It's been here longer than me. It doesn't do much as long as the music keeps playing, so just keep it wound. If it stops, um. Wind it faster, I guess. And everybody else, you can wind it from the Prize Corner camera if you have to, but it's slower from your end.

The building also has some, let's call them, maintenance quirks. Cameras drop out, the vents act up, the door controls stick. Technician, you've got the panel. Reboot what breaks. If the vents go down for too long, people start seeing things. Don't panic about the things you see. Panic about the things that are actually there. Ha. Sorry.

And, uh. {leader}. He's going to start moving now. He likes the dark. He doesn't move when you're watching him, which is great, but watching costs power, which is not great. Work it out between you.

Oh, and if anybody sees a gold bear somewhere he shouldn't be, just, put your tablet up. Don't ask why. I don't know why. Okay, bye!"

### 7.4 Night 4 call

"Uh, hello? Hey. Hi. Listen, if you're hearing this and you're all at your stations, great, I had a feeling you'd make it. Um.

I'm, uh, I might not be around to record these much longer. It's been a rough night here. I'm recording this from the back, I think something's been banging on the door for a while. Yeah. I don't know if it's {leader} or the pirate. I keep hearing a little song.

So I want to make sure you four know the important stuff. Stay together. I mean, you can't, physically, but on the radio. When one of you goes quiet, the others have to cover. Share the power. Technician, use the routing boost, it's there for a reason. South station, the mask works on some of them. Not all of them. Not the fox.

If I don't record tomorrow's message, um, there's a key taped under the Backstage workbench. It opens the parts locker. I never got around to looking in there. Somebody should. I'm going to sit tight and hope the banging stops on its own.

[a long pause, then distant banging]

Oh, no...

[a music box melody, a groan, then a horrific screech and the line cuts to static]"

Implementation note: the banging, the music box, the groan and the screech in this call are synthesised sound events, scripted at timestamps inside the call, not spoken text. Subtitles show "[banging]", "[music box]", "[screech]".

### 7.5 Night 5 call

No manager. Instead, at 12 AM: a long static hiss, then a garbled, pitched-down, reversed-sounding transmission for 25 seconds (synthesised: random formant bursts, reverse-envelope noise, a low drone). The subtitles show nonsense characters that occasionally resolve into fragments: "...it's me...", "...five...", "...save them...", "...he's still here...". Players who datamine the subtitle file find a hidden ciphered message (a simple Caesar shift of 7) that decodes to "THEY WERE NEVER FOUND. LOOK BEHIND THE STAGE." That's a pointer to an easter egg in Part 9.4.

### 7.6 Night 6 and Custom Night

Night 6: no call. Just silence, and the fan.

Custom Night: no call. A short note on the start screen in the manager's voice: "Hey! This one's off the books. Corporate doesn't know about it, so if anybody asks, you were never here."

### 7.7 Newspaper clippings

Newspaper clippings appear as posters on the walls of the West Hall, East Hall and the Party Rooms, visible on camera. Each night, rarely, a clipping changes. They're rendered as canvas textures with a yellowed paper look, a blackletter-ish masthead (use a free Google font like "UnifrakturMaguntia" for the masthead and "Special Elite" or "Courier Prime" for body text), headline, and two short paragraphs of text that's fully readable if the player zooms the tablet in (add a zoom-on-click feature for posters).

Write these six clippings for tribute mode (original mode swaps names):

1. "LOCAL PIZZERIA REOPENS UNDER NEW MANAGEMENT." {venue} reopens its doors after two years closed, with a brand-new show stage and four 'state-of-the-art' characters. A spokesperson for {company} says the restaurant 'has put the past behind it.' Night security staffing has been increased to four for the first time in the chain's history.
2. "PARENTS RAISE CONCERNS OVER ANIMATRONIC HYGIENE." Several parents report a foul odour and 'something like mucus' around the characters' eyes and mouths. Health inspectors visited but found no violations. The company says the costumes are 'cleaned weekly.'
3. "NIGHT GUARD MISSING AFTER SHIFT." A security worker employed at {venue} failed to return home after a night shift last Tuesday. Police found the guard's car still in the parking lot. The company declined to comment beyond noting that the guard 'had been briefed on all safety procedures.'
4. "FIVE CHILDREN, ONE BIRTHDAY, NO ANSWERS." Twenty years later, the case remains unsolved. A man in a uniform was seen leading the children to a back room. The suspect was charged, but the children were never found. A memorial plaque has been quietly removed from the location's entrance.
5. "{company} ANNOUNCES 'SAFE NIGHTS' PROGRAMME." Following an internal review, the company will install additional doors, a shared power system and a 'maintenance panel' at all locations. 'We take the safety of our staff seriously,' a statement reads.
6. "LOCATION SEVEN TO CLOSE BY YEAR'S END." Citing 'low attendance and maintenance costs,' the company confirms Location Seven will close. The characters will be 'retired' and placed in storage. The rare golden bear costume, long rumoured to exist, has not been located.

Clipping 1 shows on Night 1, clippings 2 and 3 can appear from Night 2, clipping 4 is rare (5% per night per poster), 5 appears from Night 3, and 6 only on Night 6.

### 7.8 UI copy voice

All menus are short, punchy, a little ominous, a little funny. Examples to set the voice:

Main menu: "Clock In" (play), "Locker Room" (skins), "Personnel File" (profile and stats), "Notice Board" (settings), "Archives" (unlocked extras), "Leave" (log out).

Lobby: "Waiting for staff...", "Pick your station", "Room code: ABCD (tell your crew)", "Ready" / "Not ready", "Start shift" (host only).

Death card: "{guard} was found stuffed in a {leader} suit. Time of death: 3 AM. Cause: {killer}."

6 AM screen: "6 AM" big, then "Shift complete. {n} of {m} guards clocked out."

Paycheck: "Pay stub: {tokens} Faz-Tokens. Overtime: none. Hazard pay: denied."

Error copy: "Lost signal. Reconnecting to the building..." for network drops. "That room's full. Max four guards per shift." for full lobbies. "Couldn't find that room. Check the code?" for bad codes.

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

Rate limits (in-memory per IP and per account, since we run one instance): login 10 attempts per 15 minutes per IP and 5 per 15 minutes per username; sign-up 5 per hour per IP; chat as in Part 3.9; lobby create 10 per 10 minutes per user. Return 429 with a friendly message.

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
  showtime_wins_as_puppeteer integer not null default 0,
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
  station text not null,
  survived boolean not null,
  killed_by text,
  death_hour integer,
  tokens_earned integer not null,
  primary key (match_id, station)
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
| Flashlight | `flashlight` | Beam colour tint (subtle), flashlight model | West station flashlight, menu icon |
| Tablet | `tablet` | Tablet frame colour, stickers, camera UI theme (green, amber, blue, glitch) | Your camera tablet overlay |
| Office Decor | `office` | Desk props (fan model, plush, cupcake, drawings on the wall, poster set) | Your station's office view (other players see it only in Ghost station view) |
| Badge | `badge` | Badge emblem next to your name | Lobby list, chat, profile |
| Title | `title` | Text under your name ("Night Owl", "Pizza Purist", "Ultimate") | Lobby list, profile |
| Animatronic Skin | `animatronic.<id>` | Alternate look for one animatronic, used only when you're the Puppeteer in Showtime, and as a cosmetic in your Classic mode games | Showtime, your solo games |

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
| Classic Office night survived | 30 + 15 × night number |
| Custom Night win | 100 + sum of AI levels / 2 |
| Showtime: guard survives | 80 |
| Showtime: Puppeteer kill | 30 per kill, +100 for a full wipe |
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

## PART 9: META FEATURES, SECRETS AND SETTINGS

### 9.1 Title screen

The title screen should feel like FNAF: black background, a dimly lit close-up of the four core animatronics (rendered live in 3D from our models, very slowly drifting camera, occasional twitch of a head or a flash of eyes), heavy static and scanlines, flicker every few seconds, the game title in a chunky, slightly distorted typeface, and a low ambient drone with a faint music-box loop. Menu options in the bottom-left in a typewriter-style font. Stars shown under the title. The disclaimer from Part 0.3 at the bottom in small text. Very rarely (1 in 20 loads), one of the animatronics in the title shot is replaced with a glitched or endoskeleton version for a single frame.

### 9.2 Achievements

At least 30, each with an id, name, description, icon (procedural SVG), and an optional cosmetic reward. A sampling to implement:

| Id | Name | Condition |
|---|---|---|
| `first_shift` | First Shift | Survive Night 1 in any mode |
| `night5` | Employee of the Week | Beat Night 5 in Night Shift |
| `classic5` | Old School | Beat Night 5 in Classic Office |
| `night6` | Overtime | Beat Night 6 |
| `four_twenty` | Twenty Twenty Twenty | Beat the 4/20 preset |
| `its_me` | It's Me | Get caught by Golden Freddy |
| `no_doors` | Open Door Policy | Survive a night without closing a door |
| `no_cams` | Blind Faith | Survive a night without raising the tablet |
| `last_one_standing` | Last Guard Standing | Be the only survivor at 6 AM in a 4-player lobby |
| `full_team` | Nobody Left Behind | All four guards survive Night 5 |
| `zero_power` | Running On Fumes | Survive with exactly 0% power at 6 AM (the blackout clutch) |
| `toreador` | Saved By The Bell | Survive the power-out Freddy sequence by reaching 6 AM |
| `fox_bounce` | Not Today, Captain | Send Foxy back with the flashlight 3 times in one night |
| `mask_master` | Fooled You | Fool 5 animatronics with the mask in one night |
| `technician` | Duct Tape Hero | Reboot 10 systems in one night |
| `lullaby` | Lullaby | Never let the music box drop below 25% on Night 5 |
| `ghost_help` | Ghost Whisperer | As a Ghost, ping an animatronic within 5 seconds before a teammate closes the door on it |
| `puppeteer` | Showtime! | Win as the Puppeteer |
| `wipe` | Full House | Wipe four guards as the Puppeteer |
| `honk` | Honk | Boop the nose on the poster in your office |
| `collector` | Collector | Own 25 cosmetics |
| `fashion` | Dressed To Kill | Change your skin 10 times |
| `newspaper` | Investigative Reporter | Zoom into all six newspaper clippings |
| `cipher` | Code Breaker | Find the hidden backstage secret (Part 9.4) |
| `minigame_all` | Save Them | Complete all three Atari minigames (Part 9.3) |
| `spectator` | Front Row Seat | Spend 5 minutes as a Ghost in a single night |
| `hundred` | Lifer | Play 100 nights |
| `bonnie_x10` | Bunny Trouble | Get caught by Bonnie 10 times |
| `speedrun` | Clock Watcher | Play a night where your team's total tablet time is under 60 seconds and win |
| `golden_star` | Golden Star | Beat every Custom Night preset |

Achievement toasts slide in from the top right with a small chime (synthesised) during menus and the paycheck screen; during a night they're queued and shown only at the end so nothing breaks the dread.

### 9.3 Atari-style death minigames

FNAF 2 introduced 8-bit "death minigames" that briefly play after some deaths and hint at the lore. We'll do three original ones in the same spirit, rendered on an HTML canvas at 160×120, scaled up with nearest-neighbour filtering, with a limited 16-colour palette and chiptune-style synthesised blips.

They trigger randomly (15% chance) on a player's death screen, before the game over card, only for the player who died. Each lasts under 30 seconds and the player can move a tiny sprite with arrow keys.

1. "Give Cake" style, renamed "Party Time": you're a pixel {leader} delivering cake to six kids at tables; kids turn from red to green when they get cake; outside the window, a grey child cries; a purple car pulls up. You can never reach the grey child. The screen cuts out with a jumpscare face of a pixel Puppet. Don't copy FNAF 2's exact layout; make your own room layout and sprites.
2. "Follow Me": you're a pixel {rabbit}; a purple figure beckons you through rooms; at the end, five dismantled pixel animatronics lie on the floor; the figure turns and the screen flashes. Original layout and art.
3. "Lights On": you're a small pixel child in a dark building with a flashlight cone; you need to find five glowing party hats; each one you find plays a soft tone; when you find the fifth, a golden pixel bear appears behind you. Completing it unlocks the `minigame_all` progress and the "Kid Drawings" office decor.

Each minigame, once seen, becomes replayable in the Archives.

### 9.4 Easter eggs and secrets

Implement all of these. They're the kind of thing that makes a community form.

The nose honk: the {leader} poster in every office has a clickable nose. Clicking plays a squeaky honk sound (synthesised: a short pitch-swept square wave). Pointless and beloved.

Golden Freddy poster: as specified in Part 4.6.

Shadow Bonnie: a 1/5,000 chance per camera view that `party_b` shows a dark, featureless silhouette of {rabbit} with glowing white eyes and teeth. If a player stares at it for 3 seconds, their screen glitches and they're sent to a 5-second "glitch dimension" (a quick fullscreen effect of distorted rooms) before returning, unharmed.

The backstage secret (from the Night 5 cipher): if a player views the Backstage camera at exactly 3 AM in-game on Night 5 and clicks the parts locker in the frame five times, the feed cuts to a secret still image: five party hats hanging on hooks inside the locker, a child's drawing of five figures, and the word "FOUND" in crayon. Unlocks the `cipher` achievement and the "Retro 1987" guard uniform (if they also beat the night).

The "1987" combo: typing 1, 9, 8, 7 on the keyboard while on the title screen plays a music box sting and flashes Golden Freddy's face for one frame, then nothing else happens. Leaves people wondering.

Konami code on the title screen: switches the title animatronics to tiny bobbleheads for the session. Harmless fun.

The phone on Night 4: if any player clicks the phone receiver in their office during the last 5 seconds of the Night 4 call, they hear an extra 3 seconds of audio: a faint, slowed child's laughter. No reward, just mystery.

Rare kitchen sound: 1 in 50 nights, the kitchen audio during the 4 AM hour plays a faint, slowed-down rendition of the music box melody.

Hallway posters: in West Hall, the "Celebrate!" style poster of the band rarely (1%) shows the characters with their eyes missing and black voids instead.

### 9.5 Archives

Unlockable extras screen: character gallery (each unlocked roster character on a turntable with their name, description and counter tip; unlocked when you first see them in a night), newspaper archive (each clipping you've zoomed), minigame replays, phone call replays (with subtitles), the soundtrack (play any ambient or sting you've heard), and the "Extras" credits screen.

### 9.6 Settings (Notice Board)

Persist settings on the account (and in localStorage for guests).

Audio: master volume, ambience volume, effects volume, jumpscare volume (separate, so people can cap it), voice chat volume, microphone device selection, push-to-talk key, voice activity option (off by default), mute all voice.

Video: render scale (50%, 75%, 100%), CRT effect intensity (0 to 100%), film grain intensity, scanlines on/off, vignette on/off, frame rate cap (30, 60, unlimited), field of view for office pan (narrow/normal/wide), brightness (gamma), colourblind-friendly door/light indicators (adds shapes and labels to the coloured button lights).

Accessibility: reduced jumpscare intensity (no flash, no shake, scream capped at 50%), photosensitivity mode (disables all flashes, strobes and rapid flicker, including hallucinations and the power-out face flashing; also replaces the Toreador flashing face with a steady glow), subtitles on/off and size, visual sound cues (show small directional icons on screen for important sounds such as footsteps, door knocks, kitchen noises, laughs, so deaf and hard-of-hearing players can play; show them only for sounds the player would actually hear in their station), hold-to-toggle options for lights and door holding, camera key navigation, and "Hide gore" (it's FNAF, there's no real gore, but this disables the death card's "stuffed in a suit" image text and replaces it with a neutral "You were caught" card).

Controls: full key rebinding for every action (Part 11.5) with conflict detection and a "reset to defaults" button.

Gameplay: toggle lights vs hold lights, show hour progress bar (off by default for purists, on adds a thin progress line under the clock), chat profanity filter.

Add a first-launch warning screen before the title: "This game contains flashing lights, loud noises and jump scares. Photosensitivity mode and reduced jump scares are available in Settings." with buttons "Continue" and "Open accessibility settings".

---

## PART 6B: THE COMPLETE SERIES ROSTER ("EVERY CHARACTER")

The owner wants every character from the series in this game, endoskeletons and electrical guts included. That's the right call: half the joy of FNAF is the size of the cast. Here's how we make it work without the game turning into mush.

The core four plus Golden Freddy and the Puppet drive Nights 1 to 5 (Parts 4 and 5). Everybody else lives in three places: the extended threats on Night 6 and Custom Night (each with one clear counter rule, Ultimate Custom Night style), the Archives gallery (every character modelled, posed and animated on a turntable with an x-ray "endoskeleton view" toggle), and Showtime (the Puppeteer can unlock and field extra characters). Every one of them is built procedurally from primitives, every one has a full jumpscare, and every one has an endoskeleton underneath that you can see through tears, at joints, and in the x-ray view.

Names: in `ROSTER_MODE=tribute` these use the classic names. In `ROSTER_MODE=original` every character gets an original name generated from the slot (for example "Ballerina Unit", "Clown Unit") and a recoloured design. Write both names into the roster for each entry. Same IP rules as always: original geometry, original sounds, no ripped assets.

Build them in waves (Part 12 tells you when). If time runs short, ship waves 1 to 3 and leave the rest flagged `comingSoon` in the Archives with a silhouette, but plan the data for all of them from day one.

### 6B.1 Shared anatomy: the endoskeleton

Every animatronic is a costume over a metal endoskeleton, and the owner specifically wants the electrical side visible. Build one parametric endoskeleton generator in `client/src/render/characters/endo.ts` and reuse it everywhere.

The endoskeleton: a dark gunmetal frame (metalness 0.9, roughness 0.35, with a procedural scratch and grime texture). Skull: a rounded box cranium with a visible jaw hinge, two hydraulic pistons on each side of the jaw, exposed metal teeth (two rows of small boxes), and spherical eyeballs on stalks with an emissive iris. Spine: a stack of short cylinders with disc spacers. Ribcage: thin curved bars (a TubeGeometry along arcs). Shoulders, elbows, wrists, hips, knees and ankles: ball joints (spheres) with servo housings (small boxes with a cylinder motor and a screw head detail). Hands: four jointed fingers made of three cylinders each, with knuckle spheres. Feet: flat plates with toe segments.

The electrical layer is what sells it. Run wiring bundles along the spine and limbs: 3 to 8 thin TubeGeometry wires per bundle, following a CatmullRomCurve3 that sags slightly between joints, each wire coloured from a palette of red, black, yellow, blue and green insulation, with occasional cable ties (tiny tori). Add circuit boards on the back of the skull and in the chest cavity (thin green boxes with a canvas-generated circuit texture: traces, solder pads, a few chip rectangles). Add a small battery pack in the torso with a blinking status LED. Exposed wires at tears end in frayed copper strands (a few very thin bright copper lines splaying out).

Sparks: when a damaged character moves or twitches, emit a burst of 8 to 30 spark particles from a frayed wire end: bright yellow-white points with additive blending, short motion-blur streaks (stretch the sprite along velocity), gravity, a 0.2 to 0.6 second lifetime, and a matching tiny point light that flashes for 80 ms and lights the surrounding geometry. Pair with a crackling electrical sound (Part 11.7). Withered, Phantom, Scrap and broken characters spark often; newer "Toy" characters never spark.

Costume over endo: costumes are separate shells. Torn areas are cut-outs (use alpha-tested textures generated on canvas, or simply omit segments of geometry) through which the endo shows. Each character spec lists its damage map.

X-ray view (Archives only): toggle that renders the costume at 15% opacity with a Fresnel blue rim, and the endoskeleton and wiring at full brightness with emissive pulses running down the wires like current. This is a showcase feature, so make it look great.

Bare endoskeletons as characters: "Endo-01" (the plain endoskeleton from Backstage) is a roaming threat in Custom Night: it moves only when the power usage is at 4 or more bars ("drawn to the current"). Counter: keep usage low. It's also a rare backstage camera event in normal nights: one of the spare endos on the Backstage table turns its head to the camera.

### 6B.2 Wave 1: the original crew (FNAF 1)

Already specced in Part 6.2: Freddy, Bonnie, Chica, Foxy, Golden Freddy. Add their endoskeleton details: Foxy has the most exposed endo (shins, one forearm, part of the jaw); Golden Freddy has wires hanging from the eye sockets and his torso is partly hollow, with dangling cables visible through a tear in the chest. Freddy has a single loose wire at the left wrist. Bonnie and Chica are intact in wave 1 (their Withered versions in wave 2 are wrecked).

### 6B.3 Wave 2: FNAF 2 cast

Toy Freddy: a shiny, plastic-looking, chubby version of Freddy with rosy cheeks (pink discs), bright blue eyes, a glossy clearcoat material (clearcoat 1.0 in MeshPhysicalMaterial), black hat and bow tie, microphone. Never sparks. Custom rule: "Toy Freddy watches cameras with you." He sits at the South Office door; if the South guard keeps the tablet up for more than 6 seconds straight while he's at the door, he enters. Counter: short camera glances. Mask-able.

Toy Bonnie: pale sky-blue, glossy rabbit with green eyes, long eyelashes, red bow tie, a light blue guitar, pink cheeks. Comes through the Control Room vent. Counter: mask (if Technician) or vent shutter.

Toy Chica: yellow, glossy, pink cheeks, a bib reading "LET'S PARTY!!!", detachable beak (she loses her beak and gets black eye sockets with white pupils when hunting). Holds a cupcake. Counter: mask or door.

Mangle: the dismantled "Toy Foxy": a white and pink tangle of parts, a second endo head attached to its side, exposed wiring everywhere, a lipstick-red mouth, one eye on a bare endo socket. Crawls on the ceiling. Emits radio static that rises as it approaches. Lots of sparks. Counter: close the door when the static peaks (Part 4.9's Tangle, now with tribute name).

Balloon Boy (BB): a small human-like animatronic boy with a striped red-and-blue shirt and propeller cap, holding a balloon and a "BALLOONS!" sign. Giggles, says "Hello" (synthesised chirp-voice), and steals the lights (Part 4.9).

Jay-Jay: Balloon Boy's sister counterpart, purple. Rare variant of BB. Same rule.

Withered Freddy, Withered Bonnie, Withered Chica, Withered Foxy, Withered Golden Freddy: the FNAF 1 crew, decayed. Faded fur, torn costumes showing lots of endo and wiring, broken jaws. Withered Bonnie has no face at all: just a bare endo jaw and two glowing eyes in a void, with wires hanging from where his face was. Withered Chica's jaw hangs open, wrists are bare endo. Withered Foxy's fur is in tatters. All spark constantly. Custom rules: Withered Freddy, Bonnie and Chica are mask-able but come through any door; Withered Foxy is countered by flashlight only (any station gets a weak flashlight while he's active); Withered Golden Freddy appears randomly in an office and must be met with the tablet up.

The Puppet: specced in Part 6.2 and Part 4.8.

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

## PART 10: TECHNICAL ARCHITECTURE

### 10.1 Stack (decided, don't relitigate)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 5.x, strict | One language across client, server and shared sim |
| Package manager | npm workspaces | Railway's Nixpacks/Railpack handles npm cleanly, no extra setup |
| Client bundler | Vite 5 | Fast dev server, simple static build |
| 3D renderer | Three.js (pin an exact 0.16x release) | Real-time 3D with full lighting, shadows, post-processing |
| Post-processing | `postprocessing` (pmndrs) pinned | Bloom, chromatic aberration, noise, vignette, SMAA in one efficient pass chain |
| UI | Plain TypeScript + lightweight DOM components, or Preact (pick one, Preact is fine) | Menus, lobby, locker room. Keep the 3D canvas separate from the DOM UI |
| Server | Node 20, Fastify 4 | Fast HTTP, good TypeScript support, static file serving via `@fastify/static` |
| Realtime | Socket.IO 4 (server + client) | Rooms, reconnection, fallbacks, acks. Mature on Railway |
| Voice | WebRTC (browser native) with Socket.IO signalling | No media server for 4 players |
| DB | PostgreSQL (Railway) + Drizzle ORM + `postgres` driver | Typed, plain SQL migrations |
| Validation | zod | Shared schemas for REST and socket messages |
| Auth hashing | `@node-rs/argon2` | Argon2id, prebuilt binaries |
| Tests | Vitest (unit/integration), Playwright (E2E, 4 clients) | Fast, TS native |
| Lint/format | ESLint flat config + Prettier | |
| CI | GitHub Actions | Runs lint, typecheck, unit, integration, E2E on every push and PR |

### 10.2 Repository layout

```
FNAF-Replica/
  package.json                 # npm workspaces: shared, server, client
  tsconfig.base.json
  railway.json                 # Railway build + deploy config
  .nvmrc                       # 20
  .env.example
  README.md
  docs/
    DECISIONS.md  PROGRESS.md  BALANCE.md  DEPLOY.md  PROTOCOL.md  ART.md
  shared/
    src/
      config.ts                # every tunable number, in seconds and percents
      rng.ts                   # seeded PRNG
      content/
        roster.ts  cosmetics.ts  achievements.ts  map.coop.ts  map.classic.ts
        nights.ts  calls.ts  newspapers.ts  presets.ts
      sim/
        world.ts               # World state type + createWorld(seed, mode, night, players)
        step.ts                # step(world, inputs, dt) -> events  (pure)
        power.ts  doors.ts  cameras.ts  stations.ts  maintenance.ts  musicbox.ts
        animatronics/
          base.ts  freddy.ts  bonnie.ts  chica.ts  foxy.ts  golden.ts  puppet.ts  powerout.ts
          plugins/             # extended roster rules, one file each
        showtime.ts
        scoring.ts
      protocol/
        messages.ts            # zod schemas for every socket message
        api.ts                 # zod schemas for REST
  server/
    src/
      index.ts                 # boot: env, migrate, fastify, socket.io, listen
      env.ts                   # zod-validated env
      db/ schema.ts  client.ts  migrations/
      auth/ routes.ts  sessions.ts  passwords.ts  ratelimit.ts
      api/ me.ts  shop.ts  profile.ts  leaderboard.ts  cosmetics.ts
      game/
        lobbyManager.ts        # create/join/leave, room codes
        match.ts               # owns one World, runs the tick loop
        netcode.ts             # snapshots, deltas, acks
        rewards.ts             # tokens/achievements at match end
        bots.ts                # bot guards for balance + tests
        voiceSignal.ts
      jobs/ cleanup.ts
    test/
  client/
    index.html
    src/
      main.ts
      net/ socket.ts  prediction.ts  interpolation.ts  voice.ts
      ui/ screens/ (title, login, menu, lobby, locker, profile, settings, archives, paycheck, legal)
          hud/ (clock, power, usage, buttons, tablet, chat, callouts, pings, subtitles)
      render/
        renderer.ts  post.ts  lighting.ts  materials.ts  textures/  (canvas texture generators)
        scenes/ office.ts  cameraRooms/  titleScene.ts  lockerScene.ts
        characters/ endo.ts  freddy.ts  ...  guards.ts
        fx/ sparks.ts  dust.ts  smoke.ts  arcs.ts  volumetric.ts  hallucinations.ts  jumpscare.ts
      audio/ engine.ts  synth/  music/  bank.ts  spatial.ts
      input/ bindings.ts
      minigames/ partyTime.ts  followMe.ts  lightsOn.ts
    public/ favicon.svg
  e2e/
    fourPlayers.spec.ts
  scripts/
    balance.ts
  .github/workflows/ci.yml
```

### 10.3 Server boot sequence

`server/src/index.ts`: load and validate env (fail fast with a clear message listing missing vars), connect to Postgres, run Drizzle migrations, build Fastify with `@fastify/cookie`, `@fastify/static` (serving `client/dist` with long cache headers on hashed assets and `no-cache` on `index.html`), register API routes, attach Socket.IO to the same HTTP server, start the cleanup job, then `listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })`. Binding to `0.0.0.0` matters on Railway. SPA fallback: any GET that isn't `/api/*`, `/socket.io/*` or a static file returns `index.html`.

Graceful shutdown on `SIGTERM` (Railway sends it on redeploy): stop accepting new lobbies, broadcast "Server restarting for an update. Your progress is saved." to all sockets, persist results of in-progress matches as `abandoned` (no penalties), close DB, exit within 10 seconds.

### 10.4 Environment variables

| Var | Required | Example | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | `${{Postgres.DATABASE_URL}}` (Railway reference) | Postgres connection |
| `SESSION_SECRET` | yes | 64 random hex chars | HMAC pepper for session token hashing |
| `PUBLIC_URL` | yes in prod | `https://fnaf-replica-production.up.railway.app` | Origin checks, links in emails |
| `NODE_ENV` | yes | `production` | |
| `PORT` | injected | | Railway provides |
| `ROSTER_MODE` | no | `tribute` / `original` | Character naming mode (Part 0.3) |
| `FAST_NIGHT` | no | `1` | 5-second hours for testing |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | | Password reset email |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | no | | Optional TURN for voice |
| `LOG_LEVEL` | no | `info` | Pino log level |

Generate `SESSION_SECRET` yourself with `openssl rand -hex 32` and set it on Railway. Never commit secrets. Provide `.env.example` with placeholders.

### 10.5 Lobbies and room codes

A lobby is created by a logged-in or guest user. It gets a 4-letter code from an alphabet without confusing letters (`ABCDEFGHJKMNPQRSTUVWXYZ`, no I, L, O). Codes are unique among active lobbies. Lobbies hold up to 4 players (Showtime: up to 4 including the Puppeteer). A lobby has: code, host user id, mode, night, custom AI settings, players (user id, display name, equipped snapshot, station choice, ready flag, connected flag), state (`waiting`, `in_night`, `results`), and options (ghosts can talk to the living, public/private).

Public lobbies appear in a "Find a shift" list on the menu (mode, night, players 2/4, host name, stars). Private ones are code-only. Quick Play button: joins the fullest public waiting lobby for Night Shift that's on a night you've unlocked, or creates one.

Lobbies with no connected players for 2 minutes are destroyed. A user can only be in one lobby at a time; joining another leaves the first.

### 10.6 Netcode model

FNAF is mostly discrete events (door toggles, camera switches), with few continuous values. That makes netcode simpler than an action game, but responsiveness still matters a lot: a door that closes 150 ms after you click feels broken.

Server-authoritative fixed-step simulation at 20 Hz. Clients send input messages tagged with a client sequence number: `{ type: 'input', seq, action: 'door', door: 'west', state: 'closed' }`. The server applies inputs at the start of the next tick, in arrival order, after validation (is this player alive? is this their station's door? is the door jammed? is the tablet down?).

Optimistic UI for local actions: when you press your door, the client immediately animates it closed and plays the sound, and marks the action pending. When the server's snapshot acknowledges `seq`, it's confirmed. If the server rejects it (e.g. jammed), the client snaps it back and plays the error buzz. Rejections should be rare since the client knows most of the rules (it runs the same shared validation code).

Snapshots: every tick, the server computes a per-player view and sends a delta against the last acknowledged snapshot. Per-player views matter for fairness and anti-cheat: a client only receives the positions of animatronics that player can currently perceive (in the camera node they're viewing, at their doors when their light is on, in their office) plus everything public (power, time, door states of all stations, music box level, maintenance statuses, ping markers, other players' alive/dead state and whether they're on the tablet). Everything else is withheld, so a modified client can't render a wallhack map. Ghosts receive the full world (they can't act on it).

Events: discrete one-shot events (jumpscare starts, door knocks, laughs, phone call cue, 6 AM, sound cues with positions relevant to that player) are sent reliably as a list attached to the snapshot with tick numbers, so the client can schedule them precisely.

Clock sync: on connect and every 10 seconds, client and server do a ping exchange to estimate offset and RTT. The client renders with a 100 ms interpolation buffer for continuous values (animatronic movement within the camera view is mostly snapping, but the music box dial, power level and Foxy's sprint progress interpolate).

Reconnection: Socket.IO's reconnection handles transport. On reconnect, the client sends `resume { lobbyCode, lastAckTick }`; the server sends a full snapshot. Part 3.11 covers gameplay rules.

Bandwidth target: under 5 KB/s per client during a night. Use compact keys and send numbers rounded sensibly. If you want, use Socket.IO's binary with a msgpack parser (`socket.io-msgpack-parser`), but JSON is fine at this scale; measure before changing.

### 10.7 Anti-cheat and trust

The server owns all randomness, all timers, all AI, all power math and all rewards. Clients send only intents. The per-player view filtering above means a cheater can't see animatronics they shouldn't. Rate limit inputs (20 per second per client hard cap; excess is dropped and logged). Validate every message with zod; malformed messages disconnect the socket after 3 strikes. Rewards are computed from the server's match record. Leaderboards only count matches with at least one non-guest account.

### 10.8 Socket protocol

Define every message in `shared/src/protocol/messages.ts` with zod and document it in `docs/PROTOCOL.md`. At minimum:

Client to server: `lobby:create { mode, night, options }`, `lobby:join { code }`, `lobby:leave`, `lobby:station { station }`, `lobby:ready { ready }`, `lobby:settings { night, customAi, toggles, options }` (host), `lobby:start` (host), `lobby:kick { userId }` (host), `lobby:skin { equipped }` (sent after a Locker Room change), `input { seq, action, ... }` with actions `door`, `light`, `tablet`, `camera`, `ping`, `tool` (flashlight, mic, mask, panel, reboot, lure, wind, boost, shutter, listen), `look { yaw }` (throttled to 10 Hz, used only for Ghost station view), `chat { text }`, `callout { id }`, `vote:mute`, `showtime:move { animatronic, node }`, `showtime:ability { ability, target }`, `voice:signal { to, data }`, `resume { lobbyCode, lastAckTick }`, `ping:clock { t0 }`.

Server to client: `lobby:state { lobby }`, `lobby:error { code, message }`, `night:start { seed, mode, night, stations, you, roster, startsAt }`, `snap { tick, ack, delta, events }`, `night:end { result, perPlayer, rewards, achievements }`, `chat { from, text }`, `callout { from, id }`, `voice:signal { from, data }`, `pong:clock { t0, t1 }`, `server:notice { text }`.

### 10.9 Bots

`server/src/game/bots.ts` implements scripted guard bots used by the balance script, by tests, and optionally to fill empty stations in a lobby ("Fill with bots" host option, off by default; bots earn no rewards and their stations count for scaling). Bot skill profiles: `novice` (slow reaction 900 ms, forgets to check the cove, overuses cameras), `average` (500 ms, decent checks), `expert` (250 ms, efficient light-check rhythm, perfect Foxy management). Bots act only on information their station could perceive, through the same view filter as humans, so they're honest.

---

## PART 11: GRAPHICS, LIGHTING, EFFECTS AND AUDIO

The owner wants full, detailed graphics and real lighting effects. That's the right instinct, and it's also where a lot of fan games fall over, so this part is long and specific. The goal isn't photorealism. The goal is the look of the original games, pre-rendered, grainy, harshly lit 3D stills, but alive: lights that flicker and cast real shadows, dust in the beams, sparks off exposed wiring, eyes that catch the light, a camera feed that feels like a cheap security system. We do it in real time in the browser with Three.js. Write `docs/ART.md` describing the art direction and every procedural texture generator as you build them.

### 11.1 Art direction in one paragraph

Grimy 1980s-to-90s family restaurant after closing. Checkerboard floor tiles (black and white, scuffed), confetti-patterned walls, faded party posters, children's crayon drawings taped up, cheap drop ceilings with water stains, exposed pipes and electrical conduit, flickering fluorescent tubes, a single desk fan, CRT monitors, everything slightly dirty. Colour palette: deep blacks, sickly greens and teals in the shadows, warm tungsten yellows from bulbs, harsh cold whites from the door lights, saturated reds for warnings. Contrast is high. Shadows are deep. Most of the screen is dark most of the time. Light is precious, which matches the gameplay.

### 11.2 Renderer setup

Use `THREE.WebGLRenderer` with `antialias: false` (we use SMAA in post), `powerPreference: 'high-performance'`, physically correct lighting (the default in recent Three.js), `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping` with exposure around 0.9 (tune per scene), `shadowMap.enabled = true`, `shadowMap.type = PCFSoftShadowMap`. Pixel ratio capped at `min(devicePixelRatio, 1.5)` multiplied by the user's render scale setting.

Use `MeshStandardMaterial` for most surfaces and `MeshPhysicalMaterial` for glossy Toy and Glamrock characters (clearcoat), eyes (clearcoat plus emissive iris), plastic props and the tablet screen glass. All textures are generated at load on `<canvas>` (or via small GLSL shaders rendered once into `WebGLRenderTarget`s) and cached in IndexedDB keyed by a content hash so second loads are instant. Generators you need, at minimum: checkerboard floor with scuffs and grime, confetti wallpaper, water-stained ceiling tiles, painted brick, metal (scratched, brushed, rusted), fur (base noise plus strand streaks plus a matching normal map derived by Sobel filter), fabric (for curtains and guard uniforms), wood (desk, stage), paper (posters, newspapers, drawings), circuit board, stained plastic, glass grime, and a generic "dirt" overlay. Each generator takes a seed and parameters so skins can tweak them.

Every material gets at least: base colour map, roughness variation, a normal map for surfaces where detail matters (floor, walls, fur, metal), and ambient occlusion baked into the colour subtly. Use `envMap` from a tiny generated PMREM of a dark room so metallic surfaces have something to reflect.

### 11.3 Scenes and how cameras are rendered

Build one Three.js scene containing the whole building (all rooms, halls and offices) as a single world with proper geometry and lights per room. Every security camera is a `PerspectiveCamera` placed high in a room corner, looking down (FOV 55 to 70). This gives coherent geometry, and animatronics physically exist where the sim says they are.

The player's office view is a separate camera at seated eye height (1.15 m) inside their station, with a wide horizontal FOV (about 100 degrees equivalent when panned) and yaw controlled by the mouse (Part 11.5).

Rendering cost control: don't render the whole building every frame. When the tablet is down, render only the player's office plus whatever's visible through its doorways (use layers and simple portal culling: each room has a bounding box; render only the station plus the door-adjacent node when the light is on). When the tablet is up, render only the active camera's room (and its neighbours if visible through doorways) into a 640×480 render target (or 480×360 on low settings), then display that texture on the tablet quad with the CRT shader. Re-render the camera target at 15 to 24 fps (cheap security cameras don't run at 60, and the lower rate looks right), while the CRT overlay itself animates at full frame rate. Lights in rooms not being rendered are disabled.

The title screen, Locker Room and Archives have their own small scenes.

### 11.4 Lighting, room by room

Lighting is where the scares come from. Use a small number of shadow-casting lights per visible area (at most 2 to 3 shadow casters active per rendered view, shadow map size 1024, 2048 for the main office light on high settings) plus non-shadow fill lights. Prefer `SpotLight` for anything with a cone (door lights, flashlights, ceiling cans, stage spotlights) and `PointLight` for bulbs. Use `RectAreaLight` (with `RectAreaLightUniformsLib`) for fluorescent tubes where you want soft, broad light (no shadows from these; pair with a nearby shadowed spot if needed).

Office (each station): a dim overhead bulb (warm 2700K-ish colour, intensity low) that casts soft shadows from the desk, fan and props; a faint monitor glow (emissive screen plus a weak cold point light) on the desk; the door-light buttons glowing red/green on the walls (emissive plus tiny point lights); the doorways themselves are pitch black. When the door light is held, a cold white SpotLight mounted above the door outside points down into the blind spot, with a hard, shadow-casting cone and a volumetric beam (Part 11.6), so an animatronic standing there gets dramatic side lighting and throws a long shadow across the doorway floor and wall. When a door closes, the steel door's surface catches the overhead bulb and the light from outside is cut off.

Show Stage: three coloured stage spotlights (red, blue, amber) from above, dimmed to 20% at night, with dust in the beams; a curtain with soft cloth material; the animatronics in deep shadow except for highlights on their eyes and tops of their heads.

Dining Area: rows of tables with party hats and plates; a few hanging pendant lamps, most switched off, one flickering (Part 11.6); the room is mostly dark, with the dining camera's IR look (desaturated green tint in the CRT shader) making shapes readable.

Pirate Cove: purple curtains with a star pattern lit by a single purple-tinted spotlight from above; when Foxy peeks, his eye catches the light.

Halls: long corridors with a fluorescent tube every few metres, most dead, one or two flickering; posters on the walls; the far end disappears into darkness. When an animatronic stands in a hall, it should be half-lit by a single working tube.

Kitchen: no camera feed, but it exists in the world for audio positioning.

Backstage and Parts & Service: a single bare bulb on a cord swinging very slightly (animate the light position on a slow pendulum so shadows sway; this is one of the creepiest cheap effects you can do), shelves of spare animatronic heads and endoskeletons, workbench with tools, sparks occasionally from a dangling wire.

Restrooms: tiled walls with a cold blue-green fluorescent, mirror (no real reflection needed; a darkened glossy plane is fine).

Party Rooms: string lights (a curve of tiny emissive spheres with a couple of low-intensity point lights) half-working, balloons tied to chairs that slowly sway.

Prize Corner: the Puppet's gift box lit from inside its lid gap, a prize counter with plush toys, a glowing arcade cabinet screen casting coloured light on the floor.

Vent Hub and vents: claustrophobic metal duct interiors with a tiny caged bulb, lit mostly by the vent light when the Technician uses it.

Control Room: banks of CRT monitors and the maintenance panel with dozens of small status LEDs (instanced emissive spheres, coloured by system status, blinking), cable runs along the walls, a breaker box with a hinged door. This is the most "electrical" room in the building: conduit, junction boxes, fuse panels with labelled breakers, and an exposed cable tray along the ceiling dripping wires. When a system fails, the matching breaker area sparks and its LED goes red.

Eyes: every animatronic's eyes have a small emissive pupil plus a tiny point light (no shadows, distance 0.5 m) so they glow in darkness and catch faint reflections on nearby surfaces. In a room with no light, only the eyes render visibly. This is the key FNAF image. Freddy in the East Hall Corner should often be nothing but two pinpoints in a black frame.

Power outage: on blackout, every light in the building fades out over 1.5 seconds with a flicker (each light randomly stutters before dying), the fan blades decelerate, monitors collapse to a white dot then black. The only light left is the faint ambient (set ambient to almost zero, enough to see the office silhouette at the edges after a few seconds, like eyes adjusting; animate ambient from 0 to 0.02 over 5 seconds). Then Power-Out Freddy's face lights up via an emissive pulse on his face and a SpotLight from below, flashing in time with the music (or steady in photosensitivity mode).

### 11.5 Office camera, input and feel

Office yaw: the view pans left and right as the mouse moves toward the screen edges (FNAF 1 style: the closer to the edge, the faster it pans), with a setting for direct mouse-look instead. Total yaw range: about ±55 degrees from centre, enough to see both doorways and buttons at the extremes. Add a subtle idle head-bob (breathing) and a slight camera sway, both disabled by a reduced-motion setting.

Default key bindings: A/D or Left/Right arrows to pan; Space or S to toggle the tablet; Q left door, E right door (South station: Q south-left, E south-right; Control Room: E vent shutter); Z hold left light, C hold right light (or click and hold the wall buttons); F station tool; M mask (South); Tab maintenance panel (Control); W wind music box (Control or while on CAM 08); number keys 1 to 9 and 0 for cameras, plus clicking the map; Q while on the tablet pings the camera; V push-to-talk; Enter chat; G callout wheel; L listen at door (when Nightmare characters are active); Esc pause menu (doesn't pause the night in multiplayer, just opens settings and leave). Conflicts here are resolved by context (on tablet vs off tablet), and all bindings can be changed.

Office props that react: the desk fan spins with motion blur (a blurred disc texture at speed) and stops in blackouts; the monitor flickers; posters flap slightly when a door slams; soda cups vibrate when Foxy bangs on the door; the overhead bulb sways after door slams. These reactions are cheap and make the office feel physical.

### 11.6 Effects

Volumetric light beams: for door lights, flashlights, stage spots, vent lights and the swinging bulb, use a cone mesh with a custom additive shader that fades with distance from the apex and with the view angle (Fresnel-like), modulated by 3D noise scrolling slowly to fake dust. Add floating dust motes: a `Points` cloud in each beam (200 to 600 points) drifting with curl noise, visible only inside lit volumes (check point position against the cone in the vertex shader). On high settings, add a screen-space god-ray pass for the strongest light. These beams are what make the door-light check feel cinematic.

Light flicker: implement a `Flicker` helper that drives a light's intensity with layered noise plus occasional dropouts (random 30 to 200 ms full-off stutters) and electrical buzz audio synced to the dropouts. Use it on broken fluorescents, the pendant lamp in the dining room, the halls, and every light in the building during "near danger" tells (Part 3.3) and outages.

Sparks: per Part 6B.1. Also from the Control Room's breaker box on failures, from Foxy's knocks against a steel door (a few sparks at the door seam), and from broken ceiling wires in Parts & Service. Each spark burst triggers a short-lived point light that genuinely lights nearby surfaces. Keep a pool of 4 reusable spark lights so we never allocate lights at runtime (Three.js recompiles shaders when the number of lights changes; that would stutter, so pre-create pooled lights at intensity 0 and toggle intensity instead).

Electrical arcs: a `LightningArc` effect for Electrobab, damaged panels and Ennard: jagged polylines between two points, regenerated every 50 to 80 ms, rendered as thin glowing tubes with bloom, blue-white, plus a flickering point light and a crackle sound.

Smoke and steam: soft particle sprites for Phantom characters, the kitchen (faint steam), and the burnt look of Springtrap-era rooms if active.

Steel door: the doors are thick metal slabs with rivets, warning stripes on the edge and a slight dent texture. Door slam: a quick downward motion with a little bounce, camera shake of 1 to 2 pixels, a dust puff at the floor, and the sound.

Camera feed CRT shader (the tablet): applied to the camera render target. Includes barrel distortion, scanlines (horizontal, slightly moving), RGB phosphor mask on high settings, film grain (animated noise, strength from settings), vignette, chromatic aberration at edges, horizontal sync jitter on random frames, a rolling interference band every few seconds, slight desaturation with a green or amber tint per tablet skin, and a timestamp/camera label overlay ("CAM 04 DINING AREA", a blinking red REC dot, and the camera's clock). Static on switching: full-screen animated noise for 120 ms that fades. When an animatronic moves in or out of the viewed room: heavy static plus signal loss ("signal lost" text) for 0.6 s, per Part 3.4.

Office post-processing: bloom (threshold high, so only eyes, lamps and LEDs bloom), subtle film grain (lower than the tablet), vignette, a touch of chromatic aberration, and SMAA. On danger: a heartbeat-synced vignette pulse when an animatronic is in the player's office or at the door with the light on (subtle, and disabled in photosensitivity mode). On hallucinations: Part 3.8's effects via a `HallucinationPass` with uniforms for red tint, wobble, aberration strength and a "flash image" texture slot.

Jumpscare rendering: Part 6.5's animation is rendered with a dedicated close-up camera, a strong key light from below and a red rim light, extreme chromatic aberration, an exposure spike on the first frames, and motion blur faked with the `postprocessing` library's motion blur or a quick accumulation trick. This is the money shot. Make it look incredible.

Hallucination faces: render the phantom face into a texture at load, then flash it full screen with additive blending and noise.

Guard first-person hands: two simple gloved hands with sleeves (skin-coloured by the uniform), visible when pressing buttons (an arm reaches toward the button, a short 150 ms animation) and holding the tablet. They catch office light and shadows like everything else.

### 11.7 Audio design (all synthesised)

Audio is half of FNAF. Build `client/src/audio/engine.ts` on the Web Audio API with buses: master, ambience, sfx, jumpscare, voice, ui, each with its own gain linked to settings, and a final compressor/limiter so jumpscares are loud but don't clip. All sounds are generated procedurally or from note data in code, rendered once at load into `AudioBuffer`s (with `OfflineAudioContext`) and cached, then played as buffers for low latency. Spatial sounds use `PannerNode` with HRTF and positions from the world (each station has its own listener position at the guard's head).

The sound list, with synthesis recipes. Tune by ear; these are starting points.

Office fan hum: filtered brown noise (low-pass 400 Hz) plus a 60 Hz and 120 Hz hum (sine, low gain) plus a slight rhythmic modulation at the fan's rotation rate. Loops. Stops with a pitch slide on blackout.

Building ambience: very low drone (two detuned sines around 40 to 55 Hz with slow LFO), occasional distant thumps (filtered noise bursts with reverb), random creaks (short resonant filter sweeps on noise). Rises slightly in intensity each hour.

Fluorescent buzz: 120 Hz sawtooth through a narrow band-pass, tied to each flickering light's intensity.

Door slam: a noise burst through a low-pass envelope plus a metallic resonance (a few inharmonic sine partials at 180, 420, 750 Hz decaying fast), with a thud (pitched-down kick drum: sine from 120 Hz to 40 Hz over 120 ms).

Door open: a scraping slide (band-passed noise sweeping up).

Light button and light hum: a click (very short square blip) and a buzzing hum while on.

Error buzzer (jammed button): two short square-wave tones at 160 Hz, harsh.

Tablet raise/lower: a whoosh (band-passed noise sweep) and a plastic click.

Camera switch: a click and a 120 ms static burst (white noise through a band-pass).

Window sting (animatronic revealed by light): a dissonant cluster (several detuned saw waves stacked a semitone apart) with a fast attack and 600 ms decay, slightly distorted.

Footsteps: heavy, metallic, two layers: a low thud (sine thump) and a clank (inharmonic metallic partials), with random variation per step; panned and filtered by distance. Each animatronic has a variant (Freddy deeper, Chica clunkier, Foxy faster and lighter).

Freddy's laugh: a deep, slowed "ho-ho-ho" built from formant-filtered pulses (vocal-like synthesis: a sawtooth source at around 90 Hz through three band-pass filters at formant frequencies for an "o" vowel, about 400, 800 and 2,600 Hz), pitched down, with reverb. Not a copy of any real laugh.

Kitchen clatter: random metallic hits (inharmonic partials with fast decays), pans scraping (noise through resonant filter), varied every time.

Groan/moan (animatronic enters office): a low, slow vocal-ish formant sound sliding down in pitch with heavy distortion.

Breathing: filtered noise with a slow amplitude envelope (inhale and exhale), wet and mechanical (add a slight metallic comb filter).

Foxy's run: rapid footsteps accelerating, with a panning sweep from far left to near left.

Foxy's knock: three heavy bangs on metal (door slam recipe without the slide, plus extra low end), each with a tiny delay variation.

Foxy's shanty hum: a short original melody (write it as notes in `music/foxyHum.ts`, in a minor key, 6/8 time) played on a hollow, vocal-like synth.

Music box (Freddy's approach tune): an original 8-bar melody in a minor key on a music-box voice (sine plus a quieter sine at 2x and 3x frequency with fast decay, plus a tiny mechanical click per note).

Toreador Song (power out): Bizet's public-domain melody, arranged by you as note data on the same music-box voice, with a slight wow-and-flutter pitch wobble (slow LFO on detune). Get the melody right from the score (it's the refrain of "Votre toast, je peux vous le rendre", Act 2 of Carmen). Write the note array with pitches and durations in `music/toreador.ts`.

"Pop Goes the Weasel" (Puppet music box): public-domain nursery tune, arranged by you on the music-box voice; when the box is low, the tempo increases slightly and pitch wobbles.

Puppet warning: a fast, distorted, high version of the above.

Phone ring: a classic two-tone ring (440 Hz + 480 Hz, the North American ring pattern, 2 s on, 4 s off), through a small-speaker filter. Phone call babble: formant-ish noise bursts shaped like speech rhythms, through a telephone band-pass (300 to 3,400 Hz), synced to subtitle lines.

Jumpscare scream: the most important sound in the game. Layer 1: a loud, harsh, distorted sawtooth sweep from about 300 Hz up and down chaotically with heavy frequency modulation (a mechanical screech). Layer 2: white noise burst through a high resonant band-pass sweeping fast. Layer 3: a low sub-bass hit at the start. Hard-clip distortion over everything. Duration 0.8 to 1.2 s. Each character gets a slightly different recipe (Foxy's is higher and shriller, Freddy's lower, Golden Freddy's is a distorted, bit-crushed scream that "crashes" into silence). Respect the jumpscare volume setting and the reduced intensity cap.

Electrical sparks and crackle: very short noise bursts through a high-pass at 3 kHz, irregular timing, a few bright clicks. Arcs: a buzzy 50 Hz saw with heavy distortion and random gating.

6 AM chime and cheer: a clock chime (bell-like inharmonic partials at about 1:2.76:5.4 ratios, decaying slowly) striking six times, then a "Yay!" crowd cheer synthesised as many layered short formant bursts (simulate 20 voices with randomised pitches around 250 to 400 Hz with an "ay" vowel, a quick rise and fall) plus party horn squeals (FM synthesis).

UI sounds: soft clicks, a satisfying "equip" chime in the Locker Room, a coin sound for purchases.

Minigame chiptunes: square and triangle waves, simple 8-bit melodies (original), blip sound effects.

Radio squelch: noise burst through band-pass on push-to-talk start and end.

Mix rule: ambience is quiet but always present. Silence is never true digital silence except deliberately (the beat before Power-Out Freddy). Gameplay-relevant sounds (footsteps, knocks, laughs, kitchen) are clearly audible over ambience. Jumpscares are the loudest thing in the game by a margin. Never play music during normal gameplay.

### 11.8 UI visual style

Menus: black background, typewriter font (Google Fonts "Special Elite") for body, a heavy display font for headings ("Rubik Glitch" or "VT323" for the pixel/terminal accents, pick what reads best), red as the only accent colour, static noise overlay at low opacity, slight text flicker on hover. Buttons are text with a ">>" cursor on hover, very FNAF.

HUD in-night: bottom-left "Power left: 67%" and "Usage:" with green/yellow/red bars; top-right the clock ("3 AM") and "Night 4"; buttons on the office walls are 3D (not HUD), but the HUD adds a small icon cluster showing the station's door and light states for clarity; the tablet toggle bar at the bottom of the screen (a translucent strip you hover to raise the tablet, like the original). Teammate panel: top-left list of the four guards with alive/dead status, a small icon when they're on the tablet, and the voice "speaking" indicator. Subtitles centred low.

### 11.9 Performance budgets and quality presets

Target: 60 fps on a mid-range laptop with integrated graphics (Intel Iris Xe) at Medium; 60 fps at High on a GTX 1660-class GPU. Initial download under 3 MB gzipped (no big assets, since everything is procedural). Time to interactive under 4 seconds on broadband, with a loading screen showing texture generation progress ("Cleaning the stage... Restocking cupcakes... Charging the doors...").

Quality presets: Low (render scale 0.75, shadows only on the main office light at 512, no volumetric dust, no god rays, camera targets at 480×360, max 2 dynamic shadows), Medium (render scale 1.0, 1024 shadows, volumetric cones without god rays, 640×480 cameras), High (render scale up to 1.5 on high-DPI, 2048 office shadow, god rays, phosphor mask, more particles). Auto-detect on first run by measuring frame time over a 3-second benchmark on the title screen, and pick a preset; the player can override.

Profile with the browser's performance tools and `renderer.info` (draw calls, triangles, programs). Keep draw calls under 300 per frame in the office. Use `InstancedMesh` for repeated objects (chairs, tables, party hats, LEDs, wires on shelves). Merge static geometry per room with `BufferGeometryUtils.mergeGeometries`. Pre-compile shaders during loading with `renderer.compile(scene, camera)` for every view so the first jumpscare never stutters (a stutter on the jumpscare would ruin it).

---

## PART 12: BUILD PLAN, TESTING AND DEPLOYMENT

### 12.1 Milestones (do them in order, push after each)

Each milestone ends with: lint and typecheck clean, tests green, a commit, a push to `main`, Railway deploying successfully (from Milestone 2 on), and `docs/PROGRESS.md` updated. Don't start a milestone while the previous deployment is red.

**Milestone 1: Skeleton.** Clone `elliotread250-source/FNAF-Replica`. Set up npm workspaces (`shared`, `server`, `client`), TypeScript configs, ESLint, Prettier, Vitest, `.nvmrc`, `.env.example`, `railway.json`, GitHub Actions CI. Fastify server serving a placeholder Vite page with the title "FNAF Replica" and the legal disclaimer, `/healthz` returning ok. Root `npm run build` builds shared, client and server; root `npm start` starts the server and serves `client/dist`.

**Milestone 2: Railway pipeline live.** Find the Open Arcade project on Railway. Add a PostgreSQL database to it if one dedicated to this game doesn't exist (name it `fnaf-db` if you can rename). Create the `fnaf-replica` service, connect it to the GitHub repo `elliotread250-source/FNAF-Replica`, branch `main`, with auto-deploy on push. Set env vars (`DATABASE_URL` as a reference to the Postgres service's `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `PUBLIC_URL`, `ROSTER_MODE=tribute`). Generate a public domain. Set the health check path to `/healthz`. Push and confirm the deployment goes green and the URL serves the placeholder. Write `docs/DEPLOY.md` with the exact setup so it's reproducible. From here on, every push to `main` deploys.

**Milestone 3: Database and accounts.** Drizzle schema and migrations (Part 8.3), auto-migrate on boot, auth routes (signup, login, guest, claim, logout, me), sessions, rate limits, zod validation. Client screens: first-launch warning, title, login/signup, guest play, main menu, profile. Tests for auth flows (happy path, wrong password, rate limit, guest claim, session expiry).

**Milestone 4: Shared simulation, Classic Office (headless).** Seeded RNG, config, Classic map, roster for the core four plus Golden Freddy, power, doors, lights, cameras, time, AI movement opportunities, routes, Foxy cove stages and sprint and knock drain, Freddy watched-freeze, in-office rules, power-out sequence, 6 AM victory. Pure `step()` function. Unit tests covering each rule from Part 1.3 and Part 4 (list in 12.4). A CLI script `npm run sim:classic -- --night 5 --seed 42 --bot average` that prints a text log of a night. Don't touch rendering yet. The sim must feel right as text first.

**Milestone 5: Networking and lobbies.** Socket.IO on the server, session-authenticated sockets, lobby manager, room codes, station selection, ready-up, host controls, match runner with the 20 Hz loop, per-player view filtering, snapshots and deltas, input handling with acks, reconnection, graceful shutdown. Integration tests with 4 socket clients connecting, joining by code, readying, starting a FAST_NIGHT, sending inputs, and receiving a `night:end`.

**Milestone 6: First playable (Classic Office in 3D).** Renderer setup, post-processing, the Classic office scene with full lighting, doors, buttons, fan, desk props; the Classic camera rooms; procedural textures; the core four and Golden Freddy models with endoskeletons; camera tablet with CRT shader; HUD; audio engine with the core sound set; jumpscares; power-out sequence; 6 AM sequence; phone call for Night 1 with subtitles. Play Classic Night 1 to 5 end to end in the browser on the deployed URL. Tune feel.

**Milestone 7: Night Shift co-op.** Co-op map, four stations with their tools (flashlight, kitchen mic, mask, maintenance panel), shared power, Puppet and music box, maintenance failures, hallucinations, ghosts, pings, callouts, text chat, player-count scaling, Night 1 to 6 tables, all five phone calls and the Night 5 transmission, the 6 AM shared victory, paycheck screen. The Playwright four-player test (12.4) must pass against a local server.

**Milestone 8: Voice radio.** WebRTC mesh with Socket.IO signalling, push-to-talk, radio filter chain, ghost voice rules, mic selection, speaking indicators, graceful fallback.

**Milestone 9: Skins and economy.** Cosmetics catalogue (40+ items), Locker Room with 3D turntable, live skin broadcast to lobby, shop rotation, token rewards, first-person hands and sleeves using the uniform, death card with the guard model, profile showing equipped skin, office decor and tablet themes applied in-game.

**Milestone 10: Custom Night, stars, achievements, Archives.** Custom Night screen with AI sliders and presets, stars, all achievements with toasts, Archives (gallery with x-ray endo view, newspapers, calls, minigames, sounds), newspaper clippings in the world with zoom, easter eggs (Part 9.4), Atari minigames.

**Milestone 11: The full roster, in waves.** Wave 2 (FNAF 2 cast), Wave 3 (FNAF 3 and 4), Wave 4 (Sister Location and Pizzeria Simulator), Wave 5 (UCN extras, digital era, Glamrocks, the Mimic). Each character: model with endo and wiring, poses, jumpscare, sounds, sim plugin rule with tests, Archives entry. Push after each wave.

**Milestone 12: Showtime mode.** Puppeteer map UI, controls, cooldowns, abilities, fog of war, uncontrolled AI fallback, win conditions, rewards, leaderboard.

**Milestone 13: Polish and balance.** Run `npm run sim:balance` across nights and player counts and tune `config.ts` to hit the targets in Part 3.6 and Part 5. Quality presets and auto-detect. Accessibility pass (photosensitivity, reduced jumpscares, visual sound cues, subtitles, rebinding, colourblind indicators). Performance pass to hit Part 11.9 budgets. Final README.

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
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5,
    "numReplicas": 1
  }
}
```

If Railway's current default builder for new services is Railpack and Nixpacks gives trouble, switch the builder to `RAILPACK`, keep the same commands, and note it in DECISIONS.md. Pin Node 20 via `"engines": { "node": "20.x" }` in the root `package.json` and `.nvmrc`.

One replica only. Lobbies live in server memory, so scaling out would split players across instances. That's fine for this game's scale; if it ever needs more, we'd add Redis and sticky sessions, which is out of scope. Write that note in DECISIONS.md.

WebSockets work on Railway out of the box through the public domain. Make sure Socket.IO's client connects to the same origin (no hardcoded URL) and that the server doesn't restrict transports in a way that breaks behind Railway's proxy. Set Fastify's `trustProxy: true` so rate limits see real client IPs from `X-Forwarded-For`.

### 12.3 GitHub Actions CI

`.github/workflows/ci.yml` runs on push and pull request to `main`: checkout, setup Node 20 with npm cache, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (unit + integration; integration tests use a Postgres service container `postgres:16` with a test database), `npm run build`, then the Playwright E2E job (install Chromium with `npx playwright install --with-deps chromium`, start the built server with `FAST_NIGHT=1`, run `e2e/`). Upload Playwright traces on failure. Keep total CI time under 10 minutes.

Railway deploys from `main` independently of CI. To avoid deploying broken builds, enable Railway's "Wait for CI" option on the service if it's available (it waits for GitHub checks to pass before deploying). If it isn't available through your tools, mention in DEPLOY.md that I should toggle it in the service settings.

### 12.4 Tests you must write

Simulation unit tests (Vitest, in `shared/test/`). At minimum, each of these is a named test:

1. AI 0 never moves over 10,000 opportunities; AI 20 moves on every opportunity.
2. AI N moves with probability N/20 within statistical tolerance over 20,000 seeded rolls.
3. Movement timers fire at the configured interval (Freddy 3.02 s etc.) within one tick.
4. Night tables load the right starting AI per night; hourly increments apply at 2, 3, 4 AM (and 5 AM Freddy in Night Shift).
5. Power drains at the correct rate for usage 1 to 5 in Classic (tolerance 1%), and with passive drain per night.
6. Closing a door adds one usage bar; opening removes it; tablet and lights likewise.
7. A closed door blocks Bonnie's entry and Bonnie retreats; an open door lets him in.
8. Bonnie in the office jams the left door and light buttons; pressing them yields a rejection event.
9. In-office animatronic attacks when the tablet goes down; attacks after the delay if the tablet stays down; forces the tablet down after the long timeout if it stays up.
10. Freddy never takes an opportunity while his node is watched.
11. Foxy's cove freeze triggers when watched; he progresses stages 0 to 3 when not; the sprint shortens when the West Hall is viewed.
12. Foxy's knock drains 1%, then 6%, then 11% across three blocked runs in one night.
13. Flashlight sends Foxy back in the first half of the sprint and not in the second.
14. Power at 0 opens and jams all doors and starts the power-out sequence; reaching 6 AM during it means survival.
15. Golden Freddy appears only after the poster event; raising the tablet within 4 s dismisses him; failing kills.
16. 1/9/8/7 Custom Night kills the host instantly with Golden Freddy.
17. Music box unwinds at the night's rate; the Puppet emerges at 0, travels at fixed speed, is sent back if wound above 50% in time, kills on arrival.
18. Maintenance failures follow the schedule; reboots take 5 s (12 s for all); ventilation failure triggers hallucination events after 20 s.
19. Mask fools a mask-able animatronic when worn in time; doesn't fool Foxy.
20. Co-op power scaling: four stations at usage 2 drain at the configured combined rate.
21. Sealed stations are never targeted and never draw power.
22. Disconnected player's station goes to autopilot, then seals after 60 s.
23. A full seeded night replay produces identical event logs on two runs (determinism).
24. Per-player view filtering hides animatronics the player can't perceive.
25. One test per extended roster plugin: the counter works and the uncountered threat kills (or causes its stated effect).

Server integration tests (Vitest + a real Postgres): signup/login/logout; duplicate username; bad password rate limit; guest create and claim; equip owned skin succeeds, equip unowned fails; buy with enough tokens succeeds in a transaction, buy without enough fails and doesn't change balance; match end awards tokens exactly per Part 8.6; four sockets play a FAST_NIGHT and receive consistent `night:end` results.

E2E (Playwright, `e2e/fourPlayers.spec.ts`): launch the server with `FAST_NIGHT=1` and a fixed seed override env (`TEST_SEED=1234`, only honoured when `NODE_ENV !== 'production'`). Open four browser contexts. Each signs up a new account. Player 1 creates a lobby and reads the room code from the DOM. Players 2 to 4 join with the code. Each picks a different station. Player 2 opens the Locker Room and equips "Graveyard Grey"; assert Player 1's lobby list shows the change. All ready up, the host starts Night 1. During the night, each player raises and lowers the tablet, switches cameras, and toggles doors. Wait for 6 AM. Assert all four see the 6 AM screen and the paycheck with tokens > 0. Assert `/api/me` for each shows `nights_survived = 1`. Take screenshots at key points and attach them to the report.

Visual smoke test: a Playwright test that loads the title, the office and a camera feed on the deployed URL (run manually after deploy, not in CI) and saves screenshots to `docs/screenshots/` so the README can show the real game.

### 12.5 The balance script

`scripts/balance.ts` runs N headless nights per (mode, night, player count, bot skill) combination using the real `step()` and bots, in parallel worker threads. Output a table: survival rate, average power left at 6 AM, average hour of first death, most common killer. Targets for Night Shift with `average` bots: Night 1 about 95% survival, Night 2 about 85%, Night 3 about 70%, Night 4 about 55%, Night 5 about 40%, Night 6 about 20%. With `expert` bots, Night 5 should be beatable at 75% or more and Night 6 at 45% or more. With `novice` bots, Night 1 should still be 80% or more (new players must survive their first night most of the time; a brutal Night 1 kills retention). Tune AI tables, power scaling and failure rates in `config.ts` until these land within about 10 points, and write the final table into `docs/BALANCE.md`.

### 12.6 Security checklist

Before calling it done, check each of these and note the result in DECISIONS.md: passwords hashed with Argon2id; session tokens random, hashed at rest, httpOnly, Secure in production, SameSite=Lax; Origin check on state-changing REST calls; zod validation on every input; rate limits on auth, chat, lobby creation and inputs; no user enumeration in forgot-password; SQL only through Drizzle's parameterised queries; no secrets in the repo (run a quick grep for keys before each push); server never trusts client-computed rewards or game state; Content-Security-Policy header set (self for scripts, Google Fonts for styles and fonts, `ws:`/`wss:` self for connect, `blob:` for audio workers if used); `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; display names and chat escaped when rendered (never use `innerHTML` with user content).

### 12.7 README contents

The README should have: the game title and a one-paragraph pitch, a screenshot or two from `docs/screenshots/`, the live URL, the fan game disclaimer, how to play (controls table, how co-op works, roles), how to run locally (Node 20, `docker run` a Postgres or use a local one, `cp .env.example .env`, `npm i`, `npm run db:migrate`, `npm run dev` which runs Vite and the server with hot reload and a proxy), how deployment works (GitHub `main` to Railway `Open Arcade` / `fnaf-replica`, env vars table), how to switch roster mode, how to tune balance, the test commands, and credits ("Created by elliotread250-source with Claude Code. Inspired by Five Nights at Freddy's by Scott Cawthon. All assets original.").

### 12.8 Final acceptance checklist

Go through this list on the deployed Railway URL before you report back. Every line must be true.

1. The URL loads the first-launch warning, then the title screen with the 3D animatronics, static, flicker, ambient sound and the disclaimer.
2. I can sign up, log out, log back in, and play as a guest, then claim the guest account.
3. Locker Room shows my default skins on a 3D turntable; I can equip a different uniform, see it change instantly, and it persists after reload.
4. I can buy a skin with Faz-Tokens after earning some, and my balance updates.
5. I can create a lobby, see a 4-letter code, and three other browsers can join it with the code; we each pick a station; skin changes in the lobby show for everyone.
6. Night 1 runs for all four players in sync: same clock, same power, phone call in sync, mute vote works.
7. Doors, lights, tablet, cameras, pings, callouts and text chat all work. Voice radio works between at least two browsers on different networks (or the same machine if that's all you can test, note it).
8. An animatronic reaching an open door kills that guard with a full jumpscare; that player becomes a Ghost and can watch cameras free.
9. Power runs out if we waste it, the blackout and the Toreador sequence play, and 6 AM can save us.
10. 6 AM shows the chime and cheer, the paycheck awards tokens, and stats update on my profile.
11. Classic Office plays like FNAF 1 solo, Nights 1 to 5, with Golden Freddy possible.
12. Custom Night presets work, 1/9/8/7 triggers Golden Freddy, 4/20 is beatable by a skilled player.
13. Graphics: real-time shadows from the office bulb and door lights, volumetric beams with dust, flickering lights, glowing eyes in darkness, visible endoskeletons and wiring on damaged characters, sparks with dynamic light, the CRT camera shader, bloom on eyes and LEDs. Runs at 60 fps on Medium on an ordinary laptop.
14. Every character in Part 6B that you shipped appears in the Archives with an x-ray endo view; any not yet shipped appear as silhouettes marked "coming soon", and you've listed them in PROGRESS.md.
15. Accessibility toggles work, especially photosensitivity mode and reduced jumpscares.
16. CI is green on the latest commit, and Railway's latest deployment is the latest commit and is healthy.
17. Switching `ROSTER_MODE` to `original` on Railway and redeploying changes every character name, the venue name and the currency name everywhere, with no leftover tribute names in the UI.

### 12.9 What to tell me when you're finished

Your final message to me should include: the live URL; the GitHub repo link; a short paragraph on what's in the game; a list of anything from this prompt you didn't finish or changed, with reasons; the balance table summary; how to switch roster mode; and anything I need to click in Railway or GitHub myself (for example "Wait for CI" or adding an SMTP provider). Keep it short and specific. No fluff.

---

## APPENDIX A: CONFIG FILE STARTING POINT

Put every tunable in `shared/src/config.ts`. Here's the shape, with the defaults from this prompt. Express times in seconds and convert to ticks in one place.

```ts
export const CONFIG = {
  TICK_HZ: 20,
  HOUR_SECONDS: process.env.FAST_NIGHT === '1' ? 5 : 89,
  HOURS_PER_NIGHT: 6,

  power: {
    BASE_DRAIN_PER_USAGE: { 1: 1 / 9.6, 2: 1 / 4.8, 3: 1 / 3.2, 4: 1 / 2.4, 5: 1 / 1.9, 6: 1 / 1.6 },
    CO_OP_POWER_SCALE: { 1: 1.0, 2: 0.6, 3: 0.45, 4: 0.36 },
    PASSIVE_DRAIN: { 1: 0, 2: 1 / 6, 3: 1 / 5, 4: 1 / 4, 5: 1 / 3, 6: 1 / 3, 7: 1 / 3 },
    FOXY_KNOCK_BASE: 1,
    FOXY_KNOCK_STEP: 5,
    BOOST_DURATION: 20, BOOST_COOLDOWN: 60, BOOST_FACTOR: 0.5,
  },

  doors: { TOGGLE_COOLDOWN: 0.1, ANIM_SECONDS: 0.25 },
  lights: { HOLD_TO_USE: true, NEAR_FLICKER_CHANCE: 0.15, NEAR_FLICKER_PERIOD: 0.5 },
  tablet: { RAISE_SECONDS: 0.3, STATIC_ON_SWITCH: 0.12, MOVE_GLITCH: 0.6 },

  animatronics: {
    INTERVALS: { freddy: 3.02, bonnie: 4.97, chica: 4.98, foxy: 5.01 },
    IN_OFFICE_ATTACK_DELAY: [1.5, 3.0],
    TABLET_FORCE_DOWN: [10, 25],
    FOXY_FREEZE: [0.83, 16.67],
    FOXY_SPRINT_SECONDS: 25,
    FOXY_SPRINT_WHEN_SEEN: 1.5,
    FOXY_NEGLECT_SECONDS: 60, FOXY_NEGLECT_BONUS: 3,
    GOLDEN_DISMISS_SECONDS: 4,
    PUPPET_SECONDS_PER_EDGE: 8,
    MAX_PER_NODE: 2,
  },

  musicBox: { UNWIND: { 3: 1.0, 4: 1.3, 5: 1.5, 6: 1.8 }, WIND_RATE: 8, REMOTE_WIND_FACTOR: 0.5, PUPPET_RECALL_THRESHOLD: 50 },

  maintenance: { REBOOT_ONE: 5, REBOOT_ALL: 12, VENT_HALLUCINATE_AFTER: 20, MIN_GAP: 25 },

  flashlight: { DRAIN_PER_SEC: 4, RECHARGE_PER_SEC: 1, BONNIE_BLIND: 3 },
  mask: { RAISE_SECONDS: 0.4, GRACE_SECONDS: 1.5, VISITOR_STAY: [3, 6] },
  lure: { DURATION: 2, COOLDOWN: 30, PULL_CHANCE: 0.7 },

  scaling: { AI_MULT: { 1: 0.75, 2: 0.85, 3: 0.95, 4: 1.0 } },

  disconnect: { AUTOPILOT_SECONDS: 60 },

  showtime: { COOLDOWN_SCALE: 2.0, UNCONTROLLED_AFTER: 20, UNCONTROLLED_AI: 5,
              LIGHTS_OUT: { duration: 10, cooldown: 90 }, STATIC: { duration: 5, cooldown: 60 } },

  rewards: { /* Part 8.6 values */ },
} as const;
```

## APPENDIX B: GLOSSARY

AI level: a 0 to 20 number controlling how often an animatronic succeeds at a movement opportunity. Movement opportunity: a timed chance to move, succeeding if a 1 to 20 roll is at or below the AI level. Usage: the count of active power consumers at a station. Blind spot: the space just outside a doorway, only visible with the door light. Station: a player's office. Sealed station: an unused office, welded shut. Ghost: a dead player who can spectate and ping. Puppeteer: the animatronic player in Showtime. Endo: endoskeleton, the metal robot frame inside a costume. Springlock: the spring-loaded mechanism in early suits that let them be worn, and that snapped shut lethally. Tribute mode: classic names. Original mode: original names. Faz-Tokens: earned in-game currency for cosmetics only.

## APPENDIX C: TONE REMINDERS FOR YOU, THE BUILDER

Quiet is the main course. If you're unsure whether to add a sound, don't, unless it's a gameplay tell. Every death should be explainable in one sentence. Light is a resource and a storytelling tool; keep scenes dark and let the player spend light to see. Polish the first five minutes most: the warning screen, the title, the Night 1 call, the first door check, the first time Bonnie appears in the light. If those land, people stay. And keep it fair: when a player dies, they should want to say "one more night", not "that was cheap".

Now go build it. Start with Milestone 1, and don't stop until the acceptance checklist is all green on the live Railway URL.

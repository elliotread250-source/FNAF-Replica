# Map reference matrix: the 2014 cameras against this build

This matrix maps each of the 2014 game's camera views onto the free-roam building. It's written from study of
publicly available gameplay of the original game. No image, texture, model, sound or screenshot from that game is
stored in this repository. Every surface here is drawn by our own canvas and geometry code.

The original game only ever shows fixed camera slices and one office. It never shows a surveyed floor plan, so
nothing here is a measurement. Each row says what the 2014 view establishes and what we reproduce. It also says
how confident the spatial link is, and whether our version is a **close** match (same layout and landmark), an
**interpreted** one (layout inferred from adjacency, surfaces in the same spirit) or **original** (our addition).

Columns: *Seen in 2014* is what the camera frame itself shows. *Our room* and *Our view* are where the room
tour (`MAP_SHOTS=1 npx playwright test mapShots -g "room tour"`) stands to compare. *Confidence* is how
sure the adjacency is (high, medium, low). *Match* is close, interpreted or original.

| Cam | 2014 name | Seen in 2014 (composition, landmarks, palette, light) | Our room | Our view | Confidence | Match | Intentional differences |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1A | Show Stage | Three characters on a raised stage, dark star-spotted backdrop, light from above, darkness at the edges. The stage sits at one end of the dining area. | `stage` (deck x 54..68, z 10..20, 1 m high; steps from dining) | `look(50.5,16 -> 62,15)` | high | close | Lighting truss, floor wedges and a "CELEBRATE!" banner are our own dressing. The stage is wider than any single camera shows, so four co-op players and the band can share it. |
| 1B | Dining Area | Long party tables with hats and plates, a checkered floor, dim warm light, posters, a sense of a large hall. | `dining` (40 x 22 m, 5 m ceiling) | `look(34,11 -> 34,31)` | high | interpreted | Hall size is ours. Bunting, the disco ball, salad bar and soda fountain are our dressing. Walls use our grey block with checker band and faint confetti. |
| 1C | Pirate Cove | Purple star-patterned curtains closed over a small stage, a sign saying the attraction is out of order. Off the dining area. | `cove` (x 4..14, z 10..22), curtain at the dining arch x 14 | `look(17,13 -> 8,16)` | high | close | Sign text and lettering are original. The cove is a walk-in room in free roam; the 2014 view never shows behind the curtain. |
| 2A | West Hall | Long, narrow hall running toward the office, checkered floor, posters, very dark far end, a flickering light. | `westHall` (x 10..14, z 22..50) | `look(12,23.2 -> 12,50)` | high | close | Party-room doors on the west wall are original extensions. The buzzing tube is the hall's seeded flicker fixture. |
| 2B | West Hall Corner | The end of the west hall at the office's left door: a corner with a poster on the wall and a dark doorway. | `westCorner` (x 14..22, z 48..52) | `look(21.2,48.8 -> 16,51.5)` | high | close | The damaged poster beside the main one is our nod to the original's corner poster swap, with our own art. |
| 3 | Supply Closet | A cramped closet: shelves, cleaning supplies, mops and a bucket, very dark. | `supply` (x 28..36, z 52..56) | `look(33.5,52.8 -> 30.5,55.5)` | medium | interpreted | Placed off the East Hall per our adjacency reading. The cleaning cabinet is also the closet hiding spot. Fuses and batteries spawn on the shelves. |
| 4A | East Hall | The right-hand hall leading to the office: checker floor, kids' drawings and posters along the wall. | `eastHall` (x 32..36, z 32..52) | `look(34,33.2 -> 34,52)` | high | close | The restroom corridor and kitchen doors along the east wall follow the 2014 adjacency (restrooms and kitchen are on the east side). |
| 4B | East Hall Corner | The end of the east hall at the office's right door: posters, including the chicken character's "let's eat" style poster, and drawings. | `eastCorner` (x 28..32, z 48..52) | `look(31.2,48.8 -> 28,51.5)` | high | close | Poster art and lettering are original. |
| 5 | Backstage | A small room with a work table, an endoskeleton, and a shelf of spare costume heads staring at the camera. | `backstage` (x 54..68, z 28..36), behind the stage | `look(66.5,35 -> 56,29)` | high | close | Heads are our own stylised shapes, not character models. The costume rack hiding spot and a pegboard are ours. |
| 6 | Kitchen | Audio only in 2014: the camera is disabled and you only hear pots and pans. | `kitchen` (36..52 x 44..52, plus 40..48 x 52..56) | `look(37.5,47 -> 46,46)` | medium | original | Everything you see is interpreted: range, hood, prep island, ovens, fridge, decorating station. The CAM 6 feed stays audio-only to match. |
| 7 | Restrooms | A corridor with restroom doors and a checkered floor. | `restCorr`, `men`, `women` | `look(37,32.6 -> 39,36.5)` | medium | interpreted | Stall interiors, sinks, mirrors and the puddle are original. Tile walls and floor in the restrooms; the corridor has our own signage. |
| Office | Security Office | Small, cramped room, low desk with a fan, old monitors, cups and paper, the group poster and kids' drawings on the back wall, doors left and right with DOOR and LIGHT buttons, a single light, hanging cables. | `office` (x 22..28, z 48..56) and the seated scene | Five hero views in `docs/screenshots/map/office-*` | high | close (composition), interpreted (depth) | 6 x 8 m instead of the cramped 2014 depth, to fit four players, a rear door and the desk hiding spot. Everything on the desk comes from `OFFICE_KIT`, shared with the seated scene. |

## Original extensions (not in any 2014 view)

Front Entrance, Prize Corner, Arcade, Kids' Play Zone, four themed Party Rooms, Stage Booth, Employee Lounge,
Staff Entrance, Manager's Office, Utility and Service corridors, Pantry, Walk-in Freezer, Parts & Service,
Loading Dock, and the whole basement (hall, old storage, breaker room, boiler room, camera server room). They
share the building's construction: the same ceiling grid, fixtures, door hardware, grime and trim family. The
basement is deliberately more industrial (concrete, pipes, caged lamps). None of them is presented as a
canonical location.

## Before and after

`docs/screenshots/map/compare/` holds contact sheets of the canonical rooms before and after the room-kit
pass (`canon-before.jpg`, `canon-after.jpg`), taken from the real build at the same positions.

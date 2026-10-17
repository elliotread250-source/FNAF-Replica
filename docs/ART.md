# Art direction

Grimy family restaurant after closing. Checkerboard floors, confetti walls, water-stained ceiling tiles,
CRT monitors, one desk fan. Deep blacks, sickly green and teal in the shadows, warm tungsten from bulbs,
cold white from the door lights, red for warnings. Most of the screen is dark most of the time: light is a
resource, so the scenes make you spend it to see.

Nothing is downloaded. Every model is primitives, every texture is drawn on a canvas at load, every sound
is synthesised. See `client/src/render`.

## Texture generators (`client/src/render/textures.ts`)

| Generator | What it draws |
|---|---|
| `checkerFloor(seed)` | 8x8 black and white tiles, grout lines, scuffs, grime; plus a Sobel-derived normal map and a roughness map |
| `confettiWall(seed, base)` | coloured confetti over a base colour, a dark wainscot band, water streaks |
| `tileWall(seed, base)` | restroom/kitchen tiles with grout and grime |
| `ceilingTiles(seed)` | drop-ceiling panels with speckle and brown water stains |
| `metalTex(seed, kind, base)` | scratched, brushed or rusted metal with rivets; height map turned into normal + roughness |
| `furTex(colour, seed, wear)` | base noise plus thousands of strand streaks; matching normal map; wear adds grime |
| `woodTex`, `curtainTex`, `circuitTex`, `stripesTex` | desk and stage wood, starred cove curtains, PCB traces and chips, warning stripes |
| `posterTex(kind)` | the band poster, the leader poster (with the honkable nose), staff rules, crayon drawings, the eyeless variant |
| `newspaperTex(headline, body)` | yellowed clipping with a blackletter masthead, readable when zoomed |
| `bibTex`, `signTex`, `dirtTex`, `glowSprite` | Chica's bib, signs ("SORRY! OUT OF ORDER"), grime overlay, the soft sprite for sparks and dust |

## Characters (`client/src/render/characters`)

`endo.ts` builds the parametric endoskeleton every character wears: gunmetal frame, spine and ribs, ball
joints with servo housings and screws, four-fingered hands, a jaw on hydraulic pistons with metal teeth,
eyes on stalks, circuit boards in the skull and chest, a battery with a blinking LED, colour-coded wire
bundles following sagging Catmull-Rom curves with cable ties, and frayed copper ends where sparks come from.

`build.ts` dresses it: bear, rabbit, bird, fox, puppet, humanoid, clown, blob, small and spider bodies from
spheres, capsules, cones and boxes, with props (microphone, guitar, cupcake with candle and eyes, hook,
balloon, banjo, tambourine, tray, telescope), hats and bow ties. Eyes are clearcoat spheres with emissive
pupils, so in a dark room only the pupils survive the tone mapping and bloom: Freddy in a corner is two
pinpoints. Withered characters lose costume pieces to show the endo; phantoms glow faintly; shadows are
flat black with white eyes; toys are clearcoat plastic. The x-ray view (Archives) swaps the costume for a
15% blue Fresnel shell and lights the wiring.

## Lighting

Physical light units throughout. The office: a dim warm bulb on a cord (shadow casting, swings after door
slams), a faint monitor glow, red and white button LEDs. Door lights are cold white spots mounted outside
and to the side, so whatever stands in the blind spot is half lit and throws a shadow across the doorway,
plus a volumetric cone (additive shader, fades from the apex and at grazing angles, noise for dust) and
drifting dust motes. Camera rooms each get their own rig: three dimmed coloured stage spots, a flickering
pendant over the dining tables, a purple spot on the cove curtains, dead and flickering hall fluorescents,
a bare bulb swinging on its cord backstage, string lights in the party rooms, the arcade cabinet's glow,
plus the camera's own harsh IR lamp so silhouettes read.

## Post-processing

Office: bloom (high threshold: eyes, lamps, LEDs), grain, vignette, a touch of chromatic aberration, a
danger pulse, and hallucination uniforms (red tint, wobble, aberration). Camera feeds render at 15 fps into
a 640x480 target and go through a CRT shader: barrel distortion, scanlines, phosphor mask on High, grain,
a rolling band, sync jitter, tint per tablet skin, ghost monochrome blue, and static for camera switches,
movement glitches and failures.

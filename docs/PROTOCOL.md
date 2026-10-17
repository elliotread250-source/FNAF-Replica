# Socket protocol

Every message is validated with zod (`shared/src/protocol/messages.ts`). A socket that sends three
malformed messages is disconnected. Sockets authenticate with the same `fr_session` cookie as REST.

## Client → server

| Event | Payload | Notes |
|---|---|---|
| `lobby:create` | `{ mode, night, options? }` | ack `{ code }` |
| `lobby:join` | `{ code }` | ack `{ code }` or `{ error }` |
| `lobby:quick` | `{}` | joins the fullest public Night Shift lobby you've unlocked, or makes one |
| `lobby:list` | `{}` | ack `{ lobbies }` (public, waiting) |
| `lobby:leave` | `{}` | |
| `lobby:station` | `{ station }` | host can take a station from someone |
| `lobby:ready` | `{ ready }` | |
| `lobby:settings` | `{ mode?, night?, customAi?, puppet?, extended?, options? }` | host only; the 12-active cap is enforced |
| `lobby:puppeteer` | `{ userId }` | host only, Showtime |
| `lobby:kick` | `{ userId }` | host only |
| `lobby:skin` | `{}` | re-read equipped cosmetics after a Locker Room change |
| `lobby:start` | `{}` | host only; everyone else must be ready |
| `input` | `{ seq, input }` | see Inputs below; 20 per second hard cap |
| `look` | `{ yaw }` | accepted, currently unused |
| `chat` | `{ text }` | 120 chars, 1 per second |
| `callout` | `{ id }` | 0..7 |
| `voice:signal` | `{ to, data }` | relayed to `to` if in the same lobby |
| `voice:speaking` | `{ on }` | relayed to the lobby |
| `resume` | `{ lobbyCode, lastAckTick }` | re-sends `night:start` if a night is running |
| `ping:clock` | `{ t0 }` | answered with `pong:clock` |

### Inputs

`door {door, closed}`, `light {door, on}`, `tablet {up}`, `camera {node}`, `ping {node}`,
`tool {tool: flashlight|mic|mask|wind|panel, on}`, `tool {tool: reboot, system}`, `tool {tool: lure, node}`,
`tool {tool: boost, station}`, `nose`, `vote_mute`, `locker_click`, `showtime_move {anim, node|door}`,
`showtime_ability {ability, station}`. The server also injects `disconnect`/`reconnect` for autopilot.

## Server → client

| Event | Payload |
|---|---|
| `lobby:state` | the whole lobby (players, stations, equipped skins, options, Custom Night settings) |
| `lobby:error` | `{ code, message }` |
| `night:start` | `{ seed, mode, night, map, hourSeconds, you, role, stations, startsAt, tick, call, custom, extended }` |
| `snap` | `{ tick, ack, v?, t, drain, ev }` |
| `night:end` | `{ result, mode, night, hour, power, team, you, rewards }` |
| `chat`, `callout` | `{ from, fromId, text, ghost? }` |
| `voice:signal` | `{ from, data }` |
| `voice:speaking` | `{ from, on }` |
| `pong:clock` | `{ t0, t1 }` |
| `server:notice` | `{ text }` |

### Snapshots

The server ticks at 20 Hz. Each client gets a `snap` when its filtered view changed, when it has events,
or once a second. `v` is that player's view (`viewFor()` in `shared/src/sim/view.ts`): public state
(power, time, every door, every station's alive/tablet flags, music box, failures, pings) plus only the
animatronics this player can perceive: the room on their active camera, their own office, their lit
doorways, and the west hall under the flashlight. Ghosts get everything. `ack` is the highest input
`seq` applied, which clears the client's optimistic door, light, tablet and camera predictions. `ev` is
that tick's events addressed to this player (sounds, jumpscares, stings, pings, 6 AM).

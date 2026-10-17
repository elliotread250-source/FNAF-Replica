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

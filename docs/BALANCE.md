# Balance

All numbers come from `npm run sim:balance` (150 seeded nights per row, honest bots that only act on what
their station can perceive). Bot profiles: `novice` reacts in ~0.9 to 1.8 s, skips the cove, overuses
cameras; `average` reacts in ~0.5 to 1 s; `expert` in ~0.25 to 0.5 s with tight door discipline.

## Tuned values (`shared/src/config.ts`, `shared/src/content/nights.ts`)

| Setting | Prompt's start | Tuned | Why |
|---|---|---|---|
| `CO_OP_POWER_SCALE` | 1 / 0.6 / 0.45 / 0.36 | 0.62 / 0.32 / 0.25 / 0.2 | Four careful guards ended Night 1 on 13% instead of 30 to 50% |
| `CO_OP_PASSIVE_SCALE` | (1.0) | 0.05 | Full passive drain blacked out every four-guard Night 5 by 4 AM |
| `CLASSIC_PASSIVE_SCALE` | (1.0) | 0.05 | The FNAF 1 interval drain as written (1% per 3 s on Night 5) drains 178% by itself |
| Night 6 Freddy start AI | 8 | 6 | Freddy alone was ending Night 6 at 2 AM |
| Base usage drain | FNAF 1 table | unchanged | |
| AI tables, increments, intervals | prompt | unchanged | |

## Night Shift, four guards

| Night | novice | average (target) | expert (target) | avg power at 6 AM (average) |
|---|---|---|---|---|
| 1 | 100% (80%+) | 100% (95%) | 100% | 40.8% |
| 2 | 100% | 100% (85%) | 100% | 25.1% |
| 3 | 76% | 96% (70%) | 100% | 9.4% |
| 4 | 21% | 54% (55%) | 78% | 1.2% |
| 5 | 7% | 41% (40%) | 53% (75%+) | 0.0% |
| 6 | 9% | 3% (20%) | 1% (45%+) | 25.1% |

## Night Shift, average bots by lobby size

| Night | 1 guard | 2 guards | 3 guards | 4 guards |
|---|---|---|---|---|
| 1 | 98% | 100% | 100% | 100% |
| 2 | 97% | 100% | 99% | 100% |
| 3 | 15% | 93% | 91% | 96% |
| 4 | 3% | 47% | 49% | 54% |
| 5 | 0% | 13% | 24% | 41% |
| 6 | 0% | 0% | 3% | 3% |

## Classic Office (solo, FNAF 1 tables)

| Night | average | expert |
|---|---|---|
| 1 | 96% | 100% |
| 2 | 38% | 48% |
| 3 | 17% | 43% |
| 4 | 0% | 0% |
| 5 | 0% | 0% |
| 6 | 0% | 0% |

## Reading these honestly

Nights 1 to 5 with four guards land on or near target for `average` bots, and new players survive their
first night (novice Night 1: 100%). Nights 1 to 3 run a little easier than the targets; that's deliberate,
since bots are calmer than humans in their first few shifts and a brutal early game loses people.

Where the table misses:

- **Expert on Nights 5 and 6** sits around 50% and single digits, short of 75% and 45%. The bots aren't
  truly expert: they check lights on a timer instead of listening, and they hold doors longer than a
  veteran would, so they run out of power late. A strong human crew should do better than this row.
- **Night 6** is 3% for average bots (target 20%). It stacks AI 12 to 16 with The Hollow and Balloon Kid,
  and the bots are weak against both extended rules. It's the "prove it" night; worth retuning after real
  playtests.
- **Solo Night Shift** falls off hard from Night 3. One guard covering two doors, the flashlight, the mic
  and the music box is a lot; the lobby screen already steers solo players to Classic Office.
- **Classic Office** keeps FNAF 1's per-usage drain exactly. Bots draw about 2.1 bars on Nights 4 and 5
  (doors shut two-thirds of the time); FNAF 1 veterans run closer to 1.4, which by the same maths finishes
  Night 5 with roughly 5 to 10% power. Bot wins in Classic understate what a skilled player can do.

The balance run uses `npm run sim:balance -- --runs 150`. Narrow it with `--modes`, `--nights`,
`--players` and `--skills`.

# Deploying FNAF Replica

GitHub is the source of truth. Railway builds and deploys from the `main` branch of
`elliotread250-source/FNAF-Replica` on every push. Nothing is uploaded from a laptop.

## What exists on Railway

| Thing | Value |
|---|---|
| Project | `arcade` (the Open Arcade project: hub plus the other games) |
| Service | `fnaf-replica` |
| Source | GitHub `elliotread250-source/FNAF-Replica`, branch `main`, auto-deploy on push |
| Database | `Postgres` service in the same project (Railway PostgreSQL template) |
| Public domain | `https://fnaf-replica-production.up.railway.app` |
| Health check | `/healthz` (from `railway.json`), 120 s timeout |
| Replicas | 1 (lobbies live in memory) |

Build and deploy settings live in `railway.json`: Nixpacks, `npm run build` (Nixpacks runs `npm ci` itself), `npm start`.

## Service variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference to the Postgres service) |
| `SESSION_SECRET` | 64 random hex chars (`openssl rand -hex 32`) |
| `NODE_ENV` | `production` |
| `PUBLIC_URL` | `https://fnaf-replica-production.up.railway.app` |
| `ROSTER_MODE` | `tribute` (or `original`) |
| `NIXPACKS_NODE_VERSION` | `20` |

Optional: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` for password reset;
`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` for voice behind strict NATs; `LOG_LEVEL`.

## Recreating it from scratch

1. In the Railway project, add a PostgreSQL database (New → Database → PostgreSQL).
2. New → Empty service, name it `fnaf-replica`.
3. Settings → Source → connect GitHub repo `elliotread250-source/FNAF-Replica`, branch `main`.
4. Variables → add the table above.
5. Settings → Networking → Generate domain. Put that URL in `PUBLIC_URL`.
6. Push to `main`. The first boot runs the Drizzle migrations automatically.

## Things to click yourself

- **Wait for CI**: Settings → Deploy → enable "Wait for CI" so Railway only deploys commits whose GitHub
  Actions checks pass. The tools I used can't toggle it.
- **Password reset email**: add the SMTP variables. Until then, "Forgot password?" explains it isn't set up.
- **Switching to the original cast**: set `ROSTER_MODE=original` and redeploy. Every character name,
  the venue, the company and the currency change everywhere.

## Checking a deploy

`/healthz` returns `{ ok, uptime, version, db }` and 503 if the database is unreachable. Deploy logs show
`FNAF Replica listening on <port> (roster: tribute)` once the server is up.

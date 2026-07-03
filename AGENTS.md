# AGENTS.md

## Project
Office Watch — simulated office device monitor with live web dashboard +
Discord bot, single SQLite source of truth. See README.md for full spec.

## Architecture (do not change without explicit approval)
[Simulator] --writes--> [SQLite] <--reads/writes-- [Next.js API routes]
                                         |
                          -----------------------------
                          |                           |
                  [Dashboard, SWR polling]   [Discord bot, separate process]

## Repo structure
/app or /src         → Next.js app (API routes + dashboard UI)
/simulator            → standalone simulator.js, writes to SQLite directly
/bot                  → standalone discord.js bot, talks only to Next.js API
/data                 → office.db (gitignored, generated at runtime)
/docs                 → system diagram, Wokwi schematic exports (manual, not code)

## Hard constraints
- JavaScript only, no TypeScript.
- Tailwind CSS only — no CSS Modules, no styled-components.
- SWR polling for live updates — no WebSockets/Socket.IO.
- better-sqlite3, synchronous, WAL mode enabled.
- Bot never touches the DB directly — REST API only.
- Simulator never imports Next.js code — DB file is the only shared boundary.

## Data model
Devices table: id, room, type, name, status, power_draw, last_changed
Fixed device set: 18 total (3 rooms × 2 fans × 3 lights), IDs like DR_F1, WR1_L2.

## Alert rules (implement all three, they are distinct)
1. Device-level: single device ON with last_changed > 2hrs ago
2. Room-level: ALL devices in a room ON AND all > 2hrs continuously
3. After-hours: any device ON outside OFFICE_HOURS_START–OFFICE_HOURS_END

## Environment variables (see .env.example)
DATABASE_PATH, NEXT_PUBLIC_APP_URL, DISCORD_BOT_TOKEN, DISCORD_ALERT_CHANNEL_ID,
DISCORD_CLIENT_ID, GEMINI_API_KEY, GEMINI_MODEL, SIMULATOR_TICK_INTERVAL_MS,
OFFICE_HOURS_START, OFFICE_HOURS_END

## Workflow rules
- Work in phases: DB schema → simulator → API routes → dashboard → bot commands
  → bot proactive alerts (bonus).
- After each phase is verified working, stage relevant files and present the
  diff + a proposed conventional-commit message. WAIT for explicit approval
  before running `git commit` — never commit autonomously.
- Ask before adding a dependency not already agreed on.
- Ask before choosing exact colors/spacing/copy — offer options instead.
- Never generate Wokwi/Tinkercad project files — that's a manual step outside this repo.

## Style reference
Dashboard theme takes visual cues from a smart-home app screenshot (provided
separately) — warm off-white background, orange/coral accents for ON states,
rounded cards, pill-shaped nav buttons. Tailwind utility classes throughout.
Not a literal layout clone.

## .gitignore must include
node_modules/
.env
data/office.db
.next/
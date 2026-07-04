# Office Watch: Lights, Fans, Discord

A real time office device monitoring system built for the Techathon 2026 Nationals & Rover Summit preliminary round. It tracks the on/off state and power draw of every light and fan across a simulated 3 room office, and exposes that data through a live web dashboard and a Discord bot, both reading from a single shared backend.

## a. Problem Statement Understanding

The brief ("Lights, Fans, Discord: The Boss's Big Idea") asks for a system that solves a simple but real office problem: people leave lights and fans running after hours, and nobody notices until the electricity bill arrives.

The fixed scope is:

1. 3 rooms: Drawing Room, Work Room 1, Work Room 2
2. 5 devices per room (2 fans + 3 lights), giving 15 devices total
3. Device state must be simulated but dynamic, meaning it changes over time
4. Two consumer facing interfaces, a web dashboard and a Discord bot, that must both reflect the exact same live data. They cannot maintain separate copies of state; there must be one backend as the single source of truth.

This repo implements that system end to end: a simulator that mutates device state over time, a SQLite database as the persistent store, a Next.js API layer as the shared backend, a live updating dashboard, and a Discord bot with natural language replies.

## b. Solution Approach and Architecture

### High level data flow

```
[Simulator (simulator.js)]
        |  writes device status/power/timestamp
        v
   [SQLite Database]  <-- lib/db.js
        |  read only queries
        v
 [Backend API — Next.js Route Handlers]  <-- lib/office-api.js
        |                              |
        v                              v
 [Web Dashboard]                [Discord Bot]
 (Next.js + SWR polling)     (discord.js + Gemini)
        |                              |
        v                              v
      Boss (browser)              Boss (Discord)
```

### Why this design

1. Single source of truth. `simulator.js` is the only process that writes to the database. Both the dashboard's API routes and the Discord bot only ever read through `lib/office-api.js`. This guarantees the dashboard and bot can never drift out of sync with each other, satisfying the architecture requirement directly.

2. Simulator as an independent, continuously running process. Rather than generating fake data on each API request, which would make "last changed" and "on for over 2 hours" alerts impossible to compute meaningfully, the simulator runs continuously in the background on a fixed tick interval (`SIMULATOR_TICK_INTERVAL_MS`, default 7 seconds) and persists real state transitions with real timestamps to SQLite. This makes time based alert logic (after hours, two hour continuous use) behave correctly and consistently across both interfaces.

3. A seeded "stuck on" device. The simulator deliberately seeds one device (`DR_F1`, Drawing Room Fan 1) as ON with a `last_changed` timestamp 3 hours in the past at startup. This guarantees at least one alert condition is demonstrable immediately during a demo, without needing to wait for random chance.

4. Next.js API routes as the backend. Rather than standing up a separate backend service, the same Next.js app serves both the dashboard pages and the JSON API (`/api/devices`, `/api/rooms/[name]`, `/api/usage`, `/api/alerts`). This keeps the single backend requirement trivially true and avoids CORS and deployment complexity for a hackathon timeline.

5. SWR polling for live dashboard updates. The dashboard uses `swr` to refetch API data on an interval, so the UI updates without a manual page refresh, without needing a WebSocket server.

6. AI humanized Discord replies with a safe fallback. The bot always computes a real, data backed summary first, then optionally asks Gemini to phrase it conversationally. If `GEMINI_API_KEY` is missing or the Gemini call fails for any reason, the bot falls back to a plain text templated reply instead of failing, so the bot is never dependent on a third party API being available to function.

## c. Technologies Used

1. Frontend and Dashboard: Next.js 16 (App Router), React 19, Tailwind CSS 4
2. Live data fetching: SWR (polling based revalidation)
3. Backend API: Next.js Route Handlers (`app/api/**/route.js`)
4. Database: SQLite via `better-sqlite3`
5. Simulator: Node.js script (`simulator.js`), interval based state mutator
6. Discord Bot: `discord.js` v14
7. Conversational AI: Google Gemini (`@google/generative-ai`, model `gemini-1.5-flash` by default)
8. Config: `dotenv`

## d. Setup and Installation Instructions

### Prerequisites

1. Node.js v18 or higher
2. A Discord account and a Discord server you can add a bot to
3. Optionally, a Google Gemini API key, for conversational bot replies

### 1. Clone the repository

```bash
git clone https://github.com/Imtiaz-Fuad/Techathon2026-W.git
cd Techathon2026-W
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your `.env` file

Create a file named `.env` in the project root with the following variables:

```
DATABASE_PATH=./data/office.db
NEXT_PUBLIC_APP_URL=http://localhost:3000

DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_client_id
DISCORD_ALERT_CHANNEL_ID=your_alert_channel_id

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

SIMULATOR_TICK_INTERVAL_MS=7000
OFFICE_HOURS_START=9
OFFICE_HOURS_END=17
```

`GEMINI_API_KEY` is optional. If left blank, the Discord bot automatically falls back to plain text templated replies instead of LLM generated ones.

### 4. Set up the Discord bot application

1. Go to the Discord Developer Portal and choose New Application
2. Under Bot, click Reset Token and copy it into `DISCORD_BOT_TOKEN`
3. Under Bot, Privileged Gateway Intents, enable Message Content Intent and save
4. Under OAuth2, General, copy the Client ID into `DISCORD_CLIENT_ID`
5. Under OAuth2, URL Generator, check scope `bot`, and permissions Send Messages, Read Message History, View Channels
6. Open the generated URL in a browser and add the bot to your test server
7. In Discord, enable Developer Mode under User Settings, Advanced, then right click your alert channel and choose Copy Channel ID, then paste it into `DISCORD_ALERT_CHANNEL_ID`

### 5. Initialize the database

```bash
npm run db:init
```

## e. How to Run the Application

The system requires three continuously running processes at the same time, each in its own terminal.

Terminal 1, device simulator (continuously mutates device state):

```bash
npm run simulate
```

Terminal 2, backend and web dashboard:

```bash
npm run dev
```

Then open http://localhost:3000

Terminal 3, Discord bot:

```bash
npm run bot
```

All three should be left running simultaneously. The simulator is the data source, the dashboard and backend serve it over HTTP, and the bot polls the same backend on demand.

### Testing the Discord bot

In your Discord server, try:

```
!status
!room Drawing Room
!room Work Room 1
!room Work Room 2
!usage
!help
```

## f. API Endpoints Documentation

All endpoints are read only `GET` requests served from the Next.js app at `NEXT_PUBLIC_APP_URL` (default `http://localhost:3000`).

### GET /api/devices

Returns a flat array of all 15 devices.

```json
[
  {
    "id": "DR_F1",
    "room": "Drawing Room",
    "type": "fan",
    "name": "Fan 1",
    "status": true,
    "power_draw": 60,
    "last_changed": "2026-07-04T10:15:00.000Z"
  }
]
```

### GET /api/rooms/:name

Returns a snapshot for a single room. `:name` must exactly match a room name (`Drawing Room`, `Work Room 1`, or `Work Room 2`), URL encoded.

```json
{
  "room": { "name": "Drawing Room", "code": "..." },
  "summary": {
    "device_count": 5,
    "on_count": 3,
    "off_count": 2,
    "total_wattage": 165,
    "all_on": false,
    "all_on_for_over_2_hours": false
  },
  "devices": [ /* device objects, same shape as /api/devices */ ]
}
```

Returns `404` with `{ "error": "Room not found" }` if the name doesn't match.

### GET /api/usage

Returns total and per room power consumption.

```json
{
  "total_wattage": 740,
  "estimated_kwh_today": 17.76,
  "room_breakdown": [
    {
      "room": { "name": "Drawing Room", "code": "..." },
      "device_count": 5,
      "on_count": 3,
      "total_wattage": 165
    }
  ],
  "generated_at": "2026-07-04T10:15:00.000Z"
}
```

Note: `estimated_kwh_today` is calculated as `(current total wattage × 24) / 1000`, a projection assuming the current load holds for 24 hours, not a true accumulated meter reading.

### GET /api/alerts

Returns three categories of active alerts.

```json
{
  "generated_at": "2026-07-04T10:15:00.000Z",
  "office_hours": { "start": 9, "end": 17 },
  "device_alerts": [
    { "kind": "device", "reason": "device_on_over_2_hours", "timestamp": "...", "last_changed": "...", "device": { /* device */ } }
  ],
  "room_alerts": [
    { "kind": "room", "reason": "room_all_on_over_2_hours", "timestamp": "...", "since": "...", "room": { /* room */ }, "devices": [ /* devices */ ], "total_wattage": 165 }
  ],
  "after_hours_alerts": [
    { "kind": "after_hours", "reason": "after_hours_on", "timestamp": "...", "device": { /* device */ } }
  ]
}
```

1. `device_alerts`: individual devices ON continuously for more than two hours
2. `room_alerts`: rooms where every device is ON and has been for more than two hours
3. `after_hours_alerts`: any device ON outside office hours, from `OFFICE_HOURS_START` to `OFFICE_HOURS_END` (only populated when the current time is actually outside office hours)

## g. AI Integration Details

Model used: Google Gemini (`gemini-1.5-flash` by default, configurable via `GEMINI_MODEL`), accessed through the official `@google/generative-ai` SDK.

What it's used for: turning structured JSON summaries (device counts, wattage, alert counts) into short, casual, natural sounding Discord replies. The boss "hates robotic data dumps," so raw numbers are never posted directly if the LLM path succeeds.

How it's wired in (`bot/office-bot.js`):

1. The bot first fetches real data from the backend API and reduces it into a compact summary object, for example per room on/off counts and wattage.
2. That summary, never the raw API response, is passed to Gemini inside a prompt instructing it to reply in one or two short, casual sentences with no markdown or JSON.
3. Gemini's text response is sent to Discord unchanged.

No training or finetuning involved. This is prompt based summarization only, using a fixed system instruction per command type (`status`, `room`, `usage`). No user data is used to train or finetune any model.

Fallback behavior: if `GEMINI_API_KEY` is unset, or the Gemini API call throws for any reason such as a rate limit, network failure, or invalid key, the bot automatically falls back to a deterministic, template based text reply built directly from the same summary data. This means the bot's core functionality never depends on the LLM being available; Gemini only affects tone, not correctness.

## Project Structure

```
Techathon2026-W/
├── app/
│   ├── api/
│   │   ├── devices/route.js
│   │   ├── rooms/[name]/route.js
│   │   ├── usage/route.js
│   │   └── alerts/route.js
│   └── ...                  # dashboard pages/components
├── bot/
│   ├── index.js              # Discord client, command router
│   └── office-bot.js         # API calls, summarization, Gemini integration
├── lib/
│   ├── db.js                  # SQLite access layer
│   ├── office.js               # room/device constants
│   └── office-api.js           # shared backend logic (used by API routes)
├── scripts/
│   └── init-db.js
├── simulator.js               # continuous background device-state generator
└── package.json
```

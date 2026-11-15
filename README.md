# PhnomFlood AI

Flood-aware routes for riders in Phnom Penh. Built for the Open Data X AI Venture Hackathon 1.0.

React + Vite · Tailwind CSS · MapLibre GL on OpenStreetMap data · Framer Motion and GSAP ·
Phosphor icons · English and Khmer. One design system, described at the top of `src/index.css`.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run typecheck` checks the TypeScript.

## One codebase, two versions

| Route | What it is |
| --- | --- |
| `#/` | Landing page (`src/landing/`). |
| `#/demo` | **Demo.** Scripted and offline: a fixed storm, mock reports on this device, pre-written verdicts for the four sample photos, and a ride that meets a flood and reroutes on cue. Needs no keys. |
| `#/live` | **Live.** Real services: Open-Meteo rainfall, a real Vision AI check through `api/verify-photo.js`, and reports shared between phones through Supabase. Starts with no reports. Each service says so in the app when it is not set up. |

The mode is chosen by the route (`src/shared/mode.tsx`); the services read it. Keys `0`, `1`,
`2` jump between landing, demo and live while presenting. The old `#/rider` link opens the demo.

## Setting up the live services

Rainfall needs nothing. For the other two, set these in Vercel (Project settings >
Environment Variables) and in `.env` for local development (see `.env.example`):

1. **Photo check:** `GEMINI_API_KEY` from https://aistudio.google.com/apikey. It is read only by
   the server function `api/verify-photo.js` (Vercel runs it; `npm run dev` serves it too), so it
   never reaches the browser. Optional `GEMINI_MODEL`, default `gemini-2.5-flash`.
2. **Shared reports:** create a free Supabase project, run `supabase/schema.sql` in its SQL editor,
   then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is public by design:
   row-level security only lets it read the last 24 hours, add reports inside Phnom Penh, and
   confirm or clear one through two narrow functions. Phones poll for changes every 3 seconds.

Redeploy after changing environment variables.

## 45-second demo script

1. Open `#/demo`. Point at the heavy-rain alert, the dashed red standard route and the green
   dry route.
2. Tap **Start ride**. The map follows the rider. A rider ahead reports deep water, the app
   beeps, recalculates and lays down a new dry route. On arrival a card shows the floods avoided.
3. **Report flood** > **Add a photo for AI depth check** > the stalled-bike photo. The AI
   overrides the preselected ankle depth to waist-deep. **Submit report**.
4. Tap **ខ្មែរ** to show the whole app in Khmer.
5. In the room: show the QR code on the landing page. Anyone who scans it opens the live app; a
   flood they report appears on every screen (needs Supabase set up).
6. Click **Reset** (top right on desktop) before the next take.

## The ride

Both versions can simulate a ride along the active route (`src/rider/hooks/useRide.ts`) at a
labelled speed (at least 20×, so no ride takes over a minute). It pauses while a reroute is
calculated and continues from the rider's spot on the new route. The demo drops one scripted
flood ahead on the active route; the live app only reacts to real reports.

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Map tiles and street geometry | Real: OpenStreetMap via OpenFreeMap. Route lines were computed once with the public OSRM engine and stored in `src/data/routeGeometry.json`. |
| Destinations and street names | Real: 8 of the 11 trips were generated from OSRM routes, with English street, Sangkat and Khan names from OpenStreetMap (Nominatim). |
| Rainfall | Demo: fixed scenario. Live: Open-Meteo, now plus the next three hours. |
| Photo check | Demo: pre-written verdicts. Live: Google Gemini through the server function. |
| Flood reports | Demo: mock data (`src/data/seed.js`). Live: real reports, shared when Supabase is set up. |
| The ride | Simulated in both versions. |
| Route ETAs | Illustrative values (`src/data/routes.js`). |
| Landing page figures | Sourced: MPWT via AKP (vehicle registrations, 2024), DWD climate normals (rainfall), STT "The Last Lakes" (2019). |

## Installable

`public/manifest.webmanifest` and `public/sw.js` make the app installable from the browser menu.
The service worker only runs in production builds, fetches pages from the network first, and
never caches map tiles, weather, `/api` or Supabase.

## Khmer

`src/i18n/index.tsx` holds every rider-app string in English and Khmer; the choice is saved per
device. The Khmer was written for this prototype: have a native speaker review it before launch.

## Credits

- Map data © OpenStreetMap contributors (ODbL). Routing geometry via OSRM. Tiles by OpenFreeMap © OpenMapTiles.
  Rainfall by Open-Meteo.
- Demo photos in `public/scenarios/`: Biplab Sau, Lâm Trần and Dibakar Roy on Pexels; dry street by
  Kiensvay on Wikimedia Commons, CC BY-SA 3.0 (resized).

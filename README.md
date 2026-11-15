# PhnomFlood AI — MVP prototype

Hyper-local flash-flood routing and micro-drainage intelligence for Phnom Penh.
Built for the Open Data X AI Venture Hackathon 1.0.

React + Vite · Tailwind CSS · MapLibre GL on OpenStreetMap data · Framer Motion · Lucide icons.
Both views share one dark design system (see the top of `src/index.css`).
No API keys and no database: it runs entirely in the browser.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## The two screens

Press `0` for the landing page or `1` for the rider app.

1. **Landing page** (`src/landing/`, TypeScript) - the front door: how the app reads flood
   depth, what it does on the road, and what is real versus simulated.
2. **Rider app** (`src/rider/`, TypeScript) - eleven saved destinations, a full-screen dark map with a turn banner,
   flood segments drawn on the roads, vehicle-specific safe routing, a two-detent bottom
   sheet (route comparison, nearby reports) and a two-tap "Report flood" drawer with an
   optional Vision AI photo check. On a phone it fills the screen; on a desktop it is
   shown as a device. Run `npm run typecheck` to check types.

**Reset demo** (top right on desktop) restores the starting data.

## 45-second demo script

1. Rider app: point at the dashed red standard route (blocked on St. 289), the green
   safe route and the "Dry route" badge in the turn banner.
2. Tap **Car** and back to **Motorbike** to show the routing change. Drag the sheet up
   to compare routes by time and flood exposure.
3. **Report flood** -> **Add a photo for AI depth check** -> pick the **Stalled bike**
   photo. The AI overrides the preselected Ankle depth to Impassable (waist-deep). **Submit report**.
   (Optional: show **Dry street** being rejected first. Without a photo, Report -> Submit is two taps.)
4. Watch the new red pin drop, the "New flood detected ahead" banner, and the route shift.
5. Click **Reset demo** before the next take.

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Map tiles and street geometry | Real: OpenStreetMap. Route lines were pre-computed once with the public OSRM engine and stored in `src/data/routeGeometry.json`. |
| Flood pins and rider counts | Mock data (`src/data/seed.js`). |
| Basemap | Real: OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data), restyled dark. |
| Destinations and street names | Real: 8 of the 11 trips were generated from OSRM routes, with English street, Sangkat and Khan names from OpenStreetMap (Nominatim). |
| Route ETAs | Illustrative values (`src/data/routes.js`). |
| Vision AI verdict | The four demo photos have fixed, pre-written verdicts (simulated). They never read the user's depth, so the AI can confirm, correct or reject. Your own uploads go to Gemini if `VITE_GEMINI_API_KEY` is set (see `.env.example`); without a key they are filed as unverified. |
| Rainfall alert | Fixed demo scenario (`src/services/weather.js`). A live Open-Meteo fetch is included but unused. |
| Khan / Sangkat names for new reports | Approximate (`src/data/gazetteer.js`). |

## Where to plug in real services

- **Supabase** → `src/services/api.js` (load/save state; table sketch in the file).
- **Gemini Vision** → already wired in `src/services/visionAI.js`; add a key to `.env`.
  For a public deployment, move the call to a server or Edge Function.
- **Live routing** → `src/lib/routing.js` (swap the preset candidates for engine responses).
- **Live rainfall** → `src/services/weather.js`.

## Credits

- Map data © OpenStreetMap contributors (ODbL). Routing geometry via OSRM. City-view tiles by OpenFreeMap © OpenMapTiles.
- Demo photos in `public/scenarios/` (Wikimedia Commons): flooded street by Albeiro Rodas,
  CC BY-SA 3.0 (cropped); shallow water by Julie Rigsby, CC BY 2.0; dry street by Kiensvay,
  CC BY-SA 3.0 (resized).

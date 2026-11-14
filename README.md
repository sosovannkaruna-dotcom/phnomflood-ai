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

## The two views

Switch with the buttons in the top bar, or press `1` / `2`.

1. **Rider app** (`src/rider/`, TypeScript) — a full-screen dark map with a turn banner,
   flood segments drawn on the roads, vehicle-specific safe routing, a two-detent bottom
   sheet (route comparison, nearby reports) and a two-tap "Report Flood" drawer with an
   optional Vision AI photo check. On a phone it fills the screen; on a desktop it is
   shown as a device.
2. **City command center** — a full-screen dark map with floating panels. Three views:
   - *Live Telemetry*: Khan (district) runoff risk, sensor nodes, citizen flood reports.
   - *24h Forecast*: a timeline from -6 h to +24 h that updates the map and every number.
   - *Drainage & Basins*: low-elevation basins and the storm-drain ticket queue with dispatch.
   The left panel inspects the city or one Khan; the right panel is a scripted analyst.
   Code lives in `src/command/` (TypeScript). Run `npm run typecheck` to check types.

Both views share one store, so a report filed in the phone appears on the
dashboard at once. **Reset demo** (top right) restores the starting data.

## 45-second demo script

1. Rider app: point at the dashed red standard route (blocked on St. 289), the green
   safe route and the DRY ROUTE badge in the turn banner.
2. Tap **Car** and back to **Motorbike** to show the routing change. Drag the sheet up
   to compare routes by time and flood exposure.
3. **REPORT FLOOD** → **Add a photo for AI depth check** → pick the **Flooded street**
   photo. The AI overrides the preselected Ankle depth to Knee-Deep. **SUBMIT TELEMETRY**.
   (Optional: show **Dry street** being rejected first. Without a photo, Report → Submit is two taps.)
4. Watch the new red pin drop, the "New flood detected ahead!" toast, and the route shift.
5. Press `2`: the city view shows the new report on the map. Open **Drainage & Basins**
   to see the new ticket and click **Dispatch Pump / Cleanup Crew**. Click a Khan, scrub
   the **24h Forecast** timeline, and ask the analyst a question.
6. Click **Reset demo** before the next take.

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Map tiles and street geometry | Real: OpenStreetMap. Route lines were pre-computed once with the public OSRM engine and stored in `src/data/routeGeometry.json`. |
| Flood pins, queue, KPI numbers | Mock data (`src/data/seed.js`). |
| Route ETAs | Illustrative values (`src/data/routes.js`). |
| Vision AI verdict | The three demo photos have fixed, pre-written verdicts (simulated). They never read the user's depth, so the AI can confirm, correct or reject. Your own uploads go to Gemini if `VITE_GEMINI_API_KEY` is set (see `.env.example`); without a key they are filed as unverified. |
| Command-center telemetry (rainfall, saturation, drain load, river level, sensors, risk scores) | Simulated by a small deterministic model in `src/command/data/hydrology.ts`. River alarm/flood stages are approximate reference values. |
| Khan boundaries | Real: OpenStreetMap, fetched once via Nominatim and simplified (`src/command/data/khans.geo.json`). |
| City-view basemap | Real: OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data), restyled dark. |
| Analyst panel | Scripted. No AI model is called; briefings are assembled from the simulated telemetry (`src/command/data/analyst.ts`). |
| Rainfall alert | Fixed demo scenario (`src/services/weather.js`). A live Open-Meteo fetch is included but unused. |
| Elevation "bowl" zones | Hand-drawn illustrative outlines, not derived from SRTM yet. |
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

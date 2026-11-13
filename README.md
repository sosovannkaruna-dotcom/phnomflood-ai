# PhnomFlood AI — MVP prototype

Hyper-local flash-flood routing and micro-drainage intelligence for Phnom Penh.
Built for the Open Data X AI Venture Hackathon 1.0.

React + Vite · Tailwind CSS · Leaflet with OpenStreetMap tiles · Lucide icons.
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

1. **Citizen & Rider App** — a Telegram Mini App inside a phone frame: live flood
   map, vehicle-specific safe routing, and "Report Flood" with a Vision AI check.
2. **Municipal Command Center** — KPI cards, the micro-drainage and elevation risk
   map with layer toggles, and the AI dispatch queue.

Both views share one store, so a report filed in the phone appears on the
dashboard at once. **Reset demo** (top right) restores the starting data.

## 45-second demo script

1. Citizen view: point at the dashed red standard route (blocked on St. 289) and
   the green safe route (+3 mins, dry streets).
2. Switch vehicle to **Car / SUV** and back to **Motorbike** to show the routing change.
3. **Report Flood** → **Use Current Pin** → tap **Ankle-Deep** → pick the **Flooded street**
   photo. The AI overrides the claim to Knee-Deep. Submit.
   (Optional: show **Dry street** being rejected first.)
4. Watch the new red pin drop, the "New flood detected ahead!" toast, and the route shift.
5. Press `2`: the dashboard shows the new hotspot, a new flagged grate and a new
   queue card. Click **Dispatch Pump / Cleanup Crew**.
6. Click **Reset demo** before the next take.

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Map tiles and street geometry | Real: OpenStreetMap. Route lines were pre-computed once with the public OSRM engine and stored in `src/data/routeGeometry.json`. |
| Flood pins, queue, KPI numbers | Mock data (`src/data/seed.js`). |
| Route ETAs | Illustrative values (`src/data/routes.js`). |
| Vision AI verdict | The three demo photos have fixed, pre-written verdicts (simulated). They never read the user's depth, so the AI can confirm, correct or reject. Your own uploads go to Gemini if `VITE_GEMINI_API_KEY` is set (see `.env.example`); without a key they are filed as unverified. |
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

- Map data © OpenStreetMap contributors (ODbL). Routing geometry via OSRM.
- Demo photos in `public/scenarios/` (Wikimedia Commons): flooded street by Albeiro Rodas,
  CC BY-SA 3.0 (cropped); shallow water by Julie Rigsby, CC BY 2.0; dry street by Kiensvay,
  CC BY-SA 3.0 (resized).

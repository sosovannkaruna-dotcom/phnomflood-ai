---
version: 1
slug: "src-judge-judgemode-tsx"
primary_target: "src/judge/JudgeMode.tsx"
related_targets: []
---

## Scope

Judge demo mode: a hidden full-screen stage view (Shift+D anywhere, Esc closes) for the live pitch on a laptop or projector. Mode: Experience (the audience watches; the presenter presses one button). Uses only its own simulated data; never touches the live map or the demo store.

## Audience and job

Hackathon judges watching a projector from a distance. Within 45 seconds they must see, without explanation, that a normal GPS drives a motorbike into deep water while PhnomFlood steers around it, and that the warning came from a forecast plus a rider's Telegram photo. Every simulated or estimated value is labelled as such.

## Direction contract

THESIS: Two riders, one storm, one start, side by side: the difference between the two maps is the argument. Refuses the slide-deck habit of stats, cards and hero numbers; the maps and one event feed carry everything.

OWN-WORLD: The app's Industrial Telemetry, at stage size: Void substrate, two map panes split by a 1px hairline carrying the 4px hazard stripe, square slabs with hairline edges, Archivo heavy for the two pane titles, Geist Mono for every number, clock and caption. Hazard Red only for the Cloudburst action and the stall; sky for water and rain; emerald for the dry arrival.

STORY: Both riders wait at the same start. The presenter presses Cloudburst: the rain gauge climbs to 65 mm/h, forecast water spreads across the PhnomFlood map, a Telegram rider's photo pins 42 cm on the usual road. Both set off; PhnomFlood reroutes before the turn-off, the standard rider rides on, stalls in the water, and PhnomFlood arrives dry.

FIRST VIEWPORT: Top strip with the mode name, a simulated clock and Close. Two equal map panes below, each topped by a 56px header: pane title, status chip, ETA in large mono. Bottom console across the full width: rain gauge column and mm/h reading at left, the red Cloudburst button with its arrow cell, Replay, and the live event feed filling the right half.

FORM: split instrument panel, position 1 of 1. seed: none (pinned) "Side-by-Side / Split Comparison View" with a "Live Storm Simulator" control panel.

Signature interaction: pressing Cloudburst; the gauge fills, forecast water rises frame by frame on the right map only, and the left pane's edge flashes red at the stall.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

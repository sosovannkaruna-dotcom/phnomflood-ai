---
name: PhnomFlood AI
description: Flood-aware routes for riders in Phnom Penh, as a dark industrial-telemetry instrument.
colors:
  hazard-red: "#E8301C"
  hazard-red-hover: "#F03A26"
  flare: "#FF6A55"
  dusk: "#9C98D6"
  dusk-mid: "#5D5AA6"
  dusk-deep: "#131226"
  void: "#0A0A0B"
  slab: "#111113"
  panel: "#0E0E10"
  paper: "#F4F4F5"
  ash: "#A1A1AA"
  smoke: "#71717A"
  hairline: "rgba(255, 255, 255, 0.12)"
  clear: "#10B981"
  caution: "#F59E0B"
  danger: "#EF4444"
  water: "#38BDF8"
typography:
  display:
    fontFamily: "Archivo Variable, Geist Variable, Noto Sans Khmer Variable, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7.4vw, 7rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo Variable, Geist Variable, Noto Sans Khmer Variable, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "Archivo Variable, Geist Variable, Noto Sans Khmer Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 110"
  body:
    fontFamily: "Geist Variable, Noto Sans Khmer Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  body-ui:
    fontFamily: "Geist Variable, Noto Sans Khmer Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  label:
    fontFamily: "Geist Mono Variable, Noto Sans Khmer Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1rem
    letterSpacing: "0.1em"
  numeric:
    fontFamily: "Geist Mono Variable, Noto Sans Khmer Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
    fontFeature: "'tnum' 1"
rounded:
  none: "0"
  full: "9999px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.hazard-red}"
    textColor: "#FAFAFA"
    typography: "{typography.body-ui}"
    rounded: "{rounded.none}"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.hazard-red-hover}"
  button-primary-disabled:
    backgroundColor: "rgba(255, 255, 255, 0.08)"
    textColor: "{colors.smoke}"
  button-outline:
    backgroundColor: "{colors.slab}"
    textColor: "{colors.paper}"
    typography: "{typography.body-ui}"
    rounded: "{rounded.none}"
    height: "48px"
  button-light:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.void}"
    typography: "{typography.body-ui}"
    rounded: "{rounded.none}"
    height: "48px"
  chip:
    textColor: "#D4D4D8"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.hazard-red}"
    textColor: "{colors.paper}"
  chip-dry-selected:
    backgroundColor: "rgba(16, 185, 129, 0.15)"
    textColor: "#34D399"
  input-search:
    backgroundColor: "{colors.slab}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.dusk-deep}"
  panel-tinted:
    backgroundColor: "{colors.dusk-deep}"
    rounded: "{rounded.none}"
  panel:
    backgroundColor: "rgba(14, 14, 16, 0.94)"
    rounded: "{rounded.none}"
  list-row:
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    height: "52px"
---

# Design System: PhnomFlood AI

## Overview

**Creative North Star: "Industrial Telemetry"**

PhnomFlood reads like a field instrument pointed at the city's water. A near-black substrate, solid slabs edged with 1px hairlines, square corners everywhere, and every number set in a monospace face so values line up and never jitter as they update. The landing page and the rider app share one recipe: the landing page states it loudly with huge expanded display type and halftone imagery, the app states it quietly through the same type, rules and colour discipline at working size.

Colour is rationed. One brand accent, Hazard Red, which is also the "impassable" signal, so brand and danger never disagree. One quiet secondary, Dusk, a storm-sky violet that answers the pointer and tints a few surfaces. Everything else that carries colour is data: emerald for clear roads, amber for caution, red for blocked, sky for water. Chrome is zinc greys on near-black. A faint film grain and scan-line texture give the dark surfaces material without decoration.

Motion is a strong ease-out under 300 ms: things arrive instantly and settle. Controls are firm and fast, pressing down to 97% scale with no glow. The only pulsing, glowing elements in the system are hazards and the rider riding through water, so movement itself means "pay attention".

**Key Characteristics:**
- Dark, never pure black (#0A0A0B); one zinc family for every neutral.
- Square corners on everything; only dots, pucks and the start pin are round.
- Archivo heavy and expanded for display, Geist for text, Geist Mono for every number, unit and label.
- One accent (Hazard Red) and one quiet secondary (Dusk); all other colour is semantic road-status data.
- 1px hairlines and gap-grids instead of shadows.
- Firm, fast press states; motion under 300 ms with a strong ease-out.
- Khmer and English are equal: the type system adapts for Khmer script rather than forcing Latin conventions on it.

## Colors

A near-black instrument panel with one hazard-red accent, one storm-dusk secondary, and a strict four-colour data vocabulary.

### Primary
- **Hazard Red** (#E8301C): the single brand accent and the "impassable" signal. Primary call-to-action fills, the selected vehicle chip, the search field's active border, focus rings, text selection, the hazard stripe, and the first landing statistic. Hover lifts it to #F03A26.
- **Flare** (#FF6A55): the same hue lifted for red text on the dark substrate, where Hazard Red would miss AA contrast at small sizes.

### Secondary
- **Dusk** (#9C98D6): the "touch" colour. Hover and pointer feedback (the outline button's hover edge), the scroll-progress hairline, hint text, and row underlines that draw on hover.
- **Dusk Mid** (#5D5AA6): reserved for hairlines in Dusk.
- **Dusk Deep** (#131226): a tinted surface one step off Void: the water-gauge card, and the hover fill of outline buttons.

### Neutral
- **Void** (#0A0A0B): the page and app substrate; also the dark ink on light pins and chips.
- **Slab** (#111113): solid controls and fields sitting on the substrate (outline buttons, the search field, route summary blocks).
- **Panel** (#0E0E10): cells inside hairline grids and the opaque fallback for floating panels.
- **Paper** (#F4F4F5): primary text, the rider puck, destination pin label, and the light secondary button.
- **Ash** (#A1A1AA): secondary text, mono labels, captions, icons at rest.
- **Smoke** (#71717A): disabled text and the faintest metadata.
- **Hairline** (rgba(255,255,255,0.12)): every divider, grid gap and panel edge. Outline buttons use a stronger 25% white edge.

### Semantic (data only)
- **Clear** (#10B981): dry roads, the "dry only" filter, clear routes, confirmed-clear actions.
- **Caution** (#F59E0B): shallow (ankle) water, watch-level warnings, the amber flood flash.
- **Danger** (#EF4444): stalling-depth water on the map, critical warnings, the red flood flash.
- **Water** (#38BDF8): hydrology itself: rain, drainage and water-level readings.

### Named Rules
**The One Accent Rule.** Hazard Red is the only action colour. If something is red, it is either the primary action or a blocked road; never decoration.

**The Dusk Is Touch Rule.** Dusk never marks an action and never marks road status. It appears where the pointer is, or as a quiet tinted surface, and on at most one surface per screen at rest.

**The Data Colours Are Data Rule.** Emerald, amber, red and sky mean road and water status and nothing else. Never use them for branding, illustration or emphasis.

**The No Pure Black Rule.** The darkest colour is Void (#0A0A0B). Neutrals all come from one zinc family.

## Typography

**Display Font:** Archivo Variable, heavy and expanded (with Geist, then Noto Sans Khmer)
**Body Font:** Geist Variable (with Noto Sans Khmer, then system UI)
**Label/Mono Font:** Geist Mono Variable (with Noto Sans Khmer, then ui-monospace)

**Character:** A wide, heavy grotesque shouting headlines like stencilled signage, over a clean neutral sans for reading and a mono that turns every figure into an instrument reading. Noto Sans Khmer sits in every stack so Khmer text matches weight and size.

### Hierarchy
- **Display** (800, clamp(3rem, 7.4vw, 7rem), 0.92, -0.035em, 112% width, balanced wrap): landing hero and closing headline only.
- **Headline** (800, clamp(2.25rem, 5vw, 4.5rem), 0.92): landing section heads, kept to short lines (14–22ch).
- **Title** (800, 110% width, 1.05, -0.03em): titles inside the app (sheets, cards, the arrival card).
- **Body** (400, 16–18px, 1.625): landing paragraphs at 36–58ch; `text-wrap: pretty`.
- **Body UI** (600, 14px, 1.25): button labels, list rows, street names in the turn banner (16px, 600).
- **Label** (Geist Mono, 11px, 0.1em tracking, uppercase, Ash): every caption, unit, column head and source line.
- **Numeric** (Geist Mono, tabular figures): every number, from distances and minutes to depths and statistics.

The app's type scale is 11 / 12 / 13 / 14 / 16 / 18 / 20 px; nothing in the tools is smaller than 11px (map pin sub-labels at 10px are the one exception).

### Named Rules
**The Mono Numbers Rule.** Every number, id, unit and label is set in Geist Mono with tabular figures, so values never shift sideways as they update.

**The Khmer Has No Case Rule.** In Khmer (`html[lang='km']`) labels drop uppercase and wide tracking (0.02em) and take taller line heights (1.35 for labels, 1.3 for titles) for stacked vowels. Never force Latin display conventions onto Khmer.

**The 16px Field Rule.** Every input, textarea and select is at least 16px so mobile Safari never zooms in on focus.

## Layout

Mobile-first and map-first. The rider app is a full-screen map with chrome around it: a top HUD (turn banner, status), a bottom sheet that collapses to about 262px plus the safe area, and map controls floating just above the sheet (or above the 118px navigation bar while navigating). Safe-area insets are respected on every edge.

Controls are sized for one thumb: primary buttons and fields are 48px tall, list rows at least 52px, route options 64px, chips 40px, icon buttons 36–48px square. Spacing follows a 4px step (4 / 8 / 12 / 16 / 24), with 8px gaps inside controls and 12px horizontal padding in fields.

The landing page is a wide editorial grid: oversized display headlines over a 12-column grid with uneven spans (5 / 4 / 3 for the statistics row), sections divided by hairlines, full-bleed map and halftone imagery, and generous vertical spacing. On narrow screens everything stacks to one column.

**The Hairline Grid Rule.** Grouped cells are built as a 1px-gap grid on a hairline-tinted parent, so the dividers are exact and never double up.

## Elevation & Depth

Flat. Depth comes from tone and hairlines, not shadows: Void substrate, Panel and Slab surfaces one step lighter, and a 1px white edge at 12% around anything that floats. Floating panels over the map are near-opaque (94%) with a light 8px blur so the map still reads behind them; with reduced transparency they become solid Panel.

### Shadow Vocabulary
- **Pin lift** (`filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6))`): trip start and destination pins only, so they read above route lines.
- **Flood glow** (`drop-shadow(0 0 10px var(--flood)) drop-shadow(0 0 22px var(--flood))`, pulsing): the rider puck while riding through water.
- **Flood edge** (`box-shadow: inset 0 0 70px 6px var(--flood)`, pulsing): a screen-edge flash while in water.

### Named Rules
**The Glow Means Water Rule.** Nothing glows except danger. Panels, buttons and cards have no shadow and no glow at rest or on hover.

## Shapes

Every corner is 90 degrees: the Tailwind radius scale is overridden to 0 at every step. The only round shapes are dots and pucks (flood report dots, the rider puck, the pump node, the start pin), using a full radius. Small mono value tags on the map (depth tags, urgency tickets) take a barely-there 2px corner so their text doesn't look clipped. The map popup is a 6px-rounded legacy exception.

Recurring geometry: diamonds for telemetry nodes, a triangle for stalling-depth water and a small square for shallow water, a 4px diagonal hazard stripe (Hazard Red and Void, 6px bands at 135°) used sparingly as an edge, and a square arrow cell flush right inside the primary button.

**The Square Corner Rule.** If it is a surface or a control, its corners are square. Round is reserved for points on the map.

## Components

### Buttons
Firm and fast: square, solid, and pressing down instantly with no glow.
- **Shape:** square corners (0), 48px tall, full width in sheets.
- **Primary:** Hazard Red fill, near-white 600-weight label centred, with an optional 56px square arrow cell flush right behind a dark 30% hairline. Hover #F03A26; press scales to 98.5%.
- **Outline:** Slab fill, 25% white 1px edge, Paper label. The secondary action beside a primary. On hover the edge turns Dusk and the fill Dusk Deep.
- **Lean:** on the landing page, primary and outline buttons lean up to 5px toward a fine pointer and settle back in 500 ms; the arrow cell's dark fill wipes in from the left and the arrow steps 4px. Off for touch and reduced motion.
- **Light:** Paper fill with Void label. The confirming secondary on dark cards (for example "Done" on the arrival card).
- **Hover / Focus:** hover only on fine pointers (7% white wash on ghost controls); every control presses to 97% in 120 ms with a strong ease-out; focus is a 2px Hazard Red outline at 2px offset (2px near-white on the red primary).
- **Disabled:** 8% white fill, Smoke label, not-allowed cursor.

### Chips
- **Style:** 40px tall, 13px 500-weight label, no fill and Ash-to-light text at rest, in a horizontally scrolling row with no visible scrollbar.
- **State:** the selected vehicle chip fills Hazard Red with Paper text; the "dry only" toggle fills 15% emerald with emerald text; segmented from/to tabs fill Paper with Void text. All use `aria-pressed`.

### Cards / Containers
- **Corner Style:** square.
- **Background:** floating panels are 94% Panel with an 8px blur; inline blocks are Slab; grid cells are Panel.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline (12% white); stronger edges at 15–25%.
- **Internal Padding:** 12–16px; rows separate with a top hairline rather than gaps.

### Inputs / Fields
- **Style:** 48px tall, Slab fill, square, a leading 20px Ash icon, 16px Paper text, Smoke placeholder.
- **Focus:** the active search field carries a full Hazard Red 1px border; the native outline is removed in favour of it.
- **Upload:** photo upload is a dashed 25% white box, 48px tall.

### Navigation
- **Top HUD:** a turn banner with a large turn arrow, the street name in 16px 600 Paper (two lines max), and a "then" row in Ash. Ghost icon buttons with a 7% hover wash.
- **Bottom sheet:** slides up in 260ms on the drawer curve (cubic-bezier(0.32, 0.72, 0, 1)); route options are 64px rows with a 6px status-colour bar at the left edge and a 7% white wash when selected.
- **Navigation bar:** a 48px square outline button beside a 48px square Hazard Red report button.
- **Landing nav:** mono labels, keys 0/1/2 jump between landing, demo and live while presenting.

### Water Gauge
A 64px ruled column that fills from the bottom in the depth colour (Water sky below ankle depth), dragged vertically, with the level in large mono centimetres and a pass, slow or stop state per vehicle in Clear, Caution or Flare text. It sits on a Dusk Deep card.

### Page Transitions
Moves between pages use the browser's View Transitions: the landing page is the front, the app and the data page sit one level in. Going in, the old page eases back to 97% and blurs (300 ms) while the new one rises 32 px into place (520 ms, cubic-bezier(0.23, 1, 0.32, 1)); going back is the mirror; moves between the app and the data page are a short cross-fade. The hero map and the phone frame are one object ("pf-stage") that grows into the app and shrinks back (600 ms, the drawer curve), and the top bar holds still between the landing and data pages. Keyboard shortcuts and reduced motion switch instantly.

### Flood-Prone Spots
Places riders have reported water on two or more days, drawn as soft Water discs (13–20% fill, a 1.25 px Water ring) under every route and report, larger where it has flooded on more days. They appear by themselves in heavy rain, with a sheet line that always says "predicted from past reports, not reported now"; Water, never red or amber, keeps a prediction from reading as a report.

### Flood Replay
On the Open data page: a dark map with report dots in their depth colour (a soft halo grows with confirmations) above a Slab timeline. A square Hazard Red play button, the moment in mono, 24 h / 7 days / 30 days chips, red bars for reports per hour, and a range with a square Hazard Red handle on a 2px hairline track. A report shows from when it was made until it was cleared, or 24 hours at most.

### Rain Radar
On the live map, under every route and report: RainViewer's last two hours in its blue scheme at 55% opacity, frames taking turns every 450 ms and holding two seconds on the latest (one still frame under reduced motion). A cloud button among the map controls switches it; a small caption above the sheet names the frame time, the source and that coverage is regional.

### Map Marks (signature)
- **Flood lines:** thin translucent lines in the depth colour along the flooded stretch; no markers or tags on the line itself.
- **Rider puck:** a Paper dot with a heading cone; while navigating, a flat arrow lying on the road. In water it pulses between Paper and the flood colour, with the flood glow.
- **Trip pins:** a 30px lettered badge (round for the start, square for the destination) with a name label to the right: dark label for the start, light label for the destination.
- **Hazard tags:** a triangle (stalling depth) or small square (shallow) beside a mono depth tag in the depth colour.

## Do's and Don'ts

### Do:
- **Do** keep every surface and control square (radius 0); use full round only for map dots and pucks.
- **Do** set every number, unit, id and caption in Geist Mono with tabular figures; captions at 11px, 0.1em tracking, uppercase, Ash (#A1A1AA).
- **Do** separate content with 1px hairlines at 12% white, built as gap-grids.
- **Do** make primary actions Hazard Red (#E8301C), 48px tall, with a 2px focus outline at 2px offset.
- **Do** keep motion under 300 ms with the punch ease-out (cubic-bezier(0.23, 1, 0.32, 1)); presses scale to 0.97–0.985.
- **Do** honour reduced motion (drop travel and loops, keep state changes) and reduced transparency (solid panels).
- **Do** switch labels and titles to the Khmer rules (no uppercase, 0.02em tracking, taller line heights) under `html[lang='km']`.
- **Do** cite a source in a mono label under every statistic.

### Don't:
- **Don't** use rounded corners on panels, cards, buttons, chips or fields.
- **Don't** use emerald, amber, red or sky for anything except road and water status.
- **Don't** add a third brand colour, gradients or glow to chrome; glow is reserved for the rider in water.
- **Don't** use Dusk for an action, a status, or body text; it is pointer feedback and quiet tint only.
- **Don't** use pure black or a second grey family.
- **Don't** add drop shadows to panels or cards; use tone and hairlines.
- **Don't** set app text below 11px or form fields below 16px.
- **Don't** rely on colour alone for a warning: pair it with shape (triangle or square), text and sound.

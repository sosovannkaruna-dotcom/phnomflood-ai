# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first web app, installable from the browser menu (`public/manifest.webmanifest`, `public/sw.js`). Used on phones while riding; the landing page and demo are also shown on laptops and projectors at pitches.

## Users

- **Primary: everyday commuters** riding their own motorbike in Phnom Penh to work, school or the market during the rainy season (May–October). They want to get where they are going without riding into deep water, stalling, or turning back.
- **Most frequent users and best reporters: delivery and ride-hail riders** (food delivery, ride-hail) who ride all day, lose income when stuck in water, and see floods first.
- Routes are also weighed for tuk-tuks and cars, but the motorbike rider is the design centre.
- **Secondary audience (now):** hackathon judges and pitch audiences evaluating the idea through the landing page and the scripted demo.

## Product Purpose

PhnomFlood AI gives riders routes that avoid flooded streets. Riders report water depth in two taps; every rider nearby sees it, and the router steers around it, rerouting mid-ride when water is reported ahead.

The goal after the hackathon is a **real, free public app** riders install and use daily. Success means riders open it when it rains, enough of them report that the flood map is current, and they reach their destination dry.

## Positioning

General map apps route around traffic, not water. PhnomFlood ranks routes by how deep the water on them is (ankle, knee, waist) for the rider's vehicle, using fresh reports from other riders checked by an AI photo check, and keeps the rider on a dry route as reports arrive during the ride.

## Operating Context

- Used one-handed on a phone, on or beside a motorbike, often in rain, glare or at night, with patchy mobile data.
- Reporting happens at the roadside, quickly: pick a depth, confirm the place, optionally add a photo.
- Flooding is seasonal and sudden; water drains within hours, so reports age quickly.
- Pitch setting: a scripted demo (`#/demo`) plays the whole story offline; a guided tour (`#/tour`) walks through it; the live app (`#/live`) runs on real services and is opened by scanning a QR code.

## Capabilities and Constraints

- **Routes:** `#/` landing, `#/demo` scripted demo, `#/tour` demo with guided tour, `#/live` live app. One codebase; the route picks the mode.
- **Routing:** routes ranked by deepest water first, then time; a reroute never goes into deeper water; mid-ride reroutes only split ahead of the rider. Live routing uses the public OSRM server.
- **Reports:** three depths (ankle, knee, waist); confirm or clear reports within 2 km; shared between phones through Supabase in live mode; reports older than 24 hours are not shown.
- **AI photo check:** Gemini estimates depth from a rider's photo (server function, key never reaches the browser). Demo uses pre-written verdicts.
- **Weather:** rain now and over the next three hours from Open-Meteo; heavy-rain alert.
- **Drain-time estimate** ("clears in"): an assumption-based estimate, always labelled as an estimate.
- **Simulated:** the demo ride, storm, reports and photo verdicts. The live ride follows real GPS.
- **Dependencies:** free public services (Photon, Nominatim, OSRM demo server, Overpass, OpenFreeMap) with usage limits and no uptime guarantee.
- **Terminology:** Khan and Sangkat for districts and communes; numbered streets read as "St. 53" in English.
- **Undecided:** business model, operating organisation, data partnerships, and launch plan beyond the hackathon.

## Brand Commitments

- Name: **PhnomFlood AI**. Built by So Sovannkaruna for the Open Data X AI Venture Hackathon 1.0.
- **English and Khmer are equal**: every rider-facing string exists in both; the choice is saved per device. Neither language is a lesser translation.
- Voice: plain, direct, practical; short sentences a rider can read at a glance. Sources are cited for every statistic.

## Evidence on Hand

- Landing figures, sourced: 86% of new vehicles registered in 2024 were motorcycles (MPWT via AKP, Jan 2025); 80% of yearly rain falls May–October (DWD climate normals); 16 of 26 lakes filled in (STT, "The Last Lakes", 2019).
- Map and street data from OpenStreetMap (ODbL); 22 demo trips built from real OSRM routes; 33 seed floods placed in flood-prone areas (demo data).
- Demo photos in `public/scenarios/` with credits in the README.
- **Absent, do not fabricate:** real users, usage numbers, testimonials, partners, press, or accuracy figures for the AI check or the drain-time estimate. Two Khmer Times figures (20 cm in Tuol Kork; drain works in three Khans) are unverified and must not be used until checked. The Khmer copy has not yet been reviewed by a native speaker.

## Product Principles

1. **Safety over speed.** A route never sends a rider into deeper water to save time.
2. **Glanceable while riding.** Anything shown during a ride must be readable in a second, with one thumb, in rain.
3. **Honest about what is known.** Say what is simulated, estimated or unverified; cite sources; label estimates.
4. **Riders are the sensors.** Reporting must be the fastest action in the app, and every report should visibly help the next rider.
5. **Khmer and English as equals.** No feature ships in one language only.

## Accessibility & Inclusion

- Large touch targets for one-handed use, gloves and wet screens.
- Legible in bright sunlight and at night; warnings never rely on colour alone (sound, motion and text accompany them).
- Khmer script needs taller line heights and no forced uppercase or wide tracking.
- Works on low-end Android phones and slow or intermittent mobile data.

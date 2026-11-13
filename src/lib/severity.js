// Shared vocabulary for flood depth and vehicle tolerance.
// Every colour, label and threshold in the UI comes from this file.

export const DEPTHS = {
  clear: {
    id: 'clear',
    rank: 0,
    label: 'Clear / Passable',
    short: 'Clear',
    cm: 0,
    color: '#10B981',
    soft: '#ECFDF5',
    text: '#065F46',
    zoneRadius: 90, // metres drawn (and used for routing) around the pin
    advice: 'Road is dry and passable for all vehicles',
  },
  ankle: {
    id: 'ankle',
    rank: 1,
    label: 'Ankle-Deep',
    short: 'Ankle-Deep',
    cm: 15,
    color: '#F59E0B',
    soft: '#FFFBEB',
    text: '#92400E',
    zoneRadius: 140,
    advice: 'Passable for cars & tuk-tuks · caution for motos',
  },
  knee: {
    id: 'knee',
    rank: 2,
    label: 'Knee-Deep',
    short: 'Knee-Deep',
    cm: 45,
    color: '#EF4444',
    soft: '#FEF2F2',
    text: '#991B1B',
    zoneRadius: 190,
    advice: 'Moto engine hazard — avoid',
  },
  waist: {
    id: 'waist',
    rank: 3,
    label: 'Waist-Deep',
    short: 'Waist-Deep',
    cm: 90,
    color: '#B91C1C',
    soft: '#FEE2E2',
    text: '#7F1D1D',
    zoneRadius: 240,
    advice: 'Severe — impassable for all vehicles',
  },
}

export const DEPTH_ORDER = ['clear', 'ankle', 'knee', 'waist']

// The three depths a citizen can report (a "clear" pin only comes from monitoring).
export const REPORTABLE_DEPTHS = ['ankle', 'knee', 'waist']

// blockRank: a flood at this depth rank or deeper blocks the vehicle.
// cautionRank: a flood at this rank (but below blockRank) is passable with caution.
export const VEHICLES = {
  moto: {
    id: 'moto',
    label: 'Motorbike',
    short: 'Motorbike',
    noun: 'motorbike',
    blockRank: 2,
    cautionRank: 1,
    etaFactor: 1,
  },
  tuktuk: {
    id: 'tuktuk',
    label: 'PassApp / Tuk-Tuk',
    short: 'Tuk-Tuk',
    noun: 'tuk-tuk',
    blockRank: 2,
    cautionRank: 2,
    etaFactor: 1.2,
  },
  car: {
    id: 'car',
    label: 'Car / SUV',
    short: 'Car / SUV',
    noun: 'car',
    blockRank: 3,
    cautionRank: 2,
    etaFactor: 1.1,
  },
}

export const VEHICLE_ORDER = ['moto', 'tuktuk', 'car']

export const depthOf = (report) => DEPTHS[report.depth] ?? DEPTHS.clear

export const isActiveFlood = (report) => depthOf(report).rank > 0

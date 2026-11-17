// Real storms, replayed on the Open data page. Every line of the story comes from the cited
// report; nothing is invented. The map and model data are built by scripts/build-storm.mjs.
//
// Times: the source says "mid-afternoon", "in less than an hour" and "the evening rush hour",
// not clock times, so each step carries the source's own words and an approximate hour.

export interface StormStep {
  /** Approximate local hour, for the timeline and the model chart */
  hour: number
  /** The source's own wording for when */
  when: string
  text: string
  /** Districts shown flooded from this step on */
  areas: string[]
  /** Riverside pavements submerged (Preah Sisowath Quay) */
  riverside?: boolean
}

export interface Storm {
  id: string
  date: string
  title: string
  lede: string
  areaNames: Record<string, { name: string; note: string }>
  steps: StormStep[]
  source: { publisher: string; title: string; author: string; published: string; url: string }
}

export const STORM_2026_02_26: Storm = {
  id: '2026-02-26',
  date: 'Thursday 26 February 2026',
  title: 'The first heavy rain after six dry months',
  lede: 'A mid-afternoon downpour turned a heatwave into flooded streets across four districts in under an hour.',
  areaNames: {
    'tuol-kouk': { name: 'Tuol Kouk', note: 'Several major roads under up to 20 cm of water' },
    'daun-penh': { name: 'Daun Penh', note: 'Riverside pavements submerged, motorbikes stalled' },
    'sen-sok': { name: 'Sen Sok', note: 'Sewers overwhelmed, flooding reported' },
    'boeng-keng-kang': { name: 'Boeng Keng Kang', note: 'Sewers overwhelmed, flooding reported' },
  },
  steps: [
    { hour: 12, when: 'Midday', text: 'A heatwave: 35 °C, and nearly six months without rain. Drain grates are clogged with dry-season dust and waste.', areas: [] },
    { hour: 14, when: 'Mid-afternoon', text: 'The storm breaks over the capital.', areas: [] },
    { hour: 15, when: 'Less than an hour later', text: 'Flash flooding. Several major roads in Tuol Kouk are under up to 20 cm of water; near the riverside in Daun Penh, pavements are submerged and motorbikes stall.', areas: ['tuol-kouk', 'daun-penh'], riverside: true },
    { hour: 16, when: 'Late afternoon', text: 'The volume of water overwhelms the sewers in Sen Sok and Boeng Keng Kang.', areas: ['tuol-kouk', 'daun-penh', 'sen-sok', 'boeng-keng-kang'], riverside: true },
    { hour: 18, when: 'Evening rush hour', text: 'Significant traffic jams in the flooded districts. The temperature has dropped to 24 °C; city teams clear debris from sewer grates.', areas: ['tuol-kouk', 'daun-penh', 'sen-sok', 'boeng-keng-kang'], riverside: true },
  ],
  source: {
    publisher: 'Khmer Times',
    title: 'First heavy rain in months floods Phnom Penh',
    author: 'Ria Cleofe',
    published: '26 February 2026',
    url: 'https://www.khmertimeskh.com/501852652/first-heavy-rain-in-months-floods-phnom-penh/',
  },
}

/** Rain of this many mm in an hour counts as heavy (the same threshold the app uses). */
export { HEAVY_MM_PER_HOUR as HEAVY_MM_H } from '../services/weather'

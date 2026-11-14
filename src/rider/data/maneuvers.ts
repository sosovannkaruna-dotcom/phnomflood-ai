// Turn list per pre-computed route. Street order comes from the OSRM directions
// the geometry was built from; the positions (`at`, 0–1 along the route) are
// rounded, so distances in the banner are approximate.
import type { Maneuver } from '../types'

export const MANEUVERS: Record<string, Maneuver[]> = {
  'rupp-bkk-a': [
    { at: 0.28, turn: 'right', street: 'Nehru Blvd (St. 215)', toward: 'Sihanouk Blvd' },
    { at: 0.52, turn: 'left', street: 'Sihanouk Blvd', toward: 'Monivong Blvd' },
    { at: 0.8, turn: 'right', street: 'St. 63', toward: 'BKK1 Market' },
    { at: 1, turn: 'arrive', street: 'BKK1 Market' },
  ],
  'rupp-bkk-b': [
    { at: 0.25, turn: 'right', street: 'Mao Tse Toung Blvd', toward: 'Monivong Blvd' },
    { at: 0.94, turn: 'left', street: 'St. 63', toward: 'BKK1 Market' },
    { at: 1, turn: 'arrive', street: 'BKK1 Market' },
  ],
  'rupp-bkk-c': [
    { at: 0.36, turn: 'right', street: 'Nehru Blvd (St. 215)', toward: 'Sihanouk Blvd' },
    { at: 0.53, turn: 'left', street: 'Sihanouk Blvd', toward: 'Monivong Blvd' },
    { at: 0.8, turn: 'right', street: 'St. 63', toward: 'BKK1 Market' },
    { at: 1, turn: 'arrive', street: 'BKK1 Market' },
  ],
  'watphnom-russianmarket-a': [
    { at: 0.25, turn: 'left', street: 'Charles de Gaulle Blvd', toward: 'Monireth Blvd' },
    { at: 0.57, turn: 'left', street: 'St. 163', toward: 'Toul Tom Poung' },
    { at: 1, turn: 'arrive', street: 'Russian Market' },
  ],
  'watphnom-russianmarket-b': [
    { at: 0.12, turn: 'left', street: 'St. 19', toward: 'Royal Palace' },
    { at: 0.4, turn: 'right', street: 'Norodom Blvd', toward: 'Independence Monument' },
    { at: 0.7, turn: 'right', street: 'Mao Tse Toung Blvd', toward: 'Toul Tom Poung' },
    { at: 0.94, turn: 'right', street: 'St. 163', toward: 'Russian Market' },
    { at: 1, turn: 'arrive', street: 'Russian Market' },
  ],
  'watphnom-russianmarket-c': [
    { at: 0.36, turn: 'right', street: 'Sihanouk Blvd', toward: 'Independence Monument' },
    { at: 0.47, turn: 'left', street: 'Norodom Blvd', toward: 'Mao Tse Toung Blvd' },
    { at: 0.69, turn: 'right', street: 'Mao Tse Toung Blvd', toward: 'Toul Tom Poung' },
    { at: 0.94, turn: 'right', street: 'St. 163', toward: 'Russian Market' },
    { at: 1, turn: 'arrive', street: 'Russian Market' },
  ],
  'tk-rupp-a': [
    { at: 0.55, turn: 'right', street: 'Russian Blvd', toward: 'RUPP' },
    { at: 1, turn: 'arrive', street: 'RUPP' },
  ],
  'tk-rupp-b': [
    { at: 0.5, turn: 'left', street: 'St. 598', toward: 'Kampuchea Krom Blvd' },
    { at: 0.73, turn: 'left', street: 'Kampuchea Krom Blvd', toward: 'RUPP' },
    { at: 1, turn: 'arrive', street: 'RUPP' },
  ],
}

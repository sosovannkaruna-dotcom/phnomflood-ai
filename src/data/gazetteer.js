// Place names for new reports and for the rider's position, nearest entry wins.
//
// Built from OpenStreetMap: a reverse geocode (Nominatim) every ~450 m along every route,
// so street, Sangkat and Khan are looked up, not guessed. It was generated once offline (the generator is not in this repo), so add entries by hand or regenerate when routes change.

import places from './gazetteer.generated.json'

export const GAZETTEER = places

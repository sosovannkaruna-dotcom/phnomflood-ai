// Tiny offline gazetteer used to name a new report from its map position
// (nearest entry wins). Replace with reverse geocoding (e.g. Nominatim) later.
// Khan / Sangkat names are approximate.

export const GAZETTEER = [
  { name: 'Russian Blvd (RUPP)', area: 'Russian Blvd', khan: 'Tuol Kork', sangkat: 'Teuk Laak 1', lat: 11.5671, lng: 104.8912 },
  { name: 'Street 289', area: 'St. 289', khan: 'Tuol Kork', sangkat: 'Boeung Kak 2', lat: 11.5707, lng: 104.8994 },
  { name: 'Street 289 (north)', area: 'St. 289', khan: 'Tuol Kork', sangkat: 'Boeung Kak 1', lat: 11.578, lng: 104.8998 },
  { name: 'Russian Blvd near Wat Neakvoan', area: 'Russian Blvd', khan: 'Tuol Kork', sangkat: 'Boeung Kak 2', lat: 11.5703, lng: 104.9045 },
  { name: 'Kampuchea Krom Blvd', area: 'Kampuchea Krom Blvd', khan: 'Tuol Kork', sangkat: 'Teuk Laak 3', lat: 11.5662, lng: 104.895 },
  { name: 'Kampuchea Krom Blvd (east)', area: 'Kampuchea Krom Blvd', khan: '7 Makara', sangkat: 'Mittapheap', lat: 11.568, lng: 104.9112 },
  { name: 'Mao Tse Toung Blvd (Tuol Kork)', area: 'Mao Tse Toung Blvd', khan: 'Tuol Kork', sangkat: 'Boeung Salang', lat: 11.562, lng: 104.9003 },
  { name: 'Mao Tse Toung Blvd (Boeung Salang)', area: 'Mao Tse Toung Blvd', khan: 'Tuol Kork', sangkat: 'Boeung Salang', lat: 11.5555, lng: 104.9003 },
  { name: 'Mao Tse Toung Blvd (Tuol Svay Prey)', area: 'Mao Tse Toung Blvd', khan: 'Boeung Keng Kang', sangkat: 'Tuol Svay Prey 2', lat: 11.549, lng: 104.904 },
  { name: 'Mao Tse Toung Blvd @ St. 163', area: 'Mao Tse Toung Blvd', khan: 'Boeung Keng Kang', sangkat: 'Tuol Svay Prey 1', lat: 11.5443, lng: 104.912 },
  { name: 'Mao Tse Toung Blvd (Toul Tompoung)', area: 'Mao Tse Toung Blvd', khan: 'Chamkar Mon', sangkat: 'Tuol Tumpung 2', lat: 11.5443, lng: 104.919 },
  { name: 'Mao Tse Toung Blvd @ Monivong', area: 'Mao Tse Toung Blvd', khan: 'Chamkar Mon', sangkat: 'Boeung Trabek', lat: 11.5443, lng: 104.9255 },
  { name: 'Nehru Blvd (St. 215)', area: 'Nehru Blvd', khan: '7 Makara', sangkat: 'Veal Vong', lat: 11.564, lng: 104.9075 },
  { name: 'Sihanouk Blvd', area: 'Sihanouk Blvd', khan: '7 Makara', sangkat: 'Veal Vong', lat: 11.557, lng: 104.915 },
  { name: 'Street 63, BKK1', area: 'St. 63', khan: 'Boeung Keng Kang', sangkat: 'Boeung Keng Kang 1', lat: 11.552, lng: 104.924 },
  { name: 'BKK1 Market', area: 'BKK1 Market', khan: 'Boeung Keng Kang', sangkat: 'Boeung Keng Kang 1', lat: 11.5467, lng: 104.9255 },
  { name: 'Monivong Blvd near Central Market', area: 'Monivong Blvd', khan: 'Daun Penh', sangkat: 'Phsar Thmei 2', lat: 11.5686, lng: 104.9186 },
  { name: 'Charles de Gaulle Blvd', area: 'Charles de Gaulle Blvd', khan: '7 Makara', sangkat: 'Monourom', lat: 11.5655, lng: 104.9165 },
  { name: 'Norodom Blvd', area: 'Norodom Blvd', khan: 'Daun Penh', sangkat: 'Chey Chumneah', lat: 11.5625, lng: 104.9285 },
  { name: 'Norodom Blvd (south)', area: 'Norodom Blvd', khan: 'Chamkar Mon', sangkat: 'Tonle Bassac', lat: 11.55, lng: 104.928 },
  { name: 'Independence Monument', area: 'Independence Monument', khan: 'Boeung Keng Kang', sangkat: 'Boeung Keng Kang 1', lat: 11.5564, lng: 104.9282 },
  { name: 'Sisowath Quay', area: 'Sisowath Quay', khan: 'Daun Penh', sangkat: 'Phsar Kandal 1', lat: 11.569, lng: 104.93 },
  { name: 'Wat Phnom', area: 'Wat Phnom', khan: 'Daun Penh', sangkat: 'Wat Phnom', lat: 11.5761, lng: 104.9232 },
  { name: 'Street 317 (TK Avenue)', area: 'St. 317', khan: 'Tuol Kork', sangkat: 'Boeung Kak 1', lat: 11.581, lng: 104.895 },
  { name: 'Street 598', area: 'St. 598', khan: 'Tuol Kork', sangkat: 'Boeung Kak 2', lat: 11.575, lng: 104.889 },
  { name: 'Street 163', area: 'St. 163', khan: 'Boeung Keng Kang', sangkat: 'Olympic', lat: 11.55, lng: 104.914 },
  { name: 'Russian Market', area: 'Russian Market', khan: 'Chamkar Mon', sangkat: 'Tuol Tumpung 1', lat: 11.5405, lng: 104.9147 },
  { name: 'Olympic Stadium', area: 'Olympic Stadium', khan: '7 Makara', sangkat: 'Veal Vong', lat: 11.5584, lng: 104.9122 },
]

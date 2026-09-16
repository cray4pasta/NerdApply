// Distance and travel-burden helpers. Distance is estimated from a state centroid rather than
// a ZIP code — Philadelphia and Pittsburgh look identical under this model. That is a known
// limitation, named in the UI and in the README, not hidden. See docs/02-ENGINEERING.md 7.9.

export const STATE_CENTROIDS = {
  AL: [32.79, -86.83], AK: [64.07, -152.28], AZ: [34.27, -111.66], AR: [34.9, -92.44],
  CA: [37.18, -119.47], CO: [38.99, -105.55], CT: [41.62, -72.73], DE: [38.99, -75.51],
  DC: [38.9, -77.03], FL: [28.63, -82.45], GA: [32.64, -83.44], HI: [20.29, -156.37],
  ID: [44.35, -114.61], IL: [40.03, -89.16], IN: [39.89, -86.28], IA: [42.07, -93.5],
  KS: [38.49, -98.38], KY: [37.53, -85.3], LA: [31.05, -92.0], ME: [45.37, -69.24],
  MD: [39.05, -76.64], MA: [42.26, -71.81], MI: [44.35, -85.41], MN: [46.39, -94.64],
  MS: [32.74, -89.67], MO: [38.46, -92.29], MT: [46.92, -110.45], NE: [41.5, -99.68],
  NV: [39.34, -116.42], NH: [43.68, -71.58], NJ: [40.19, -74.67], NM: [34.4, -106.13],
  NY: [42.83, -75.5], NC: [35.63, -79.9], ND: [47.53, -99.78], OH: [40.39, -82.76],
  OK: [35.57, -96.93], OR: [44.57, -122.07], PA: [40.59, -77.21], RI: [41.68, -71.51],
  SC: [33.86, -80.94], SD: [44.3, -100.24], TN: [35.75, -86.69], TX: [31.05, -97.56],
  UT: [40.15, -111.86], VT: [44.04, -72.71], VA: [37.77, -78.17], WA: [47.4, -121.49],
  WV: [38.6, -80.45], WI: [44.27, -89.62], WY: [42.76, -107.3]
}

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
}

// Used when notes ask for a warm climate (Student B, and similar). Not a hard filter.
export const WARM_STATES = new Set(['FL', 'TX', 'GA', 'SC', 'NC', 'AL', 'MS', 'LA', 'AZ', 'HI', 'CA'])

// Used when notes ask for hiking / mountain access. Prefer these states in the overlay mix
// and give them a modest ranking bump — not a hard filter. NC is included for the Appalachians.
export const MOUNTAIN_STATES = new Set(['CO', 'UT', 'VT', 'NH', 'WA', 'OR', 'MT', 'ID', 'WY', 'AK', 'NC'])

// A tiny hand-maintained map of the home state's principal commercial airport, per
// docs/02-ENGINEERING.md 7.9: "a tiny hand-maintained map of major hubs, not an airline API."
export const STATE_HUB = {
  AL: 'BHM', AK: 'ANC', AZ: 'PHX', AR: 'XNA', CA: 'LAX', CO: 'DEN', CT: 'BDL', DE: 'PHL',
  DC: 'DCA', FL: 'MCO', GA: 'ATL', HI: 'HNL', ID: 'BOI', IL: 'ORD', IN: 'IND', IA: 'DSM',
  KS: 'ICT', KY: 'SDF', LA: 'MSY', ME: 'PWM', MD: 'BWI', MA: 'BOS', MI: 'DTW', MN: 'MSP',
  MS: 'JAN', MO: 'STL', MT: 'BIL', NE: 'OMA', NV: 'LAS', NH: 'MHT', NJ: 'EWR', NM: 'ABQ',
  NY: 'JFK', NC: 'CLT', ND: 'FAR', OH: 'CMH', OK: 'OKC', OR: 'PDX', PA: 'PHL', RI: 'PVD',
  SC: 'CHS', SD: 'FSD', TN: 'BNA', TX: 'DFW', UT: 'SLC', VT: 'BTV', VA: 'DCA', WA: 'SEA',
  WV: 'CRW', WI: 'MKE', WY: 'JAC'
}

// Airports large/connected enough that a direct route between any two is a reasonable
// assumption for a demo. Not an airline schedule lookup — a deliberate simplification named
// in the README.
export const MAJOR_HUBS = new Set([
  'ATL', 'ORD', 'DFW', 'DEN', 'LAX', 'JFK', 'EWR', 'PHL', 'CLT', 'MIA', 'BOS', 'IAH', 'SEA',
  'MSP', 'DTW', 'PHX', 'BWI', 'DCA', 'MCO', 'CMH', 'SLC'
])

export function haversineMiles([lat1, lon1], [lat2, lon2]) {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Converts a distance into what a family is actually asking: can he come home at Thanksgiving.
// Rules verbatim from docs/02-ENGINEERING.md 7.9.
export function travelBurden(homeState, school) {
  const home = STATE_CENTROIDS[homeState]
  if (!home || school.lat == null || school.lon == null) {
    return { miles: null, text: 'Distance unknown — home state not resolved.', estimated: true }
  }

  const miles = Math.round(haversineMiles(home, [school.lat, school.lon]))
  const hours = Math.max(1, Math.round(miles / 60))

  if (miles < 60) {
    return { miles, text: 'Close enough to come home any weekend', estimated: true }
  }
  if (miles < 180) {
    return { miles, text: `About a ${hours}-hour drive`, estimated: true }
  }
  if (miles < 350) {
    return { miles, text: `About a ${hours}-hour drive, or a short flight`, estimated: true }
  }

  const homeHub = STATE_HUB[homeState]
  const hasDirect =
    homeHub && school.nearest_airport && MAJOR_HUBS.has(homeHub) && MAJOR_HUBS.has(school.nearest_airport)

  if (hasDirect) {
    const airHours = Math.max(3, Math.round(miles / 450) + 2)
    return { miles, text: `One direct flight, roughly ${airHours}h door to door`, estimated: true }
  }

  return { miles, text: 'Usually a connecting flight, most of a day each way', estimated: true }
}

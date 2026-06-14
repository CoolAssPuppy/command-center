/**
 * The cities shown in the hero row. Each carries an IANA time zone for the
 * clock, a latitude/longitude for the solar daylight state and weather, and a
 * stylized skyline roofline (an open SVG path, stroked faintly in an accent).
 * The skylines are evocative, not surveyed: a recognizable silhouette per city.
 */
export interface City {
  id: string;
  label: string;
  timeZone: string;
  lat: number;
  lon: number;
  /** Working day, local 24h hours [start, end), used by the overlap timeline. */
  workingHours: { start: number; end: number };
  /** SVG roofline path in a 0 0 300 64 viewBox; drawn as a stroked outline. */
  skyline: string;
}

const NEW_YORK: City = {
  id: "new-york",
  label: "New York",
  timeZone: "America/New_York",
  lat: 40.7128,
  lon: -74.006,
  workingHours: { start: 9, end: 18 },
  skyline:
    "M0,52 L16,52 L16,40 L28,40 L28,55 L40,55 L40,28 L52,28 L52,50 L66,50 L66,18 L72,18 L72,6 L76,6 L76,18 L84,18 L84,44 L100,44 L100,34 L114,34 L114,54 L130,54 L130,24 L144,24 L144,49 L160,49 L160,37 L174,37 L174,56 L190,56 L190,30 L204,30 L204,47 L220,47 L220,21 L232,21 L232,42 L250,42 L250,52 L268,52 L268,45 L284,45 L284,56 L300,56",
};

const LISBON: City = {
  id: "lisbon",
  label: "Lisbon",
  timeZone: "Europe/Lisbon",
  lat: 38.7223,
  lon: -9.1393,
  workingHours: { start: 9, end: 18 },
  skyline:
    "M0,58 L22,58 L22,52 L40,54 L40,30 L46,30 L46,54 L60,55 L60,48 L88,48 L88,40 L100,40 L100,54 L120,54 L120,44 L136,44 L136,57 L162,57 L162,50 L186,52 L186,42 L200,42 L200,55 L230,55 L230,48 L256,50 L256,55 L286,55 L286,58 L300,58",
};

const SINGAPORE: City = {
  id: "singapore",
  label: "Singapore",
  timeZone: "Asia/Singapore",
  lat: 1.3521,
  lon: 103.8198,
  workingHours: { start: 9, end: 18 },
  skyline:
    "M0,56 L18,56 L18,48 L30,48 L30,34 L36,34 L36,48 L46,48 L46,32 L52,32 L52,48 L62,48 L62,34 L68,34 L68,48 L80,48 L80,20 L96,20 L96,16 L150,16 L150,20 L166,20 L166,48 L186,48 L186,40 L200,40 L200,52 L230,52 L230,44 L252,46 L252,52 L286,52 L286,56 L300,56",
};

const TOKYO: City = {
  id: "tokyo",
  label: "Tokyo",
  timeZone: "Asia/Tokyo",
  lat: 35.6762,
  lon: 139.6503,
  workingHours: { start: 9, end: 18 },
  skyline:
    "M0,55 L20,55 L20,48 L40,50 L40,42 L60,42 L60,52 L86,52 L86,28 L92,28 L92,8 L96,8 L96,28 L104,28 L104,52 L130,52 L130,44 L155,46 L155,38 L176,38 L176,53 L206,53 L206,45 L236,47 L236,51 L268,51 L268,55 L300,55",
};

const SYDNEY: City = {
  id: "sydney",
  label: "Sydney",
  timeZone: "Australia/Sydney",
  lat: -33.8688,
  lon: 151.2093,
  workingHours: { start: 9, end: 18 },
  // Opera-house shells (quadratics) then the harbour-bridge arch as its own arc.
  skyline:
    "M0,58 L20,58 Q44,34 68,58 Q86,44 104,58 Q118,48 132,58 L150,58 M176,58 Q232,26 288,58 L300,58",
};

export const CITIES: readonly City[] = [
  NEW_YORK,
  LISBON,
  SINGAPORE,
  TOKYO,
  SYDNEY,
];

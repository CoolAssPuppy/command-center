/**
 * The bundled cities used to seed the timezone row on first run. Each carries an
 * IANA time zone for the clock, a latitude/longitude for weather and the
 * day/night tint, and a working-day window used by the optional overlap
 * timeline.
 */
export interface City {
  id: string;
  label: string;
  timeZone: string;
  lat: number;
  lon: number;
  /** Working day, local 24h hours [start, end), used by the overlap timeline. */
  workingHours: { start: number; end: number };
}

const NEW_YORK: City = {
  id: "new-york",
  label: "New York",
  timeZone: "America/New_York",
  lat: 40.7128,
  lon: -74.006,
  workingHours: { start: 9, end: 18 },
};

const LISBON: City = {
  id: "lisbon",
  label: "Lisbon",
  timeZone: "Europe/Lisbon",
  lat: 38.7223,
  lon: -9.1393,
  workingHours: { start: 9, end: 18 },
};

const SINGAPORE: City = {
  id: "singapore",
  label: "Singapore",
  timeZone: "Asia/Singapore",
  lat: 1.3521,
  lon: 103.8198,
  workingHours: { start: 9, end: 18 },
};

const TOKYO: City = {
  id: "tokyo",
  label: "Tokyo",
  timeZone: "Asia/Tokyo",
  lat: 35.6762,
  lon: 139.6503,
  workingHours: { start: 9, end: 18 },
};

const SYDNEY: City = {
  id: "sydney",
  label: "Sydney",
  timeZone: "Australia/Sydney",
  lat: -33.8688,
  lon: 151.2093,
  workingHours: { start: 9, end: 18 },
};

export const CITIES: readonly City[] = [
  NEW_YORK,
  LISBON,
  SINGAPORE,
  TOKYO,
  SYDNEY,
];

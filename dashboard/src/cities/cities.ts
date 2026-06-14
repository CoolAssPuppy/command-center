/**
 * The cities shown in the hero row. Each carries an IANA time zone for the
 * clock, a latitude/longitude for the solar daylight state, and a desaturated
 * skyline photo (served from public/cities, referenced via the build base so it
 * resolves in both dev and the packaged extension).
 */
export interface City {
  id: string;
  label: string;
  timeZone: string;
  lat: number;
  lon: number;
  /** Working day, local 24h hours [start, end), used by the overlap timeline. */
  workingHours: { start: number; end: number };
  /** Public-asset filename of the desaturated skyline photo. */
  photo: string;
}

const NEW_YORK: City = {
  id: "new-york",
  label: "New York",
  timeZone: "America/New_York",
  lat: 40.7128,
  lon: -74.006,
  workingHours: { start: 9, end: 18 },
  photo: "cities/new-york.jpg",
};

const LISBON: City = {
  id: "lisbon",
  label: "Lisbon",
  timeZone: "Europe/Lisbon",
  lat: 38.7223,
  lon: -9.1393,
  workingHours: { start: 9, end: 18 },
  photo: "cities/lisbon.jpg",
};

const SINGAPORE: City = {
  id: "singapore",
  label: "Singapore",
  timeZone: "Asia/Singapore",
  lat: 1.3521,
  lon: 103.8198,
  workingHours: { start: 9, end: 18 },
  photo: "cities/singapore.jpg",
};

const TOKYO: City = {
  id: "tokyo",
  label: "Tokyo",
  timeZone: "Asia/Tokyo",
  lat: 35.6762,
  lon: 139.6503,
  workingHours: { start: 9, end: 18 },
  photo: "cities/tokyo.jpg",
};

const SYDNEY: City = {
  id: "sydney",
  label: "Sydney",
  timeZone: "Australia/Sydney",
  lat: -33.8688,
  lon: 151.2093,
  workingHours: { start: 9, end: 18 },
  photo: "cities/sydney.jpg",
};

export const CITIES: readonly City[] = [
  NEW_YORK,
  LISBON,
  SINGAPORE,
  TOKYO,
  SYDNEY,
];

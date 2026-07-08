/**
 * A human time-of-day label for a city's local hour, used as the hero eyebrow.
 * Driven by the wall clock, so it reads the way a person would name the hour.
 */
export function phaseLabel(hourOfDay: number): string {
  if (hourOfDay >= 4 && hourOfDay < 6) return "Pre-dawn";
  if (hourOfDay >= 6 && hourOfDay < 8) return "Dawn";
  if (hourOfDay >= 8 && hourOfDay < 12) return "Morning";
  if (hourOfDay >= 12 && hourOfDay < 17) return "Afternoon";
  if (hourOfDay >= 17 && hourOfDay < 20) return "Evening";
  return "Night";
}

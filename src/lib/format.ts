// Display formatting shared by the dashboard list and the delete confirmation, so both show the same text.

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const distanceFormatter = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `YYYY-MM-DD` as a Polish weekday and date, e.g. „Poniedziałek, 5 października”. */
export function formatWorkoutDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const formatted = dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
  // Capitalize only the weekday; Polish month names stay lowercase.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Distance in km with exactly two decimals, Polish style (e.g. „10,50”). */
export function formatDistance(distanceKm: number): string {
  return distanceFormatter.format(distanceKm);
}

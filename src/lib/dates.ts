// App-calendar helpers. Pure functions with no `astro:*` imports, so they are usable from React islands.

export const APP_TIME_ZONE = "Europe/Warsaw";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date (`YYYY-MM-DD`) in the app time zone. */
export function todayInAppTimeZone(now: Date = new Date()): string {
  const parts = dateFormatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Adds `days` (may be negative) to a `YYYY-MM-DD` date using UTC calendar arithmetic (DST-safe). */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive 7-calendar-day window ending on `today`. */
export function recentWindow(today: string): { from: string; to: string } {
  return { from: addDays(today, -6), to: today };
}

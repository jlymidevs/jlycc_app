// Pure time-of-day helpers for the member dashboard greeting.

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Hour of day (0-23) in Asia/Manila for the given instant. */
export function manilaHour(date: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(formatted);
}

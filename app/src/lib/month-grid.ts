// app/src/lib/month-grid.ts
// Calendar month helpers. All "calendar dates" are Asia/Manila local (UTC+8, no DST).

export interface GridCell {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
}

export function currentManilaMonth(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
}

export function parseMonthParam(param: string | undefined): {
  year: number;
  month: number;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  const str =
    m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? param! : currentManilaMonth();
  return { year: Number(str.slice(0, 4)), month: Number(str.slice(5, 7)) };
}

/** 42 cells (6 weeks), Sunday-first, covering the given month. */
export function monthGridDays(year: number, month: number): GridCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - first.getUTCDay());
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: cursor.toISOString().slice(0, 10),
      inMonth: cursor.getUTCMonth() === month - 1,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

/** UTC instants bounding the Manila-local month: [start, end). */
export function monthRangeUtc(
  year: number,
  month: number
): { start: Date; end: Date } {
  const mm = String(month).padStart(2, "0");
  const start = new Date(`${year}-${mm}-01T00:00:00+08:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nm = String(nextMonth).padStart(2, "0");
  const end = new Date(`${nextYear}-${nm}-01T00:00:00+08:00`);
  return { start, end };
}

/** Manila calendar date (YYYY-MM-DD) of a UTC instant. */
export function manilaDateOf(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export type HoursInterval = {
  weekday: number;
  startTime: string;
  endTime: string;
};

/** True when two shifts on the same weekday overlap. Split shifts that only touch are allowed. */
export function hoursOverlap(hours: readonly HoursInterval[]): boolean {
  const byDay = new Map<number, HoursInterval[]>();
  for (const hour of hours) {
    const list = byDay.get(hour.weekday) ?? [];
    list.push(hour);
    byDay.set(hour.weekday, list);
  }

  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let index = 1; index < sorted.length; index++) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous && current && current.startTime < previous.endTime) return true;
    }
  }
  return false;
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

// Holdsport timestamps: "2026-04-03T16:30:00" → { date: "2026-04-03", time: "16:30" | null }
export function parseHoldsportTime(ts: string): { date: string; time: string | null } {
  const [date, timePart] = ts.split('T');
  const time = timePart?.startsWith('00:00') ? null : timePart?.slice(0, 5) ?? null;
  return { date, time };
}

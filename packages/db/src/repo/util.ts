export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | null | undefined): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!iso || !id) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return { at, id };
}

export function clampLimit(limit: number | undefined, max = 500, dflt = 50): number {
  if (!limit || !Number.isFinite(limit)) return dflt;
  return Math.max(1, Math.min(max, Math.floor(limit)));
}

// F10 — IST is the only display zone in v1; scheduledAt accepts any offset and is displayed in IST.
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function formatIST(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute} IST`;
}

/** Split an ISO instant into IST date/time parts for form inputs. */
export function toISTParts(iso: string): { date: string; time: string } {
  const d = new Date(Date.parse(iso) + 330 * 60_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

/** Compose an ISO instant with the IST offset from form inputs. */
export function fromISTParts(date: string, time: string): string {
  return `${date}T${time}:00+05:30`;
}

// Shared mechanics only. Explanation text is NEVER shared — each rule owns its explain() (04 §8).
import type { Context, Result, SuggestedFix } from '@preflight/core';
import { hhmmToMinutes, outsideWindow } from '@preflight/core';

export const PACK_ID = 'india-layer-a';
export const HYGIENE_PACK_ID = 'preflight-hygiene';

export function allIds(ctx: Context): string[] {
  return ctx.contacts.map((c) => c.id);
}

export function isPromotional(ctx: Context): boolean {
  return ctx.effectivePurpose === 'promotional';
}

export type WindowCheck =
  | { status: 'cannot_evaluate'; missing: string[]; reason?: string }
  | { status: 'ok'; breach: boolean; detail: Record<string, unknown> };

/**
 * D29 — evaluates the whole send interval [scheduledAt, sendWindowEnd] against [open, close).
 * With no send window the detail is byte-identical to PreflightCore: { sendTimeIST, window }.
 */
export function windowCheck(ctx: Context, openHHMM: string, closeHHMM: string): WindowCheck {
  if (!ctx.local) return { status: 'cannot_evaluate', missing: ['campaign.scheduledAt'] };
  const hasWindow = ctx.campaign.sendWindowEnd != null && String(ctx.campaign.sendWindowEnd).trim() !== '';
  if (hasWindow && (ctx.sendWindowMinutes === null || !ctx.localEnd)) {
    return { status: 'cannot_evaluate', missing: ['campaign.sendWindowEnd'], reason: 'send window end is invalid or before the start' };
  }
  const start = ctx.local.hour * 60 + ctx.local.minute;
  const duration = hasWindow ? (ctx.sendWindowMinutes ?? 0) : 0;
  const breach = outsideWindow(start, duration, hhmmToMinutes(openHHMM), hhmmToMinutes(closeHHMM));
  const detail: Record<string, unknown> = { sendTimeIST: ctx.local.hhmm, window: `${openHHMM}–${closeHHMM}` };
  if (hasWindow && ctx.localEnd) detail.sendWindowEnd = ctx.localEnd.hhmm;
  return { status: 'ok', breach, detail };
}

export function cannot(missing: string[], reason?: string): Result {
  return reason ? { status: 'cannot_evaluate', missing, reason } : { status: 'cannot_evaluate', missing };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 22 D4 — next permitted slot: window open + 60 min on the same local day if that is after
 * scheduledAt, else the next day. ISO with the tenant zone's offset. Deterministic; no clock.
 */
export function nextPermittedSlot(ctx: Context, openHHMM: string): string | null {
  const ms = Date.parse(ctx.campaign.scheduledAt);
  if (Number.isNaN(ms) || !ctx.local) return null;
  const utc = new Date(ms);
  const utcMinutes = utc.getUTCHours() * 60 + utc.getUTCMinutes();
  let offset = ctx.local.hour * 60 + ctx.local.minute - utcMinutes;
  if (offset > 840) offset -= 1440;
  if (offset < -720) offset += 1440;
  const shifted = new Date(ms + offset * 60_000);
  const open = hhmmToMinutes(openHHMM) + 60;
  let target =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), Math.floor(open / 60), open % 60) -
    offset * 60_000;
  if (target <= ms) target += 86_400_000;
  const local = new Date(target + offset * 60_000).toISOString().slice(0, 19);
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${local}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function rescheduleFix(ctx: Context, openHHMM: string): SuggestedFix | null {
  const scheduledAt = nextPermittedSlot(ctx, openHHMM);
  if (!scheduledAt) return null;
  const hh = String(hhmmToMinutes(openHHMM) + 60);
  const label = `Reschedule to ${pad(Math.floor(Number(hh) / 60))}:${pad(Number(hh) % 60)} ${ctx.timezone === 'Asia/Kolkata' ? 'IST' : ctx.timezone}${scheduledAt.slice(0, 10) === ctx.campaign.scheduledAt.slice(0, 10) ? '' : ' tomorrow'}`;
  return { kind: 'reschedule', label, payload: { scheduledAt } };
}

export function dropRowsFix(rowIds: string[], label: string): SuggestedFix {
  return { kind: 'drop_rows', label, payload: { rowIds } };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

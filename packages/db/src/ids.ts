import { v7 as uuidv7 } from 'uuid';

/** All ids are uuid v7 (time-ordered) — 03 header. */
export function newId(): string {
  return uuidv7();
}

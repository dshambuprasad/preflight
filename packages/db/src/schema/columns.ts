import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const tsNow = (name: string) => ts(name).notNull().default(sql`now()`);
export const id = () => uuid('id').primaryKey();

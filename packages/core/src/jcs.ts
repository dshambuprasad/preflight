// RFC 8785 JSON Canonicalization Scheme — vendored (12 §H D39; 17 "small enough to vendor").
// The certificate hash depends on this being bit-exact across Node and the browser; the
// conformance test in test/jcs.test.ts runs the RFC's published vectors.
//
// Rules: object members sorted by UTF-16 code units of the key; numbers serialised per ES6
// Number::toString (which JSON.stringify implements); strings escaped per ES6 JSON.stringify;
// no whitespace; -0 → 0; NaN/Infinity/undefined/functions/bigint/non-plain objects are errors —
// evidence must never contain them (14 §6: canonicalisation throws → seal job fails, approval kept).

export function canonicalJSON(value: unknown): string {
  return serialise(value, '$');
}

function serialise(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`JCS: non-finite number at ${path}`);
      return JSON.stringify(value); // ES6 Number::toString; JSON.stringify(-0) === '0'
    case 'string':
      return JSON.stringify(value);
    case 'undefined':
      throw new TypeError(`JCS: undefined at ${path}`);
    case 'bigint':
      throw new TypeError(`JCS: bigint at ${path}`);
    case 'function':
    case 'symbol':
      throw new TypeError(`JCS: ${typeof value} at ${path}`);
    case 'object': {
      if (Array.isArray(value)) {
        return '[' + value.map((v, i) => serialise(v, `${path}[${i}]`)).join(',') + ']';
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError(`JCS: non-plain object at ${path}`);
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort(compareUtf16);
      const parts: string[] = [];
      for (const k of keys) {
        parts.push(JSON.stringify(k) + ':' + serialise(obj[k], `${path}.${k}`));
      }
      return '{' + parts.join(',') + '}';
    }
  }
  throw new TypeError(`JCS: unsupported value at ${path}`);
}

/** Default JS string comparison already orders by UTF-16 code units; made explicit here. */
function compareUtf16(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a.charCodeAt(i) - b.charCodeAt(i);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

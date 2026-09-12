export * from './types.js';
export { evaluate, validatePacks, isKnownPath, isAbsent, PackValidationError } from './engine.js';
export { classify, type ClassificationMarkers } from './classify.js';
export { detectScript, matchesPreference, normaliseLanguage, type ScriptDetection, type PreferenceMatch } from './lang.js';
export { normalisePhone, normaliseEmail, normaliseConsent, strictestConsent, type PhoneRegion } from './normalise.js';
export { identityKey, isUnresolvable, DEFAULT_IDENTITY_PRECEDENCE, type Identifiers } from './identity.js';
export { canonicalJSON } from './jcs.js';
export { setCrypto, sha256Hex, hmacSha256Hex, pureSha256Hex, pureHmacSha256Hex, sha256Bytes, type CryptoImpl } from './crypto.js';
export {
  localTime, toIST, localMinutes, hhmmToMinutes, minutesBetween, outsideWindow, severityAt, DEFAULT_TIMEZONE,
} from './time.js';
export { missing, sample, resolvePath, plural } from './util.js';
export const ENGINE_VERSION = '0.1.0';

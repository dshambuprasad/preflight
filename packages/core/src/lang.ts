// A-RBI-003 — script detection for the vernacular-language rule.
//
// Deliberately detects SCRIPT, not language. Devanagari cannot distinguish Hindi
// from Marathi, and the tool must not pretend otherwise: it reports the script it
// found and lets the finding say so. (17: Unicode-range regex, not franc.)

const SCRIPTS: [string, RegExp, string[]][] = [
  ['devanagari', /[ऀ-ॿ]/, ['hindi', 'marathi', 'nepali', 'konkani', 'sanskrit']],
  ['bengali', /[ঀ-৿]/, ['bengali', 'assamese']],
  ['gurmukhi', /[਀-੿]/, ['punjabi']],
  ['gujarati', /[઀-૿]/, ['gujarati']],
  ['odia', /[଀-୿]/, ['odia', 'oriya']],
  ['tamil', /[஀-௿]/, ['tamil']],
  ['telugu', /[ఀ-౿]/, ['telugu']],
  ['kannada', /[ಀ-೿]/, ['kannada']],
  ['malayalam', /[ഀ-ൿ]/, ['malayalam']],
];

export interface ScriptDetection {
  script: string;
  languages: string[];
}

/**
 * script 'latin' means Latin characters only — English, or a romanised Indian
 * language, which this cannot tell apart. Reported honestly as such.
 */
export function detectScript(text: unknown): ScriptDetection {
  const s = String(text ?? '');
  for (const [script, re, languages] of SCRIPTS) {
    if (re.test(s)) return { script, languages };
  }
  return { script: 'latin', languages: ['english', 'romanised-indian-language'] };
}

export interface PreferenceMatch {
  ok: boolean;
  script: string;
  note?: string;
}

/**
 * Can this message plausibly be read by someone whose stated language is `preferred`?
 * `romanisedAcceptable` (Layer C) lists preferences for which Latin script is accepted (04 §9, 22 D5).
 */
export function matchesPreference(text: unknown, preferred: unknown, romanisedAcceptable: readonly string[] = []): PreferenceMatch {
  const { script, languages } = detectScript(text);
  const want = String(preferred ?? '').trim().toLowerCase();
  if (!want) return { ok: true, script, note: 'no stated preference' };

  if (script === 'latin') {
    if (want === 'english') return { ok: true, script };
    if (romanisedAcceptable.map((l) => l.toLowerCase()).includes(want)) {
      return { ok: true, script, note: 'romanised ' + want + ' accepted by tenant config' };
    }
    return {
      ok: false,
      script,
      note:
        'message is in Latin script; borrower prefers ' +
        want +
        '. May be romanised and acceptable — needs human review, not an automatic failure.',
    };
  }
  return { ok: languages.includes(want), script };
}

/** 08 §2 — small alias table; lowercase names are the canonical form. */
const LANGUAGE_ALIASES: Record<string, string> = {
  en: 'english', eng: 'english',
  hi: 'hindi', hin: 'hindi',
  ta: 'tamil', tam: 'tamil',
  te: 'telugu', tel: 'telugu',
  kn: 'kannada', kan: 'kannada',
  ml: 'malayalam', mal: 'malayalam',
  mr: 'marathi', mar: 'marathi',
  bn: 'bengali', ben: 'bengali', bangla: 'bengali',
  gu: 'gujarati', guj: 'gujarati',
  pa: 'punjabi', pan: 'punjabi',
  or: 'odia', ori: 'odia', oriya: 'odia',
  as: 'assamese', asm: 'assamese',
  ur: 'urdu', urd: 'urdu',
  ne: 'nepali', nep: 'nepali',
  kok: 'konkani', sa: 'sanskrit',
};

/** lowercase + alias; blank → null (field absent). */
export function normaliseLanguage(raw: unknown, extraAliases: Record<string, string> = {}): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  return extraAliases[s]?.toLowerCase() ?? LANGUAGE_ALIASES[s] ?? s;
}

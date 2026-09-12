// A-RBI-003 — script detection for the vernacular-language rule.
//
// Deliberately detects SCRIPT, not language. Devanagari cannot distinguish Hindi
// from Marathi, and the tool must not pretend otherwise: it reports the script it
// found and lets the finding say so. Overclaiming here would be exactly the
// dishonesty the concept note commits against.
//
// Enforcement basis: Hero FinCorp was penalised for not conveying loan terms in the
// borrower's vernacular language (RBI Fair Practices Code).

const SCRIPTS = [
  ['devanagari', /[ऀ-ॿ]/, ['hindi', 'marathi', 'nepali', 'konkani', 'sanskrit']],
  ['bengali',    /[ঀ-৿]/, ['bengali', 'assamese']],
  ['gurmukhi',   /[਀-੿]/, ['punjabi']],
  ['gujarati',   /[઀-૿]/, ['gujarati']],
  ['odia',       /[଀-୿]/, ['odia', 'oriya']],
  ['tamil',      /[஀-௿]/, ['tamil']],
  ['telugu',     /[ఀ-౿]/, ['telugu']],
  ['kannada',    /[ಀ-೿]/, ['kannada']],
  ['malayalam',  /[ഀ-ൿ]/, ['malayalam']],
];

/**
 * @returns {{ script: string, languages: string[] }}
 *   script 'latin' means Latin characters only — English, or a romanised Indian
 *   language, which this cannot tell apart. Reported honestly as such.
 */
export function detectScript(text) {
  const s = String(text ?? '');
  for (const [script, re, languages] of SCRIPTS) {
    if (re.test(s)) return { script, languages };
  }
  return { script: 'latin', languages: ['english', 'romanised-indian-language'] };
}

/**
 * Can this message plausibly be read by someone whose stated language is `preferred`?
 * @returns {{ ok: boolean, script: string, note?: string }}
 */
export function matchesPreference(text, preferred) {
  const { script, languages } = detectScript(text);
  const want = String(preferred ?? '').trim().toLowerCase();
  if (!want) return { ok: true, script, note: 'no stated preference' };

  if (script === 'latin') {
    // English in Latin script is fine. A non-English preference against Latin script
    // is a genuine ambiguity — romanised Hindi is common and legitimate.
    if (want === 'english') return { ok: true, script };
    return {
      ok: false, script,
      note: 'message is in Latin script; borrower prefers ' + want +
            '. May be romanised and acceptable — needs human review, not an automatic failure.',
    };
  }
  return { ok: languages.includes(want), script };
}

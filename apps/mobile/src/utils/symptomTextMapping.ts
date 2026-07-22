import type { SymptomKey } from '../models/LogEntry';

/**
 * Free-text symptom phrase → SymptomKey.
 *
 * Imported files (CSV/Clue/Flo) carry symptoms as human-readable note text, but
 * the app stores symptoms as structured `SymptomKey` pills. Without this bridge,
 * an imported "Backache" or "Fatigue" would sit in the free-text note forever
 * instead of lighting up its matching pill.
 *
 * Keys are the normalized phrase (lowercased, whitespace-collapsed) exactly as a
 * comma-delimited note token would appear. Only *unambiguous* phrases live here —
 * anything without a clean 1:1 pill (e.g. "body aches", "spotting / bleeding")
 * is deliberately absent and is left in the note untouched.
 */
const SYMPTOM_TEXT_MAP: Record<string, SymptomKey> = {
  // Cramps
  cramps: 'cramps',
  cramping: 'cramps',
  cramp: 'cramps',
  'period cramps': 'cramps',   // Clue `pain` option period_cramps
  // Bloating
  bloating: 'bloating',
  bloated: 'bloating',
  // Nausea
  nausea: 'nausea',
  nauseous: 'nausea',
  nauseated: 'nausea',
  // Fatigue
  fatigue: 'fatigue',
  tiredness: 'fatigue',
  exhaustion: 'fatigue',
  exhausted: 'fatigue',        // Clue `energy` option exhausted
  'low energy': 'fatigue',     // Flo Mood/LowEnergy
  // Headache
  headache: 'headache',
  headaches: 'headache',
  // Back pain
  backache: 'back_pain',
  'back ache': 'back_pain',
  'back pain': 'back_pain',
  'lower back pain': 'back_pain',
  'lower back': 'back_pain',   // Clue `pain` option lower_back
  // Acne
  acne: 'acne',
  breakout: 'acne',
  breakouts: 'acne',
  // Breast tenderness
  'breast tenderness': 'breast_tenderness',
  'breast sensitivity': 'breast_tenderness',
  'tender breasts': 'breast_tenderness',
  'sore breasts': 'breast_tenderness',
  'breast pain': 'breast_tenderness',
  // Mood
  'low mood': 'mood_low',
  anxious: 'mood_anxious',
  anxiety: 'mood_anxious',
  irritable: 'mood_irritable',
  irritability: 'mood_irritable',
};

/** Lowercase, collapse internal whitespace, strip surrounding punctuation/space. */
function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s.;:-]+|[\s.;:-]+$/g, '')
    .trim();
}

export interface ExtractedSymptoms {
  /** Recognized symptom pills, de-duplicated, in first-seen order. */
  symptoms: SymptomKey[];
  /** The note with recognized symptom tokens removed; '' if nothing is left. */
  rest: string;
}

/**
 * Pull recognized symptom pills out of a comma-delimited note string.
 *
 * Tokens that map cleanly to a `SymptomKey` are lifted into `symptoms`; every
 * other token is preserved verbatim (original casing) and rejoined into `rest`.
 * Matching is exact-per-token after normalization — conservative by design, so a
 * free-text sentence like "Felt off today" is never mis-tagged as a symptom.
 */
export function extractSymptomsFromNote(note: string): ExtractedSymptoms {
  const symptoms: SymptomKey[] = [];
  const seen = new Set<SymptomKey>();
  const rest: string[] = [];

  for (const rawToken of note.split(',')) {
    const trimmed = rawToken.trim();
    if (!trimmed) continue;

    const key = SYMPTOM_TEXT_MAP[normalizeToken(trimmed)];
    if (key) {
      if (!seen.has(key)) {
        seen.add(key);
        symptoms.push(key);
      }
    } else {
      rest.push(trimmed);
    }
  }

  return { symptoms, rest: rest.join(', ') };
}

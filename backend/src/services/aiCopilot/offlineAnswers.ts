/**
 * What the AI assistant says when it cannot ask an AI provider, and how it recognises what a
 * person is asking about from the built-in knowledge base.
 *
 * Two rules from CLAUDE.md apply here:
 *  - A person never reads developer instructions (".env", API keys, billing pages). Every message
 *    says what happened, why, and what they can do next. The technical detail goes to the logs.
 *  - Real people mistype ("feer" for "fever") and say things their own way ("loose motion"). An
 *    unmatched typo must not turn a sick-animal question into a dead end.
 */

/** Other words people use for each knowledge-base topic (the key is the VET_KNOWLEDGE key). */
const ALIASES: Record<string, string[]> = {
  fever: ['fever', 'temperature', 'febrile', 'pyrexia', 'feverish'],
  vomiting: ['vomiting', 'vomit', 'vomits', 'throwing', 'puking', 'puke', 'regurgitating'],
  lameness: ['lameness', 'lame', 'limping', 'limp', 'limps'],
  diarrhea: ['diarrhea', 'diarrhoea', 'scours'],
  coughing: ['coughing', 'cough', 'coughs', 'wheezing', 'sneezing'],
  weight_loss: ['emaciated'],
  skin: ['skin', 'itching', 'itchy', 'rash', 'scratching', 'mange', 'fleas', 'ticks'],
  vaccination: ['vaccination', 'vaccine', 'vaccines', 'vaccinate', 'vaccinated', 'booster', 'shots'],
  nutrition: ['nutrition', 'diet', 'feeding'],
  breeding: ['breeding', 'mating', 'pregnant', 'pregnancy'],
};

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/**
 * Which knowledge-base topic is this message about? Exact words and known aliases first; then a
 * single-letter slip (feer, fevr, vommiting) for words long enough that one letter is not a
 * different word. Returns the topic key, or null.
 */
export function matchKnowledgeTopic(message: string, topics: string[]): string | null {
  const words = message.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const wanted = topics;
  // Exact / alias hit.
  for (const topic of wanted) {
    const names = new Set([topic.replace(/_/g, ' '), ...(ALIASES[topic] || [topic])]);
    for (const w of words) if (names.has(w)) return topic;
  }
  // Two-word phrases people use.
  const lc = message.toLowerCase();
  if (/weight\s*loss|losing\s*weight/.test(lc) && topics.includes('weight_loss')) return 'weight_loss';
  if (/loose\s*motion/.test(lc) && topics.includes('diarrhea')) return 'diarrhea';
  // One-letter slip.
  for (const topic of wanted) {
    for (const name of ALIASES[topic] || [topic]) {
      if (name.length < 4) continue;
      for (const w of words) if (w.length >= 4 && Math.abs(w.length - name.length) <= 1 && editDistance(w, name) <= 1) return topic;
    }
  }
  return null;
}

/** The assistant has no AI provider at all on this server. */
export const AI_UNAVAILABLE_MESSAGE =
  'The AI assistant is not available right now, so I cannot answer this question properly.\n\n' +
  'What you can do:\n' +
  '- If your animal is unwell, book a consultation with a veterinarian from **Find a doctor** - they can examine and treat it.\n' +
  '- Try the **Symptom Analysis** or **Drug Interactions** tab for quick guidance.\n' +
  '- If it is an emergency (heavy bleeding, trouble breathing, seizures, poisoning), contact your nearest veterinary clinic right away.\n\n' +
  'The assistant will answer again once it is switched back on. We have let our team know.';

/** A provider is set up but did not answer this time (busy, timed out, or over its limit). */
export const AI_BUSY_MESSAGE =
  'The AI assistant could not answer just now. This is usually temporary because many people are asking at once.\n\n' +
  'What you can do:\n' +
  '- Wait a minute and ask again.\n' +
  '- If your animal is unwell, book a consultation with a veterinarian from **Find a doctor**.\n' +
  '- For an emergency, contact your nearest veterinary clinic right away.';

import database from '../../utils/database';
import logger from '../../utils/logger';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import AnimalAccessService, { ANIMAL_NO_ACCESS_MESSAGE } from '../AnimalAccessService';
import AiCopilotService from '../AiCopilotService';
import NutritionAccess, { type Caller } from './NutritionAccess';
import NutritionService from './NutritionService';
import { isAiAssistEnabled, isEntitled } from './NutritionConfig';
import { ageInMonths } from './engine/facts';
import { numbersIn, onlyKnownNumbers } from './engine/explainGuard';

/**
 * "Explain this plan in simple words" (docs/NUTRITION_PLAN.md §5.3 item 7; owner decision 2026-11-22: external AI
 * allowed for explanations, ANIMAL FACTS ONLY, numbers never from AI).
 *
 *   - What is sent: species, age, weight, condition, goal and the plan's own lines and numbers. Never the owner's
 *     name, phone, place, or the animal's name.
 *   - What comes back is checked: any number that is not one of the plan's numbers means the AI invented an amount,
 *     and the text is discarded (explainGuard.ts).
 *   - When AI is off, not configured, busy or rejected, the screen shows its own translated explanation built from the
 *     same numbers - the person always gets an answer.
 */

export const EXPLAIN_LANGUAGES: Record<string, string> = {
  en: 'English', hi: 'Hindi', kn: 'Kannada', ml: 'Malayalam', ta: 'Tamil', te: 'Telugu',
};

export type ExplainResult = { source: 'ai'; text: string } | { source: 'unavailable' | 'rejected'; text: null };

const SYSTEM = (language: string) => `You explain an animal's feeding plan to the person who feeds it, in plain ${language}.
Rules:
- Use ONLY the facts and numbers given. Never add, change, round differently or invent a number, amount, price or date.
- Do not give medical advice or diagnoses. If the plan says a vet should check it, say so.
- 4 to 6 short sentences a farmer or pet owner understands. No headings, no lists, no markdown.
- Say why the amounts are what they are (weight, age, work, milk, goal) and one practical tip about feeding them.
- Write numbers with ordinary digits.`;

const CACHE_MAX = 200;
const cache = new Map<string, string>();

class NutritionExplainService {

  async explain(planId: string, language: string, caller: Caller): Promise<ExplainResult> {
    const lang = EXPLAIN_LANGUAGES[language] ? language : 'en';
    const r = await database.query(`SELECT id, animal_id, group_id, updated_at FROM nutrition_plans WHERE id = $1`, [planId]);
    const row = r.rows[0];
    if (!row) throw new NotFoundError('Food plan');
    // The same gate as reading the plan itself.
    if (row.animal_id) await NutritionAccess.forAnimal(row.animal_id, caller, 'read');
    else {
      const access = await AnimalAccessService.checkGroup(caller, row.group_id, 'read');
      if (!access.found) throw new NotFoundError('Food plan');
      if (!access.allowed) throw new ForbiddenError(ANIMAL_NO_ACCESS_MESSAGE);
    }

    if (!(await isEntitled(caller.userId, 'ai_assist')) || !(await isAiAssistEnabled()) || !AiCopilotService.isConfigured()) {
      return { source: 'unavailable', text: null };
    }
    const key = `${planId}:${new Date(row.updated_at).getTime()}:${lang}`;
    const hit = cache.get(key);
    if (hit) return { source: 'ai', text: hit };

    const facts = await this.facts(row);
    const text = await AiCopilotService.completeOnce(SYSTEM(EXPLAIN_LANGUAGES[lang]), JSON.stringify(facts), { maxTokens: 450, temperature: 0.2 });
    if (!text) return { source: 'unavailable', text: null };
    const check = onlyKnownNumbers(text, numbersIn(JSON.stringify(facts)));
    if (!check.ok) {
      logger.warn('AI plan explanation discarded: it contained numbers that are not in the plan', { planId, unknown: check.unknown.slice(0, 10) });
      return { source: 'rejected', text: null };
    }
    const clean = text.replace(/[*#_`]/g, '').slice(0, 2000);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, clean);
    NutritionService.track(caller, 'plan_explained').catch(() => {});
    return { source: 'ai', text: clean };
  }

  /** Animal facts and the plan's own numbers - no personal data (no owner, no place, no animal name). */
  private async facts(row: { id: string; animal_id: string | null; group_id: string | null }) {
    const plan = await NutritionService.planById(row.id);
    const subject: Record<string, unknown> = {};
    if (row.animal_id) {
      const { facts } = await NutritionService.loadFacts(row.animal_id);
      Object.assign(subject, {
        species: facts.speciesCode, ageMonths: ageInMonths(facts.dateOfBirth), sex: facts.gender, neutered: facts.isNeutered,
        weightKg: facts.weightKg, bodyConditionOutOf9: facts.bcs9, activity: facts.activityLevel,
        milkLitresPerDay: facts.avgDailyMilkLitres,
      });
    } else {
      const g = await database.query(`SELECT species, current_count FROM animal_groups WHERE id = $1`, [row.group_id]);
      Object.assign(subject, { species: g.rows[0]?.species, herd: true, animalsInHerd: plan.ration?.herd?.headCount ?? g.rows[0]?.current_count });
    }
    const ration = plan.ration;
    return {
      animal: subject,
      plan: {
        kind: ration ? 'farm ration (kg of each feed per animal per day)' : 'pet food plan (grams per day)',
        goal: plan.goal,
        checkedByVet: plan.validation === 'vet_reviewed',
        vetShouldCheck: plan.requiresVet,
        knownAllergies: plan.allergies,
        dailyEnergyKcal: ration ? undefined : plan.effectiveKcal,
        mealsPerDay: ration ? undefined : plan.mealsPerDay,
        dryMatterKgPerDay: ration ? plan.dailyDmKg : undefined,
        costPerDay: ration?.totalCostPerDay ?? undefined,
        costPerLitreOfMilk: ration?.costPerLitre ?? undefined,
        herdCostPerDay: ration?.herd?.totalCostPerDay ?? undefined,
        work: ration?.work ?? undefined,
        foods: plan.items.map((i: any) => (ration
          ? { feed: i.label, kgPerDay: i.amountPerDay, costPerDay: i.costPerDay }
          : { food: i.label, gramsPerDay: i.gramsPerDay, gramsPerMeal: i.gramsPerMeal, kcalPerDay: i.kcalPerDay })),
        // The vet's free-text note is NOT sent: it is written to a person and may name them.
      },
    };
  }
}

export default new NutritionExplainService();

/**
 * AI Veterinary Copilot Service
 * Conversational AI assistant with symptom analysis, drug interaction checks,
 * treatment suggestions, and contextual animal health intelligence.
 *
 * Provider priority:
 *   1. Groq  (GROQ_API_KEY)  — free, fast, llama-3.3-70b
 *   2. OpenAI (OPENAI_API_KEY) — GPT-4o (requires paid plan)
 *   3. Local knowledge-base fallback
 */
import path from 'path';
import dotenv from 'dotenv';
// Load .env before any env-variable checks
dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../utils/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

interface AiClient {
  client: OpenAI;
  model: string;
  provider: string;
}

// Lazy-initialised after dotenv has loaded
let _ai: AiClient | null | undefined;
function getAI(): AiClient | null {
  if (_ai === undefined) {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    if (groqKey) {
      _ai = {
        client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' }),
        model: 'llama-3.3-70b-versatile',
        provider: 'Groq (llama-3.3-70b)'
      };
      logger.info('AI Copilot: using Groq llama-3.3-70b (free tier)');
    } else if (openaiKey) {
      _ai = {
        client: new OpenAI({ apiKey: openaiKey }),
        model: 'gpt-4o',
        provider: 'OpenAI GPT-4o'
      };
      logger.info('AI Copilot: using OpenAI GPT-4o');
    } else {
      _ai = null;
      logger.warn('AI Copilot: no GROQ_API_KEY or OPENAI_API_KEY — running in offline mode');
    }
  }
  return _ai;
}

// Keep backward-compat helper used in existing methods
function getOpenAI(): OpenAI | null { return getAI()?.client ?? null; }

const SYSTEM_PROMPT = `You are an expert AI Veterinary Copilot integrated into a professional veterinary consultation platform. Your role is to assist veterinarians and farmers with:
- Symptom analysis and differential diagnoses across all common livestock and companion animal species (cattle, sheep, goats, pigs, poultry, dogs, cats, horses, etc.)
- Drug interaction checks and pharmacology guidance
- Treatment protocol suggestions based on current evidence-based veterinary medicine
- Preventive care, vaccination schedules, and nutritional recommendations
- Emergency triage guidance

Always:
- Be concise, practical, and clinically relevant
- Include confidence level when uncertain
- Recommend consulting a licensed veterinarian for any diagnosis or treatment decision
- Mention when symptoms warrant emergency care
- Cite relevant guidelines (AVMA, AAHA, WSAVA, Merck Veterinary Manual) where appropriate

Respond in a structured, easy-to-read format. Never give harmful advice or encourage bypassing professional veterinary care.`;

// ── Veterinary knowledge base for AI responses ──
const VET_KNOWLEDGE: Record<string, { response: string; confidence: number; sources: string[] }> = {
  fever: { response: 'Fever in animals can indicate infection, inflammation, or heat stroke. Recommended: Check rectal temperature, assess hydration, look for other symptoms like lethargy or loss of appetite. If temp exceeds 103°F (dogs) or 102.5°F (cats), consult a veterinarian promptly.', confidence: 85, sources: ['Merck Veterinary Manual', 'AVMA Guidelines'] },
  vomiting: { response: 'Vomiting can be caused by dietary indiscretion, infections, toxins, or GI obstruction. Withhold food for 12-24h, offer small amounts of water. If vomiting persists >24h, contains blood, or animal is lethargic, seek immediate veterinary care.', confidence: 82, sources: ['Small Animal Internal Medicine', 'AVMA'] },
  lameness: { response: 'Lameness may indicate injury, arthritis, fracture, or hoof/paw issues. Examine the affected limb for swelling, heat, or wounds. For livestock, check hooves for rot or foreign objects. Rest and anti-inflammatory medication may help; radiographs recommended for persistent cases.', confidence: 80, sources: ['Veterinary Orthopedics', 'AAHA'] },
  diarrhea: { response: 'Diarrhea can result from dietary changes, parasites, bacterial infections, or stress. Ensure hydration with electrolyte solutions. Collect fecal sample for analysis. If bloody, lasting >48h, or accompanied by dehydration, veterinary attention is needed.', confidence: 83, sources: ['Merck Veterinary Manual'] },
  coughing: { response: 'Coughing in animals may indicate kennel cough, pneumonia, heart disease, or allergies. Note frequency, productivity (wet vs dry), and triggers. Chest radiographs and auscultation recommended. Isolate from other animals if infectious cause suspected.', confidence: 78, sources: ['Respiratory Medicine in Veterinary Practice'] },
  weight_loss: { response: 'Unexplained weight loss can signal parasites, dental disease, diabetes, kidney disease, or cancer. Assess diet adequacy, check for parasites, run bloodwork (CBC, chemistry panel, thyroid). Gradual loss >10% body weight warrants thorough investigation.', confidence: 81, sources: ['Clinical Veterinary Medicine'] },
  skin: { response: 'Skin issues (itching, redness, hair loss) commonly caused by allergies, fleas, mites, fungal infections, or hormonal imbalances. Perform skin scraping, fungal culture, or allergy testing. Topical treatments, antihistamines, or medicated shampoos often effective.', confidence: 79, sources: ['Veterinary Dermatology'] },
  vaccination: { response: 'Core vaccines vary by species. Dogs: DHPP, Rabies. Cats: FVRCP, Rabies. Cattle: BVD, IBR, PI3. Follow age-appropriate schedules starting at 6-8 weeks with boosters every 2-4 weeks until 16 weeks, then annual/triennial boosters.', confidence: 90, sources: ['AAHA Vaccination Guidelines', 'WSAVA'] },
  nutrition: { response: 'Nutritional needs vary by species, age, breed, and activity level. Ensure balanced protein, fat, carbohydrates, vitamins, and minerals. Large breed puppies need controlled growth diets. Senior animals benefit from joint supplements and reduced calories.', confidence: 85, sources: ['NRC Nutrient Requirements', 'AAFCO Guidelines'] },
  breeding: { response: 'Breeding considerations include genetic screening, optimal timing (progesterone testing), reproductive soundness exams, and prenatal care. Monitor for dystocia signs during delivery. Post-partum: check for mastitis, adequate milk production, and neonatal health.', confidence: 82, sources: ['Veterinary Reproduction', 'Theriogenology'] },
};

const DRUG_INTERACTIONS: Record<string, { interactsWith: string[]; severity: string; note: string }[]> = {
  nsaids: [{ interactsWith: ['corticosteroids'], severity: 'high', note: 'Concurrent use increases GI ulceration risk significantly' }, { interactsWith: ['ace_inhibitors'], severity: 'medium', note: 'May reduce antihypertensive effect and impair renal function' }],
  metronidazole: [{ interactsWith: ['phenobarbital'], severity: 'medium', note: 'Phenobarbital may decrease metronidazole efficacy via hepatic enzyme induction' }],
  ivermectin: [{ interactsWith: ['ketoconazole'], severity: 'medium', note: 'Ketoconazole may increase ivermectin levels; monitor closely' }],
  amoxicillin: [{ interactsWith: ['methotrexate'], severity: 'high', note: 'May increase methotrexate toxicity' }],
};

class AiCopilotService {

  // ── Build Personalized User Context (FULL life history) ──
  private async buildUserContext(userId: string): Promise<string> {
    try {
      const sections: string[] = [];

      // 1. User profile
      const userRes = await pool.query(
        `SELECT first_name, last_name, email, role, phone, created_at FROM users WHERE id = $1`,
        [userId]
      );
      const user = userRes.rows[0];
      if (user) {
        sections.push(`## Current User\nName: ${user.first_name} ${user.last_name}\nRole: ${user.role}\nMember since: ${new Date(user.created_at).toLocaleDateString()}`);
      }

      // 2. ALL animals owned by this user (including inactive for historical context)
      const animalsRes = await pool.query(
        `SELECT id, name, species, breed, date_of_birth, gender, weight, weight_unit,
                microchip_number, is_neutered, is_active, color, created_at
         FROM animals WHERE owner_id = $1
         ORDER BY is_active DESC, created_at DESC`,
        [userId]
      );
      if (animalsRes.rows.length > 0) {
        const animalLines = animalsRes.rows.map((a: any) => {
          const age = a.date_of_birth
            ? this.formatAge(new Date(a.date_of_birth))
            : 'unknown age';
          const dob = a.date_of_birth ? `, DOB: ${new Date(a.date_of_birth).toLocaleDateString()}` : '';
          const inactive = a.is_active ? '' : ' [INACTIVE/DECEASED]';
          return `- **${a.name}**${inactive}: ${a.species}${a.breed ? ` (${a.breed})` : ''}, ${a.gender || 'unknown gender'}, ${age}${dob}${a.weight ? `, ${a.weight}${a.weight_unit || 'kg'}` : ''}${a.color ? `, ${a.color}` : ''}${a.is_neutered ? ', neutered' : ''}${a.microchip_number ? `, chip: ${a.microchip_number}` : ''}`;
        });
        sections.push(`## Their Animals (${animalsRes.rows.length})\n${animalLines.join('\n')}`);
      }

      const animalIds = animalsRes.rows.map((a: any) => a.id);
      if (animalIds.length === 0) return sections.join('\n\n');

      // Run all history queries in parallel for speed
      const [medRes, vaccRes, rxRes, consultRes, allergyRes, weightRes, labRes, bookingRes] = await Promise.all([
        // 3. ALL medical records (complete life history)
        pool.query(
          `SELECT mr.title, mr.record_type, mr.content, mr.created_at, a.name AS animal_name
           FROM medical_records mr
           JOIN animals a ON mr.animal_id = a.id
           WHERE mr.animal_id = ANY($1)
           ORDER BY mr.created_at DESC`,
          [animalIds]
        ),
        // 4. ALL vaccinations (complete history)
        pool.query(
          `SELECT v.vaccine_name, v.date_administered, v.next_due_date, v.batch_number,
                  a.name AS animal_name
           FROM vaccinations v
           JOIN animals a ON v.animal_id = a.id
           WHERE v.animal_id = ANY($1)
           ORDER BY v.date_administered DESC`,
          [animalIds]
        ),
        // 5. ALL prescriptions (complete history)
        pool.query(
          `SELECT p.medication_name, p.dosage, p.frequency, p.duration, p.status,
                  p.instructions, p.start_date, p.end_date, p.created_at,
                  a.name AS animal_name
           FROM prescriptions p
           JOIN consultations c ON p.consultation_id = c.id
           JOIN animals a ON c.animal_id = a.id
           WHERE c.animal_id = ANY($1)
           ORDER BY p.created_at DESC`,
          [animalIds]
        ),
        // 6. ALL consultations (complete history)
        pool.query(
          `SELECT c.reason, c.status, c.diagnosis, c.notes, c.treatment_plan,
                  c.follow_up_date, c.created_at, a.name AS animal_name,
                  u.first_name AS vet_first, u.last_name AS vet_last
           FROM consultations c
           JOIN animals a ON c.animal_id = a.id
           LEFT JOIN users u ON c.doctor_id = u.id
           WHERE c.animal_id = ANY($1)
           ORDER BY c.created_at DESC`,
          [animalIds]
        ),
        // 7. ALL allergies
        pool.query(
          `SELECT al.allergen, al.severity, al.reaction, al.is_active,
                  al.identified_date, a.name AS animal_name
           FROM allergy_records al
           JOIN animals a ON al.animal_id = a.id
           WHERE al.animal_id = ANY($1)
           ORDER BY al.identified_date DESC NULLS LAST`,
          [animalIds]
        ),
        // 8. Weight history (full trend)
        pool.query(
          `SELECT wh.weight, wh.unit, wh.recorded_at, wh.notes, a.name AS animal_name
           FROM weight_history wh
           JOIN animals a ON wh.animal_id = a.id
           WHERE wh.animal_id = ANY($1)
           ORDER BY wh.recorded_at DESC`,
          [animalIds]
        ),
        // 9. ALL lab results
        pool.query(
          `SELECT lr.test_name, lr.test_category, lr.test_date, lr.result_value,
                  lr.normal_range, lr.unit, lr.is_abnormal, lr.interpretation,
                  lr.status, a.name AS animal_name
           FROM lab_results lr
           JOIN animals a ON lr.animal_id = a.id
           WHERE lr.animal_id = ANY($1)
           ORDER BY lr.test_date DESC`,
          [animalIds]
        ),
        // 10. Upcoming & recent bookings
        pool.query(
          `SELECT b.scheduled_date, b.time_slot_start, b.status, b.booking_type,
                  b.reason_for_visit, b.symptoms, b.priority, a.name AS animal_name,
                  u.first_name AS vet_first, u.last_name AS vet_last
           FROM bookings b
           LEFT JOIN animals a ON b.animal_id = a.id
           LEFT JOIN users u ON b.veterinarian_id = u.id
           WHERE b.pet_owner_id = $1
           ORDER BY b.scheduled_date DESC`,
          [userId]
        ),
      ]);

      // 3. Medical records — group by animal, show all with year headers
      if (medRes.rows.length > 0) {
        const grouped = this.groupByAnimal(medRes.rows, (r: any) =>
          `[${new Date(r.created_at).toLocaleDateString()}] ${r.record_type}: ${r.title}${r.content ? ` — ${r.content.substring(0, 150)}` : ''}`
        );
        sections.push(`## Complete Medical History (${medRes.rows.length} records)\n${grouped}`);
      }

      // 4. Vaccinations — full history
      if (vaccRes.rows.length > 0) {
        const grouped = this.groupByAnimal(vaccRes.rows, (v: any) =>
          `${v.vaccine_name} on ${new Date(v.date_administered).toLocaleDateString()}${v.next_due_date ? ` (next due: ${new Date(v.next_due_date).toLocaleDateString()})` : ''}${v.batch_number ? ` [batch: ${v.batch_number}]` : ''}`
        );
        sections.push(`## Complete Vaccination History (${vaccRes.rows.length} records)\n${grouped}`);
      }

      // 5. Prescriptions — full history
      if (rxRes.rows.length > 0) {
        const grouped = this.groupByAnimal(rxRes.rows, (p: any) =>
          `[${new Date(p.created_at).toLocaleDateString()}] ${p.medication_name} ${p.dosage || ''} ${p.frequency || ''} for ${p.duration || 'ongoing'} (${p.status})${p.instructions ? ` — ${p.instructions.substring(0, 100)}` : ''}`
        );
        sections.push(`## Complete Prescription History (${rxRes.rows.length} records)\n${grouped}`);
      }

      // 6. Consultations — full history
      if (consultRes.rows.length > 0) {
        const grouped = this.groupByAnimal(consultRes.rows, (c: any) =>
          `[${new Date(c.created_at).toLocaleDateString()}] ${c.reason || 'General'}${c.diagnosis ? ` → Dx: ${c.diagnosis}` : ''}${c.treatment_plan ? ` → Tx: ${c.treatment_plan.substring(0, 100)}` : ''} (${c.status})${c.vet_first ? ` with Dr. ${c.vet_first} ${c.vet_last}` : ''}${c.follow_up_date ? ` [follow-up: ${new Date(c.follow_up_date).toLocaleDateString()}]` : ''}`
        );
        sections.push(`## Complete Consultation History (${consultRes.rows.length} records)\n${grouped}`);
      }

      // 7. Allergies (always critical — show ALL)
      if (allergyRes.rows.length > 0) {
        const alLines = allergyRes.rows.map((al: any) =>
          `- **${al.animal_name}**: ${al.allergen} (${al.severity})${al.reaction ? ` — ${al.reaction}` : ''}${al.is_active === false ? ' [resolved]' : ' [ACTIVE]'}${al.identified_date ? ` since ${new Date(al.identified_date).toLocaleDateString()}` : ''}`
        );
        sections.push(`## Known Allergies (${allergyRes.rows.length})\n${alLines.join('\n')}`);
      }

      // 8. Weight history (show trend per animal)
      if (weightRes.rows.length > 0) {
        const grouped = this.groupByAnimal(weightRes.rows, (w: any) =>
          `${new Date(w.recorded_at).toLocaleDateString()}: ${w.weight}${w.unit || 'kg'}${w.notes ? ` (${w.notes})` : ''}`
        );
        sections.push(`## Weight History / Growth Trend\n${grouped}`);
      }

      // 9. Lab results — full history, flag abnormals
      if (labRes.rows.length > 0) {
        const grouped = this.groupByAnimal(labRes.rows, (lr: any) =>
          `[${new Date(lr.test_date).toLocaleDateString()}] ${lr.test_name}${lr.test_category ? ` (${lr.test_category})` : ''}: ${lr.result_value || 'pending'}${lr.unit ? ` ${lr.unit}` : ''}${lr.normal_range ? ` [normal: ${lr.normal_range}]` : ''}${lr.is_abnormal ? ' ⚠️ ABNORMAL' : ''}${lr.interpretation ? ` — ${lr.interpretation.substring(0, 100)}` : ''}`
        );
        sections.push(`## Complete Lab Results (${labRes.rows.length})\n${grouped}`);
      }

      // 10. Bookings
      if (bookingRes.rows.length > 0) {
        const now = new Date();
        const upcoming = bookingRes.rows.filter((b: any) => new Date(b.scheduled_date) >= now && b.status !== 'cancelled');
        const past = bookingRes.rows.filter((b: any) => new Date(b.scheduled_date) < now || b.status === 'cancelled');

        if (upcoming.length > 0) {
          const uLines = upcoming.map((b: any) =>
            `- ${new Date(b.scheduled_date).toLocaleDateString()} ${b.time_slot_start}${b.animal_name ? ` for **${b.animal_name}**` : ''}: ${b.booking_type} (${b.status})${b.reason_for_visit ? ` — ${b.reason_for_visit}` : ''}${b.priority === 'emergency' ? ' 🚨 EMERGENCY' : ''}${b.vet_first ? ` with Dr. ${b.vet_first} ${b.vet_last}` : ''}`
          );
          sections.push(`## Upcoming Appointments (${upcoming.length})\n${uLines.join('\n')}`);
        }
        if (past.length > 0) {
          const pLines = past.slice(0, 20).map((b: any) =>
            `- ${new Date(b.scheduled_date).toLocaleDateString()}${b.animal_name ? ` **${b.animal_name}**` : ''}: ${b.booking_type} (${b.status})${b.reason_for_visit ? ` — ${b.reason_for_visit}` : ''}${b.symptoms ? ` [symptoms: ${b.symptoms.substring(0, 80)}]` : ''}`
          );
          sections.push(`## Past Appointments (${past.length} total, showing recent 20)\n${pLines.join('\n')}`);
        }
      }

      return sections.join('\n\n');
    } catch (err: any) {
      logger.warn('Failed to build user context for AI', { error: err?.message, userId });
      return '';
    }
  }

  // Helper: calculate human-readable age from DOB
  private formatAge(dob: Date): string {
    const now = new Date();
    const years = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(((now.getTime() - dob.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    if (years > 0) return `${years}y ${months}m`;
    return `${months}m`;
  }

  // Helper: group records by animal_name for cleaner output
  private groupByAnimal(rows: any[], formatter: (row: any) => string): string {
    const byAnimal: Record<string, string[]> = {};
    for (const row of rows) {
      const name = row.animal_name || 'Unknown';
      if (!byAnimal[name]) byAnimal[name] = [];
      byAnimal[name].push(formatter(row));
    }
    return Object.entries(byAnimal)
      .map(([name, lines]) => `### ${name}\n${lines.map(l => `- ${l}`).join('\n')}`)
      .join('\n');
  }

  // ── AI Scan / MRI / X-Ray Analysis ──
  async analyzeScan(imageBase64: string, mimeType: string, context: { species?: string; scanType?: string; bodyPart?: string; notes?: string } = {}) {
    const ai = getAI();
    if (!ai) {
      return {
        success: false,
        analysis: null,
        error: 'No AI provider configured. Set GROQ_API_KEY in the backend environment.',
        provider: 'none'
      };
    }

    const contextLines = [
      context.species ? `Species: ${context.species}` : '',
      context.scanType ? `Scan type: ${context.scanType}` : '',
      context.bodyPart ? `Body part / region: ${context.bodyPart}` : '',
      context.notes ? `Clinical notes: ${context.notes}` : '',
    ].filter(Boolean).join('\n');

    const scanPrompt = `You are an expert veterinary radiologist and diagnostic imaging specialist. Analyze the provided veterinary medical image (X-ray, MRI, ultrasound, CT scan, or clinical photo).

${contextLines ? `Patient context:\n${contextLines}\n` : ''}
Provide a structured analysis with these sections:

## Image Type & Quality
Identify the type of image and assess its diagnostic quality.

## Key Findings
List all observable findings, numbered, from most to least significant.

## Triage Assessment
Classify urgency: **Critical** (immediate intervention), **Urgent** (within 24h), **Moderate** (schedule follow-up), or **Routine** (monitor).

## Differential Diagnoses
List possible diagnoses ranked by likelihood with brief reasoning.

## Recommended Next Steps
Suggest follow-up diagnostics, treatments, or specialist referrals.

## Confidence Level
Rate your overall confidence (0-100%) and explain any limitations.

IMPORTANT: Always include a disclaimer that this is AI-assisted analysis and should be confirmed by a licensed veterinarian.`;

    try {
      // Try vision models in order — fallback chain so deprecations don't break the feature
      const visionModels = ai.provider.includes('Groq')
        ? ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile']
        : [ai.model];

      let lastError: any = null;
      for (const visionModel of visionModels) {
        try {
          const completion = await ai.client.chat.completions.create({
            model: visionModel,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: scanPrompt },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
                ]
              }
            ],
            max_tokens: 1500,
            temperature: 0.3
          });

          const content = completion.choices[0]?.message?.content ?? 'Unable to analyze the image.';
          const tokens = completion.usage?.total_tokens ?? 0;

          // Extract triage level from the response
          const triageLower = content.toLowerCase();
          let triageLevel: 'critical' | 'urgent' | 'moderate' | 'routine' = 'routine';
          if (triageLower.includes('**critical**')) triageLevel = 'critical';
          else if (triageLower.includes('**urgent**')) triageLevel = 'urgent';
          else if (triageLower.includes('**moderate**')) triageLevel = 'moderate';

          return {
            success: true,
            analysis: content,
            triageLevel,
            tokens,
            provider: ai.provider,
            disclaimer: 'This is AI-assisted analysis for veterinary professional reference only. All findings must be confirmed by a licensed veterinarian before clinical decisions are made.'
          };
        } catch (modelErr: any) {
          lastError = modelErr;
          // If model is decommissioned/not found, try next; otherwise rethrow
          if (modelErr?.status === 400 || modelErr?.status === 404) {
            logger.warn(`Vision model ${visionModel} unavailable, trying next`, { error: modelErr?.message });
            continue;
          }
          throw modelErr;
        }
      }
      // All models exhausted
      throw lastError;
    } catch (err: any) {
      logger.error('AI scan analysis error', { error: err?.message });

      if (err?.status === 429) {
        return {
          success: false,
          analysis: null,
          error: `AI provider rate limit exceeded. Please try again in a moment.`,
          provider: ai.provider
        };
      }

      return {
        success: false,
        analysis: null,
        error: err?.message || 'Failed to analyze image',
        provider: ai.provider
      };
    }
  }

  // ── Sessions ──
  async listSessions(userId: string, filters: any = {}) {
    const { limit = 50, offset = 0, status } = filters;
    let query = `SELECT s.id, s.title, s.status,
                   s.enterprise_id AS "enterpriseId",
                   s.user_id       AS "userId",
                   s.animal_id     AS "animalId",
                   s.context_type  AS "contextType",
                   s.message_count AS "messageCount",
                   s.last_message_at AS "lastMessageAt",
                   s.created_at    AS "createdAt",
                   s.updated_at    AS "updatedAt",
                   a.name AS "animalName", a.species, a.breed,
                   e.name AS "enterpriseName"
                 FROM ai_chat_sessions s
                 LEFT JOIN animals a ON s.animal_id = a.id
                 LEFT JOIN enterprises e ON s.enterprise_id = e.id
                 WHERE s.user_id = $1`;
    const params: any[] = [userId];
    let idx = 2;
    if (status) { query += ` AND s.status = $${idx++}`; params.push(status); }
    query += ` ORDER BY s.updated_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    return { items: result.rows, total: result.rows.length };
  }

  async createSession(data: any) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO ai_chat_sessions (id, enterprise_id, user_id, animal_id, title, context_type)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, data.enterpriseId || null, data.userId, data.animalId || null, data.title || 'New Chat', data.contextType || 'general']
    );
    const result = await pool.query(
      `SELECT id, title, status,
              enterprise_id AS "enterpriseId", user_id AS "userId",
              animal_id AS "animalId", context_type AS "contextType",
              message_count AS "messageCount", last_message_at AS "lastMessageAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM ai_chat_sessions WHERE id = $1`, [id]);
    return result.rows[0];
  }

  async getSession(sessionId: string) {
    const result = await pool.query(
      `SELECT s.id, s.title, s.status,
              s.enterprise_id AS "enterpriseId", s.user_id AS "userId",
              s.animal_id AS "animalId", s.context_type AS "contextType",
              s.message_count AS "messageCount", s.last_message_at AS "lastMessageAt",
              s.created_at AS "createdAt", s.updated_at AS "updatedAt",
              a.name AS "animalName", a.species, a.breed,
              e.name AS "enterpriseName"
       FROM ai_chat_sessions s
       LEFT JOIN animals a ON s.animal_id = a.id
       LEFT JOIN enterprises e ON s.enterprise_id = e.id
       WHERE s.id = $1`, [sessionId]
    );
    return result.rows[0] || null;
  }

  async deleteSession(sessionId: string) {
    await pool.query('DELETE FROM ai_chat_sessions WHERE id = $1', [sessionId]);
  }

  // ── Messages ──
  async listMessages(sessionId: string) {
    const result = await pool.query(
      `SELECT id, session_id AS "sessionId", role, content, content_type AS "contentType",
              tokens_used AS "tokensUsed", confidence, sources,
              created_at AS "createdAt"
       FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]
    );
    return result.rows;
  }

  async sendMessage(sessionId: string, userId: string, content: string) {
    // Save user message
    const userMsgId = uuidv4();
    await pool.query(
      `INSERT INTO ai_chat_messages (id, session_id, role, content) VALUES ($1,$2,'user',$3)`,
      [userMsgId, sessionId, content]
    );

    // Build conversation history for context
    const history = await pool.query(
      `SELECT role, content FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    // Build personalized user context from their animals, records, prescriptions, etc.
    const userContext = await this.buildUserContext(userId);

    // Generate AI response (real GPT or fallback)
    const aiResponse = await this.generateAiResponse(content, history.rows, userContext);

    // Save AI response
    const aiMsgId = uuidv4();
    await pool.query(
      `INSERT INTO ai_chat_messages (id, session_id, role, content, confidence, sources, tokens_used)
       VALUES ($1,$2,'assistant',$3,$4,$5,$6)`,
      [aiMsgId, sessionId, aiResponse.content, aiResponse.confidence, JSON.stringify(aiResponse.sources), aiResponse.tokens]
    );

    // Update session
    await pool.query(
      `UPDATE ai_chat_sessions SET message_count = message_count + 2, last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [sessionId]
    );

    return {
      userMessage: { id: userMsgId, sessionId, role: 'user', content, createdAt: new Date().toISOString() },
      aiMessage: { id: aiMsgId, sessionId, role: 'assistant', content: aiResponse.content, confidence: aiResponse.confidence, sources: aiResponse.sources, createdAt: new Date().toISOString() }
    };
  }

  // ── Drug Interaction Check ──
  async checkDrugInteractions(drugs: string[]) {
    const normalized = drugs.map(d => d.toLowerCase().trim());

    const ai = getAI();
    if (ai) {
      try {
        const prompt = `Check for drug interactions between the following veterinary medications: ${drugs.join(', ')}. For each interaction found, state: drug pair, severity (low/medium/high), and clinical note. If no interactions, say so clearly.`;
        const completion = await ai.client.chat.completions.create({
          model: ai.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.3
        });
        const text = completion.choices[0]?.message?.content ?? '';
        return { drugs: normalized, aiAnalysis: text, interactions: [], hasInteractions: text.toLowerCase().includes('interaction'), provider: ai.provider };
      } catch (err: any) {
        const hint = err?.status === 429 ? ' (quota exceeded — add billing or switch to Groq)' : '';
        logger.warn(`AI drug check failed${hint}`, { error: err?.message });
      }
    }

    // Local fallback
    const interactions: any[] = [];
    for (const drug of normalized) {
      const known = DRUG_INTERACTIONS[drug];
      if (!known) continue;
      for (const interaction of known) {
        for (const other of interaction.interactsWith) {
          if (normalized.includes(other)) {
            interactions.push({ drug1: drug, drug2: other, severity: interaction.severity, note: interaction.note });
          }
        }
      }
    }
    return { drugs: normalized, interactions, hasInteractions: interactions.length > 0, provider: 'local' };
  }

  // ── Symptom Analysis ──
  async analyzeSymptoms(symptoms: string[], species?: string) {
    const ai = getAI();
    if (ai) {
      try {
        const prompt = `Analyze the following symptoms in a ${species || 'animal'}: ${symptoms.join(', ')}. Provide: 1) Most likely differential diagnoses, 2) Urgency level (low/moderate/high/emergency), 3) Recommended immediate actions, 4) Diagnostic tests to consider.`;
        const completion = await ai.client.chat.completions.create({
          model: ai.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600,
          temperature: 0.3
        });
        const text = completion.choices[0]?.message?.content ?? '';
        const isUrgent = /emergency|urgent|immediate/i.test(text);
        return {
          symptoms, species: species || 'unspecified',
          aiAnalysis: text,
          findings: [],
          overallUrgency: isUrgent ? 'high' : 'moderate',
          disclaimer: 'AI-assisted analysis. Always consult a licensed veterinarian for diagnosis and treatment.',
          provider: ai.provider
        };
      } catch (err: any) {
        const hint = err?.status === 429 ? ' (quota exceeded — add billing or switch to Groq)' : '';
        logger.warn(`AI symptom analysis failed${hint}`, { error: err?.message });
      }
    }

    // Local fallback
    const findings: any[] = [];
    for (const symptom of symptoms) {
      const lcSymptom = symptom.toLowerCase();
      for (const [key, knowledge] of Object.entries(VET_KNOWLEDGE)) {
        if (lcSymptom.includes(key) || key.includes(lcSymptom)) {
          findings.push({ symptom, ...knowledge });
        }
      }
    }
    return {
      symptoms, species: species || 'unspecified',
      findings, overallUrgency: findings.some(f => f.confidence > 85) ? 'moderate' : 'low',
      disclaimer: 'This is AI-assisted analysis. Always consult a licensed veterinarian for diagnosis and treatment.',
      provider: 'local'
    };
  }

  // ── Private: AI response generation ──
  private async generateAiResponse(
    userMessage: string,
    history: { role: string; content: string }[] = [],
    userContext: string = ''
  ): Promise<{ content: string; confidence: number; sources: string[]; tokens: number }> {

    // Build personalized system prompt
    const personalizedPrompt = userContext
      ? `${SYSTEM_PROMPT}\n\n--- COMPLETE PATIENT PROFILE (user's full data from the platform) ---\n${userContext}\n---\nYou have the user's COMPLETE history — from their animals' birth/registration date through today. Use this full context to:\n- Reference specific animals by name, breed, age, and current weight\n- Correlate current symptoms with past diagnoses, treatments, and lab results\n- Flag if a current medication might conflict with known allergies or past prescriptions\n- Note overdue vaccinations or missed follow-ups based on dates\n- Track weight trends (gaining/losing) over time and alert on concerning changes\n- Reference abnormal lab results and past conditions when advising on new symptoms\n- Remind about upcoming appointments\nDo not dump the context back — weave it naturally into your clinical advice.`
      : SYSTEM_PROMPT;

    // ── AI path ──
    const ai = getAI();
    if (ai) {
      try {
        // Build message list: system + history + new user message
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: personalizedPrompt },
          ...history.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }))
        ];
        // Remove the last entry because it's the user message we just inserted
        // (history already includes it from the DB query in sendMessage)
        if (messages[messages.length - 1]?.role === 'user') {
          messages.pop();
        }
        messages.push({ role: 'user', content: userMessage });

        const completion = await ai.client.chat.completions.create({
          model: ai.model,
          messages,
          max_tokens: 800,
          temperature: 0.5
        });

        const content = completion.choices[0]?.message?.content ?? 'I was unable to generate a response. Please try again.';
        const tokens = completion.usage?.total_tokens ?? Math.ceil(content.length / 4);

        return { content, confidence: 90, sources: [ai.provider, 'Veterinary Knowledge Base'], tokens };
      } catch (err: any) {
        if (err?.status === 429) {
          logger.error('AI quota exceeded (429). Add billing on OpenAI or switch to Groq (free).', { provider: ai.provider });
          return {
            content: `⚠️ The AI provider (${ai.provider}) returned a quota/billing error (429).

To fix this:
- **OpenAI users**: Add billing at https://platform.openai.com/settings/billing
- **Free alternative**: Get a free Groq key at https://console.groq.com, set GROQ_API_KEY in your backend .env, and restart the backend.

In the meantime, please use the Symptom Analysis or Drug Interactions tabs.`,
            confidence: 0, sources: ['System'], tokens: 50
          };
        }
        logger.error('AI API error, falling back to local KB', { error: err?.message });
      }
    }

    // ── Local fallback knowledge base ──
    const lc = userMessage.toLowerCase();

    for (const [key, knowledge] of Object.entries(VET_KNOWLEDGE)) {
      if (lc.includes(key)) {
        return { content: knowledge.response, confidence: knowledge.confidence, sources: knowledge.sources, tokens: Math.ceil(knowledge.response.length / 4) };
      }
    }

    if (lc.includes('interaction') || lc.includes('drug') || lc.includes('medication')) {
      return {
        content: 'I can help check drug interactions. Please provide the specific medications you\'d like me to analyze. Use the Drug Interaction Checker tab for a detailed compatibility report.',
        confidence: 75, sources: ['Veterinary Pharmacology Database'], tokens: 45
      };
    }

    if (lc.includes('emergency') || lc.includes('bleeding') || lc.includes('not breathing') || lc.includes('seizure') || lc.includes('poison')) {
      return {
        content: '🚨 EMERGENCY: If your animal is in immediate danger, contact your nearest emergency veterinary clinic immediately. Keep the animal calm, do not give medication without guidance, and note when symptoms started.',
        confidence: 95, sources: ['Emergency Veterinary Protocol'], tokens: 60
      };
    }

    return {
      content: `⚠️ AI Copilot offline — no AI provider configured.\n\nSet one of these in your backend .env and restart:\n- **Free**: GROQ_API_KEY=<key from https://console.groq.com>\n- **Paid**: OPENAI_API_KEY=<key from https://platform.openai.com>`,
      confidence: 40, sources: ['Local Knowledge Base'], tokens: 55
    };
  }
}

export default new AiCopilotService();

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

    // Generate AI response (real GPT or fallback)
    const aiResponse = await this.generateAiResponse(content, history.rows);

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
    history: { role: string; content: string }[] = []
  ): Promise<{ content: string; confidence: number; sources: string[]; tokens: number }> {

    // ── AI path ──
    const ai = getAI();
    if (ai) {
      try {
        // Build message list: system + history + new user message
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: SYSTEM_PROMPT },
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

/**
 * AI Veterinary Copilot Service
 * Conversational AI assistant with symptom analysis, drug interaction checks,
 * treatment suggestions, and contextual animal health intelligence.
 */
import pool from '../utils/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

  // ── Sessions ──
  async listSessions(userId: string, filters: any = {}) {
    const { limit = 50, offset = 0, status } = filters;
    let query = `SELECT s.*, a.name as animal_name, a.species, e.name as enterprise_name
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
    const result = await pool.query('SELECT * FROM ai_chat_sessions WHERE id = $1', [id]);
    return result.rows[0];
  }

  async getSession(sessionId: string) {
    const result = await pool.query(
      `SELECT s.*, a.name as animal_name, a.species, a.breed, e.name as enterprise_name
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
      `SELECT * FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]
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

    // Generate AI response
    const aiResponse = this.generateAiResponse(content);

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
      userMessage: { id: userMsgId, role: 'user', content, created_at: new Date().toISOString() },
      aiMessage: { id: aiMsgId, role: 'assistant', content: aiResponse.content, confidence: aiResponse.confidence, sources: aiResponse.sources, created_at: new Date().toISOString() }
    };
  }

  // ── Drug Interaction Check ──
  async checkDrugInteractions(drugs: string[]) {
    const interactions: any[] = [];
    const normalized = drugs.map(d => d.toLowerCase().trim());

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
    return { drugs: normalized, interactions, hasInteractions: interactions.length > 0 };
  }

  // ── Symptom Analysis ──
  async analyzeSymptoms(symptoms: string[], species?: string) {
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
      disclaimer: 'This is AI-assisted analysis. Always consult a licensed veterinarian for diagnosis and treatment.'
    };
  }

  // ── Private: AI response generation ──
  private generateAiResponse(userMessage: string): { content: string; confidence: number; sources: string[]; tokens: number } {
    const lc = userMessage.toLowerCase();

    // Check knowledge base
    for (const [key, knowledge] of Object.entries(VET_KNOWLEDGE)) {
      if (lc.includes(key)) {
        return { content: knowledge.response, confidence: knowledge.confidence, sources: knowledge.sources, tokens: Math.ceil(knowledge.response.length / 4) };
      }
    }

    // Drug interaction query
    if (lc.includes('interaction') || lc.includes('drug') || lc.includes('medication')) {
      return {
        content: 'I can help check drug interactions. Please provide the specific medications you\'d like me to analyze. Common veterinary drug categories include NSAIDs, antibiotics, antiparasitics, and corticosteroids. Use the Drug Interaction Checker for a detailed compatibility report.',
        confidence: 75, sources: ['Veterinary Pharmacology Database'], tokens: 45
      };
    }

    // Emergency detection
    if (lc.includes('emergency') || lc.includes('bleeding') || lc.includes('not breathing') || lc.includes('seizure') || lc.includes('poison')) {
      return {
        content: '🚨 EMERGENCY: If your animal is in immediate danger, contact your nearest emergency veterinary clinic immediately. While waiting: 1) Keep the animal calm and still. 2) Do not attempt to give medication without vet guidance. 3) Note the time symptoms started. 4) If poisoning is suspected, bring the substance container to the vet.',
        confidence: 95, sources: ['Emergency Veterinary Protocol'], tokens: 60
      };
    }

    // General response
    return {
      content: `Thank you for your question about "${userMessage.substring(0, 50)}...". Based on veterinary best practices, I'd recommend: 1) Observing the animal closely for 24-48 hours. 2) Documenting any changes in behavior, appetite, or activity. 3) Scheduling a check-up if symptoms persist. Would you like me to help with symptom analysis, drug interaction checks, or treatment protocol suggestions?`,
      confidence: 60, sources: ['General Veterinary Practice'], tokens: 55
    };
  }
}

export default new AiCopilotService();

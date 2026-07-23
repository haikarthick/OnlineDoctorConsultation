import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import apiService from '../services/api'
import './ModulePage.css'
import { AIChatSession, AIChatMessage } from '../types'
import { useTranslation } from 'react-i18next'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

// Render AI markdown responses nicely
const AIMessage: React.FC<{ content: string; confidence?: number; sources?: string[] }> = ({ content, confidence, sources }) => (
  <div className="si-369fec94">
    <div className="si-e2f1257e">
      <div className="ai-markdown">
        <ReactMarkdown
          components={{
            h1: ({children}) => <h3 className="si-329e8220">{children}</h3>,
            h2: ({children}) => <h4 className="si-d14e8fe4">{children}</h4>,
            h3: ({children}) => <h4 className="si-62111cf1">{children}</h4>,
            p: ({children}) => <p className="si-1141db05">{children}</p>,
            ul: ({children}) => <ul className="si-7bc306de">{children}</ul>,
            ol: ({children}) => <ol className="si-7bc306de">{children}</ol>,
            li: ({children}) => <li className="si-e57614ee">{children}</li>,
            strong: ({children}) => <strong className="si-6fe4f96c">{children}</strong>,
            code: ({children}) => <code className="si-374f06e8">{children}</code>,
            blockquote: ({children}) => <blockquote className="si-e3440d78">{children}</blockquote>,
          }}
        >{content}</ReactMarkdown>
      </div>
      {(confidence !== undefined || (sources && sources.length > 0)) && (
        <div className="si-5beacd67">
          {confidence !== undefined && (
            <span className="si-a820b7cc">
              <span style={{ width: 6, height: 6, borderRadius: '50%',
                background: confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#f59e0b' : '#ef4444', display: 'inline-block' }} />
              Confidence: {confidence}%
            </span>
          )}
          {sources && sources.length > 0 && (
            <span className="si-dd67611c">📚 {sources.join(' · ')}</span>
          )}
        </div>
      )}
    </div>
  </div>
)

const AICopilot: React.FC = () => {
  const { t } = useTranslation()

  const [sessions, setSessions] = useState<AIChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<AIChatSession | null>(null)
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'chat' | 'drugs' | 'symptoms' | 'scan'>('chat')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Drug interaction state
  const [drugInput, setDrugInput] = useState('')
  const [drugResults, setDrugResults] = useState<any>(null)

  // Symptom analysis state
  const [symptomInput, setSymptomInput] = useState('')
  const [speciesInput, setSpeciesInput] = useState('')
  const [symptomResults, setSymptomResults] = useState<any>(null)

  // Scan analysis state
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPreview, setScanPreview] = useState<string>('')
  const [scanSpecies, setScanSpecies] = useState('')
  const [scanType, setScanType] = useState('')
  const [scanBodyPart, setScanBodyPart] = useState('')
  const [scanNotes, setScanNotes] = useState('')
  const [scanResults, setScanResults] = useState<any>(null)
  const [scanAnalyzing, setScanAnalyzing] = useState(false)
  const scanFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchSessions() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchSessions = async () => {
    try {
      const res = await apiService.listChatSessions()
      setSessions(res.data?.items || [])
    } catch (err: any) { console.error('Failed to load sessions:', err?.message); setSessions([]) }
  }
  useAutoRefresh('ai-copilot', fetchSessions)

  const selectSession = async (session: AIChatSession) => {
    setSelectedSession(session)
    setLoading(true)
    try {
      const res = await apiService.listChatMessages(session.id)
      setMessages(res.data || [])
    } catch (err: any) { console.error('Failed to load messages:', err?.message); setMessages([]) }
    setLoading(false)
  }

  const createSession = async (contextType: string = 'general') => {
    try {
      const res = await apiService.createChatSession({ title: `Chat ${new Date().toLocaleDateString()}`, contextType })
      const newSession = res.data
      setSessions(prev => [newSession, ...prev])
      selectSession(newSession)
    } catch (e: any) { setError(e.message) }
  }

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedSession || sending) return
    const content = messageInput.trim()
    setMessageInput('')
    setSending(true)

    // Optimistic user message
    const tempMsg: AIChatMessage = { id: 'temp', sessionId: selectedSession.id, role: 'user', content, createdAt: new Date().toISOString() }
    setMessages(prev => [...prev, tempMsg])

    try {
      const res = await apiService.sendChatMessage(selectedSession.id, content)
      const { userMessage, aiMessage } = res.data
      setMessages(prev => [...prev.filter(m => m.id !== 'temp'), userMessage, aiMessage])
    } catch (e: any) {
      setError(t('aiCopilot.errors.sendFailed'))
      setMessages(prev => prev.filter(m => m.id !== 'temp'))
    }
    setSending(false)
  }

  const checkDrugs = async () => {
    if (!drugInput.trim()) return
    setLoading(true)
    try {
      const drugs = drugInput.split(',').map(d => d.trim()).filter(Boolean)
      const res = await apiService.checkDrugInteractions(drugs)
      setDrugResults(res.data)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const analyzeSymptoms = async () => {
    if (!symptomInput.trim()) return
    setLoading(true)
    try {
      const symptoms = symptomInput.split(',').map(s => s.trim()).filter(Boolean)
      const res = await apiService.analyzeSymptoms(symptoms, speciesInput || undefined)
      setSymptomResults(res.data)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const handleScanFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setScanFile(file)
      setScanResults(null)
      const reader = new FileReader()
      reader.onload = () => setScanPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const analyzeScan = async () => {
    if (!scanFile) return
    setScanAnalyzing(true)
    setError('')
    setScanResults(null)
    try {
      const res = await apiService.analyzeScan(scanFile, {
        species: scanSpecies || undefined,
        scanType: scanType || undefined,
        bodyPart: scanBodyPart || undefined,
        notes: scanNotes || undefined,
      })
      setScanResults(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e.message || 'Scan analysis failed')
    }
    setScanAnalyzing(false)
  }

  const deleteSession = async (id: string) => {
    try {
      await apiService.deleteChatSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (selectedSession?.id === id) { setSelectedSession(null); setMessages([]) }
      setSuccessMsg(t('aiCopilot.errors.deleted'))
    } catch { setError(t('aiCopilot.errors.deleteFailed')) }
  }

  const SUGGESTED_PROMPTS = [
    'My dog has been vomiting for 2 days',
    'What vaccines does a puppy need?',
    'Cattle showing signs of lameness',
    'Best nutrition plan for senior cats',
    'Emergency: animal not breathing',
    'Common skin conditions in horses',
  ]

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>{t('aiCopilot.pageTitle')}</h1>
          <p className="si-f80b783e">{t('aiCopilot.subtitle')}</p>
        </div>
      </div>

      {error && <div className="module-alert error si-7e63ec4f">{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success si-7e63ec4f">{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['chat', 'drugs', 'symptoms', 'scan'] as const).map(t => (
          <button key={t} className={`module-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'chat' ? '💬 Chat Assistant' : t === 'drugs' ? '💊 Drug Interactions' : t === 'symptoms' ? '🔬 Symptom Analysis' : '🩻 Scan Analysis'}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="si-feb53fea">
          {/* Session sidebar */}
          <div className="si-7dd051b0">
            <button className="module-btn primary si-075e78b2" onClick={() => createSession()}>+ New Chat</button>
            {sessions.map(s => (
              <div key={s.id} onClick={() => selectSession(s)}
                style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 8, cursor: 'pointer',
                  background: selectedSession?.id === s.id ? 'linear-gradient(135deg, #667eea20, #764ba220)' : '#f8f9fa',
                  border: selectedSession?.id === s.id ? '1px solid #667eea40' : '1px solid transparent' }}>
                <div className="si-660018c2">{s.title}</div>
                <div className="si-a3f3564c">{s.messageCount || 0} messages · {s.contextType}</div>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                  className="si-4a100ba9">{t('common.delete')}</button>
              </div>
            ))}
            {sessions.length === 0 && <p className="si-5d9e9bea">{t('aiCopilot.chat.emptySessions')}</p>}
          </div>

          {/* Chat area */}
          <div className="si-861b23e3">
            {selectedSession ? (
              <>
                <div className="si-5b00ce26">
                  {selectedSession.title}
                  {selectedSession.animalName && <span className="si-1a7093be">· {selectedSession.animalName}</span>}
                </div>
                <div className="si-63f5b6f7">
                  {messages.map((msg, i) => (
                    <div key={msg.id || i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 20, gap: 10, alignItems: 'flex-end' }}>
                      {msg.role === 'assistant' && (
                        <div className="si-804c4002">🤖</div>
                      )}
                      {msg.role === 'user' ? (
                        <div className="si-a386258c">
                          {msg.content}
                        </div>
                      ) : (
                        <AIMessage content={msg.content} confidence={msg.confidence} sources={msg.sources} />
                      )}
                    </div>
                  ))}
                  {sending && (
                    <div className="si-3c8bc4bc">
                      <div className="si-868cfc63">🤖</div>
                      <div className="si-eced51bd">
                        <div className="si-d0f954ea">
                          {[0,1,2].map(d => (
                            <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea',
                              animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${d * 0.2}s`, opacity: 0.7 }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {messages.length === 0 && (
                    <div className="si-86638a30">
                      <div className="si-aea35a6f">🐾</div>
                      <h3 className="si-5f7c0d93">{t('aiCopilot.chat.greeting')}</h3>
                      <p className="si-257b9adb">{t('aiCopilot.chat.placeholder')}</p>
                      <div className="si-27a43432">
                        {SUGGESTED_PROMPTS.map(p => (
                          <button key={p} onClick={() => { setMessageInput(p) }}
                            className="si-ab519a6b">
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="si-136c7bca">
                  <input value={messageInput} onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={t('aiCopilot.chat.inputPlaceholder')} disabled={sending}
                    style={{ flex: 1, padding: '12px 18px', borderRadius: 24, border: '1px solid #ddd', fontSize: 14, outline: 'none',
                      background: sending ? '#f9f9f9' : 'white' }} />
                  <button className="module-btn primary" onClick={sendMessage} disabled={sending || !messageInput.trim()}
                    style={{ borderRadius: 24, padding: '12px 24px', opacity: (sending || !messageInput.trim()) ? 0.6 : 1 }}>
                    {sending ? t('common.loading') : t('aiCopilot.chat.send')}
                  </button>
                </div>
              </>
            ) : (
              <div className="si-cd9c3d15">
                <div className="si-4b6b7fbc">
                  <div className="si-86e06f73">🤖</div>
                  <h2 className="si-5f7c0d93">{t('aiCopilot.chat.emptyTitle')}</h2>
                  <p>{t('aiCopilot.chat.emptySubtitle')}</p>
                  <button className="module-btn primary si-b0aee75b" onClick={() => createSession()}>{t('aiCopilot.chat.startNew')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'drugs' && (
        <div className="module-card si-b4c2d096">
          <h3>💊 Drug Interaction Checker</h3>
          <p className="si-63eaea98">Enter medication names separated by commas to check for interactions</p>
          <div className="si-ec031879">
            <input value={drugInput} onChange={e => setDrugInput(e.target.value)} placeholder="e.g. nsaids, corticosteroids, metronidazole"
              className="si-8edee620" />
            <button className="module-btn primary" onClick={checkDrugs} disabled={loading}>Check Interactions</button>
          </div>
          {drugResults && (
            <div>
              <div style={{ padding: 16, borderRadius: 8, background: drugResults.hasInteractions ? '#fef2f2' : '#f0fdf4', marginBottom: 16, border: `1px solid ${drugResults.hasInteractions ? '#fecaca' : '#bbf7d0'}` }}>
                <strong>{drugResults.hasInteractions ? '⚠️ Interactions Found' : '✅ No Interactions Detected'}</strong>
                <p className="si-f80b783e">Checked: {drugResults.drugs?.join(', ')}</p>
                {drugResults.provider && <p className="si-fcdf5498">Powered by: {drugResults.provider}</p>}
              </div>
              {/* AI full analysis (Groq/GPT response) */}
              {drugResults.aiAnalysis && (
                <div className="si-75f342dc">
                  <div className="ai-markdown si-585a6eec">
                    <ReactMarkdown
                      components={{
                        h3: ({children}) => <h4 className="si-a831306b">{children}</h4>,
                        p: ({children}) => <p className="si-24d15068">{children}</p>,
                        ul: ({children}) => <ul className="si-aaa14e67">{children}</ul>,
                        li: ({children}) => <li className="si-423b515a">{children}</li>,
                        strong: ({children}) => <strong className="si-f3347717">{children}</strong>,
                      }}
                    >{drugResults.aiAnalysis}</ReactMarkdown>
                  </div>
                </div>
              )}
              {/* Local fallback interaction cards */}
              {drugResults.interactions?.map((interaction: any, i: number) => (
                <div key={i} className="si-2b863e5d">
                  <div className="si-b01feffa">
                    <strong>{interaction.drug1}</strong><span>↔</span><strong>{interaction.drug2}</strong>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: interaction.severity === 'high' ? '#fecaca' : '#fef08a',
                      color: interaction.severity === 'high' ? '#dc2626' : '#ca8a04' }}>{interaction.severity}</span>
                  </div>
                  <p className="si-cba7cf8e">{interaction.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'symptoms' && (
        <div className="module-card si-b4c2d096">
          <h3>🔬 Symptom Analysis</h3>
          <p className="si-63eaea98">Describe symptoms to receive AI-assisted preliminary analysis</p>
          <div className="si-3631aec4">
            <input value={symptomInput} onChange={e => setSymptomInput(e.target.value)} placeholder="e.g. fever, vomiting, lameness"
              className="si-8edee620" />
            <input value={speciesInput} onChange={e => setSpeciesInput(e.target.value)} placeholder="Species (optional)"
              className="si-c098521a" />
            <button className="module-btn primary" onClick={analyzeSymptoms} disabled={loading}>Analyze</button>
          </div>
          {symptomResults && (
            <div>
              <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 16, border: '1px solid #e2e8f0',
                background: symptomResults.overallUrgency === 'high' || symptomResults.overallUrgency === 'emergency'
                  ? '#fef2f2' : symptomResults.overallUrgency === 'moderate' ? '#fffbeb' : '#f0fdf4',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span className="si-3ac604f5">Urgency</span>
                  <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2,
                    color: symptomResults.overallUrgency === 'high' || symptomResults.overallUrgency === 'emergency' ? '#dc2626'
                      : symptomResults.overallUrgency === 'moderate' ? '#d97706' : '#16a34a' }}>
                    {symptomResults.overallUrgency?.toUpperCase()}
                  </div>
                </div>
                <div className="si-486971fb" />
                <div>
                  <span className="si-3ac604f5">Species</span>
                  <div className="si-6061c14d">{symptomResults.species}</div>
                </div>
                {symptomResults.provider && (
                  <div className="si-764828b3">Powered by: {symptomResults.provider}</div>
                )}
              </div>

              {/* AI full analysis */}
              {symptomResults.aiAnalysis && (
                <div className="si-75f342dc">
                  <div className="ai-markdown si-585a6eec">
                    <ReactMarkdown
                      components={{
                        h3: ({children}) => <h4 className="si-a831306b">{children}</h4>,
                        p: ({children}) => <p className="si-24d15068">{children}</p>,
                        ul: ({children}) => <ul className="si-aaa14e67">{children}</ul>,
                        ol: ({children}) => <ol className="si-aaa14e67">{children}</ol>,
                        li: ({children}) => <li className="si-423b515a">{children}</li>,
                        strong: ({children}) => <strong className="si-f3347717">{children}</strong>,
                      }}
                    >{symptomResults.aiAnalysis}</ReactMarkdown>
                  </div>
                </div>
              )}
              {/* Local fallback finding cards */}
              {symptomResults.findings?.map((finding: any, i: number) => (
                <div key={i} className="si-96de6f15">
                  <div className="si-6c37c242">{finding.symptom}</div>
                  <p className="si-ed231772">{finding.response}</p>
                  <div className="si-a3f3564c">Confidence: {finding.confidence}% · Sources: {finding.sources?.join(', ')}</div>
                </div>
              ))}
              <div className="si-deb696b4">
                ⚠️ {symptomResults.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SCAN ANALYSIS TAB ═══════════════════════════════ */}
      {tab === 'scan' && (
        <div className="module-card si-b4c2d096">
          <h3>🩻 AI Scan & Image Analysis</h3>
          <p className="si-63eaea98">Upload a veterinary scan (X-ray, MRI, ultrasound, CT, or clinical photo) for AI-powered triage analysis</p>

          {/* Upload area */}
          <div className="si-33938b8e">
            <div className="si-eea342ba">
              <input ref={scanFileRef} type="file" accept="image/*" onChange={handleScanFileChange} className="si-d6a2f871" />
              <div onClick={() => scanFileRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e1', borderRadius: 12, padding: scanPreview ? 0 : '40px 20px',
                  textAlign: 'center', cursor: 'pointer', background: '#fafbfc', minHeight: 200,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#667eea')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
              >
                {scanPreview ? (
                  <img src={scanPreview} alt="Scan preview" className="si-f62c643d" />
                ) : (
                  <div>
                    <div className="si-fc4388e2">🩻</div>
                    <div className="si-a71f4610">Click to upload scan image</div>
                    <div className="si-b95e40ca">X-ray, MRI, Ultrasound, CT, or clinical photo</div>
                    <div className="si-3277a787">JPEG, PNG, WebP — Max 10MB</div>
                  </div>
                )}
              </div>
              {scanFile && (
                <div className="si-83190d3b">
                  <span>📎 {scanFile.name} ({(scanFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <button className="si-25a60d6b"
                    onClick={() => { setScanFile(null); setScanPreview(''); setScanResults(null) }}>Remove</button>
                </div>
              )}
            </div>

            {/* Context inputs */}
            <div className="si-f989dc4f">
              <div>
                <label className="si-2561596d">Species</label>
                <select value={scanSpecies} onChange={e => setScanSpecies(e.target.value)}
                  className="si-4bf99b94">
                  <option value="">Select species...</option>
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="horse">Horse</option>
                  <option value="cattle">Cattle</option>
                  <option value="sheep">Sheep</option>
                  <option value="goat">Goat</option>
                  <option value="pig">Pig</option>
                  <option value="poultry">Poultry</option>
                  <option value="rabbit">Rabbit</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="si-2561596d">Scan Type</label>
                <select value={scanType} onChange={e => setScanType(e.target.value)}
                  className="si-4bf99b94">
                  <option value="">Select type...</option>
                  <option value="x-ray">X-Ray</option>
                  <option value="mri">MRI</option>
                  <option value="ct-scan">CT Scan</option>
                  <option value="ultrasound">Ultrasound</option>
                  <option value="clinical-photo">Clinical Photo</option>
                  <option value="dermoscopy">Dermoscopy</option>
                  <option value="endoscopy">Endoscopy</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="si-2561596d">Body Part / Region</label>
                <input value={scanBodyPart} onChange={e => setScanBodyPart(e.target.value)} placeholder="e.g. left foreleg, thorax, abdomen"
                  className="si-4bf99b94" />
              </div>
              <div>
                <label className="si-2561596d">Clinical Notes (optional)</label>
                <textarea value={scanNotes} onChange={e => setScanNotes(e.target.value)} placeholder="Any relevant history or symptoms..."
                  rows={3} className="si-06c176a5" />
              </div>
              <button className="module-btn primary si-0a4ef46c" onClick={analyzeScan} disabled={!scanFile || scanAnalyzing}
               >
                {scanAnalyzing ? '🔄 Analyzing...' : '🩻 Analyze Scan'}
              </button>
            </div>
          </div>

          {/* Results */}
          {scanResults && (
            <div className="si-b4c2d096">
              {scanResults.success ? (
                <>
                  {/* Triage banner */}
                  <div style={{
                    padding: '16px 20px', borderRadius: 12, marginBottom: 16,
                    border: '1px solid',
                    ...(scanResults.triageLevel === 'critical' ? { background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }
                      : scanResults.triageLevel === 'urgent' ? { background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }
                      : scanResults.triageLevel === 'moderate' ? { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }
                      : { background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }),
                    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
                  }}>
                    <div className="si-42fc55d5">
                      {scanResults.triageLevel === 'critical' ? '🚨' : scanResults.triageLevel === 'urgent' ? '⚠️' : scanResults.triageLevel === 'moderate' ? '📋' : '✅'}
                    </div>
                    <div>
                      <div className="si-cbda629b">Triage Level</div>
                      <div className="si-1ce6f017">{scanResults.triageLevel}</div>
                    </div>
                    {scanResults.provider && (
                      <div className="si-b660b53b">Powered by: {scanResults.provider}</div>
                    )}
                  </div>

                  {/* Full AI analysis */}
                  <div className="si-534f6c73">
                    <div className="ai-markdown si-4bcdb937">
                      <ReactMarkdown
                        components={{
                          h2: ({children}) => <h3 className="si-0abf51ad">{children}</h3>,
                          h3: ({children}) => <h4 className="si-f3cf4650">{children}</h4>,
                          p: ({children}) => <p className="si-1141db05">{children}</p>,
                          ul: ({children}) => <ul className="si-7bc306de">{children}</ul>,
                          ol: ({children}) => <ol className="si-7bc306de">{children}</ol>,
                          li: ({children}) => <li className="si-e57614ee">{children}</li>,
                          strong: ({children}) => <strong className="si-319fe0be">{children}</strong>,
                        }}
                      >{scanResults.analysis}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="si-0c9eaa3b">
                    ⚠️ {scanResults.disclaimer}
                  </div>
                </>
              ) : (
                <div className="si-2800aa40">
                  ❌ {scanResults.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AICopilot

import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import apiService from '../services/api'
import './ModulePage.css'
import { AIChatSession, AIChatMessage } from '../types'

// Render AI markdown responses nicely
const AIMessage: React.FC<{ content: string; confidence?: number; sources?: string[] }> = ({ content, confidence, sources }) => (
  <div style={{ maxWidth: '78%' }}>
    <div style={{
      padding: '14px 18px', borderRadius: '18px 18px 18px 4px',
      background: 'white', border: '1px solid #e8ecf0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', fontSize: 14, lineHeight: 1.7, color: '#2d3748'
    }}>
      <div className="ai-markdown">
        <ReactMarkdown
          components={{
            h1: ({children}) => <h3 style={{margin:'0 0 8px',fontSize:16,color:'#1a202c'}}>{children}</h3>,
            h2: ({children}) => <h4 style={{margin:'12px 0 6px',fontSize:15,color:'#2d3748'}}>{children}</h4>,
            h3: ({children}) => <h4 style={{margin:'12px 0 6px',fontSize:14,fontWeight:700,color:'#4a5568'}}>{children}</h4>,
            p: ({children}) => <p style={{margin:'0 0 10px'}}>{children}</p>,
            ul: ({children}) => <ul style={{margin:'0 0 10px',paddingLeft:20}}>{children}</ul>,
            ol: ({children}) => <ol style={{margin:'0 0 10px',paddingLeft:20}}>{children}</ol>,
            li: ({children}) => <li style={{marginBottom:4}}>{children}</li>,
            strong: ({children}) => <strong style={{color:'#2d3748',fontWeight:700}}>{children}</strong>,
            code: ({children}) => <code style={{background:'#edf2f7',padding:'2px 6px',borderRadius:4,fontSize:13}}>{children}</code>,
            blockquote: ({children}) => <blockquote style={{borderLeft:'3px solid #667eea',paddingLeft:12,margin:'8px 0',color:'#555'}}>{children}</blockquote>,
          }}
        >{content}</ReactMarkdown>
      </div>
      {(confidence !== undefined || (sources && sources.length > 0)) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eef0f3', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {confidence !== undefined && (
            <span style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%',
                background: confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#f59e0b' : '#ef4444', display: 'inline-block' }} />
              Confidence: {confidence}%
            </span>
          )}
          {sources && sources.length > 0 && (
            <span style={{ fontSize: 11, color: '#888' }}>📚 {sources.join(' · ')}</span>
          )}
        </div>
      )}
    </div>
  </div>
)

const AICopilot: React.FC = () => {
  const [sessions, setSessions] = useState<AIChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<AIChatSession | null>(null)
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'chat' | 'drugs' | 'symptoms'>('chat')
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

  useEffect(() => { fetchSessions() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchSessions = async () => {
    try {
      const res = await apiService.listChatSessions()
      setSessions(res.data?.items || [])
    } catch { setSessions([]) }
  }

  const selectSession = async (session: AIChatSession) => {
    setSelectedSession(session)
    setLoading(true)
    try {
      const res = await apiService.listChatMessages(session.id)
      setMessages(res.data || [])
    } catch { setMessages([]) }
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
      setError('Failed to send message')
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

  const deleteSession = async (id: string) => {
    try {
      await apiService.deleteChatSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (selectedSession?.id === id) { setSelectedSession(null); setMessages([]) }
      setSuccessMsg('Session deleted')
    } catch { setError('Failed to delete') }
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
          <h1>🤖 AI Veterinary Copilot</h1>
          <p style={{ color: '#666', margin: '8px 0 0' }}>Intelligent assistant for symptom analysis, drug checks & treatment guidance</p>
        </div>
      </div>

      {error && <div className="module-alert error" style={{ marginBottom: 16 }}>{error} <button onClick={() => setError('')}>✕</button></div>}
      {successMsg && <div className="module-alert success" style={{ marginBottom: 16 }}>{successMsg} <button onClick={() => setSuccessMsg('')}>✕</button></div>}

      <div className="module-tabs">
        {(['chat', 'drugs', 'symptoms'] as const).map(t => (
          <button key={t} className={`module-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'chat' ? '💬 Chat Assistant' : t === 'drugs' ? '💊 Drug Interactions' : '🔬 Symptom Analysis'}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 280px)', minHeight: 500 }}>
          {/* Session sidebar */}
          <div style={{ width: 280, background: 'white', borderRadius: 12, padding: 16, overflow: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <button className="module-btn primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => createSession()}>+ New Chat</button>
            {sessions.map(s => (
              <div key={s.id} onClick={() => selectSession(s)}
                style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 8, cursor: 'pointer',
                  background: selectedSession?.id === s.id ? 'linear-gradient(135deg, #667eea20, #764ba220)' : '#f8f9fa',
                  border: selectedSession?.id === s.id ? '1px solid #667eea40' : '1px solid transparent' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{s.messageCount || 0} messages · {s.contextType}</div>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                  style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>Delete</button>
              </div>
            ))}
            {sessions.length === 0 && <p style={{ color: '#999', textAlign: 'center', fontSize: 14 }}>No sessions yet. Start a new chat!</p>}
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {selectedSession ? (
              <>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', fontWeight: 600 }}>
                  {selectedSession.title}
                  {selectedSession.animalName && <span style={{ color: '#667eea', marginLeft: 8 }}>· {selectedSession.animalName}</span>}
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                  {messages.map((msg, i) => (
                    <div key={msg.id || i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 20, gap: 10, alignItems: 'flex-end' }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🤖</div>
                      )}
                      {msg.role === 'user' ? (
                        <div style={{ maxWidth: '72%', padding: '12px 18px', borderRadius: '18px 18px 4px 18px',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', fontSize: 14, lineHeight: 1.6 }}>
                          {msg.content}
                        </div>
                      ) : (
                        <AIMessage content={msg.content} confidence={msg.confidence} sources={msg.sources} />
                      )}
                    </div>
                  ))}
                  {sending && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                      <div style={{ padding: '14px 20px', borderRadius: '18px 18px 18px 4px', background: 'white',
                        border: '1px solid #e8ecf0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {[0,1,2].map(d => (
                            <div key={d} style={{ width: 8, height: 8, borderRadius: '50%', background: '#667eea',
                              animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${d * 0.2}s`, opacity: 0.7 }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>🐾</div>
                      <h3 style={{ color: '#333' }}>How can I help today?</h3>
                      <p style={{ color: '#888', marginBottom: 20 }}>Ask about symptoms, treatments, nutrition, or any veterinary topic</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                        {SUGGESTED_PROMPTS.map(p => (
                          <button key={p} onClick={() => { setMessageInput(p) }}
                            style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid #ddd', background: '#fafafa', cursor: 'pointer', fontSize: 13 }}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input value={messageInput} onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type your question..." disabled={sending}
                    style={{ flex: 1, padding: '12px 18px', borderRadius: 24, border: '1px solid #ddd', fontSize: 14, outline: 'none',
                      background: sending ? '#f9f9f9' : 'white' }} />
                  <button className="module-btn primary" onClick={sendMessage} disabled={sending || !messageInput.trim()}
                    style={{ borderRadius: 24, padding: '12px 24px', opacity: (sending || !messageInput.trim()) ? 0.6 : 1 }}>
                    {sending ? 'Sending…' : '▹ Send'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🤖</div>
                  <h2 style={{ color: '#333' }}>AI Veterinary Copilot</h2>
                  <p>Select a session or start a new chat</p>
                  <button className="module-btn primary" style={{ marginTop: 16 }} onClick={() => createSession()}>Start New Chat</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'drugs' && (
        <div className="module-card" style={{ marginTop: 24 }}>
          <h3>💊 Drug Interaction Checker</h3>
          <p style={{ color: '#666', marginBottom: 16 }}>Enter medication names separated by commas to check for interactions</p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <input value={drugInput} onChange={e => setDrugInput(e.target.value)} placeholder="e.g. nsaids, corticosteroids, metronidazole"
              style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
            <button className="module-btn primary" onClick={checkDrugs} disabled={loading}>Check Interactions</button>
          </div>
          {drugResults && (
            <div>
              <div style={{ padding: 16, borderRadius: 8, background: drugResults.hasInteractions ? '#fef2f2' : '#f0fdf4', marginBottom: 16, border: `1px solid ${drugResults.hasInteractions ? '#fecaca' : '#bbf7d0'}` }}>
                <strong>{drugResults.hasInteractions ? '⚠️ Interactions Found' : '✅ No Interactions Detected'}</strong>
                <p style={{ margin: '8px 0 0', color: '#666' }}>Checked: {drugResults.drugs?.join(', ')}</p>
                {drugResults.provider && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Powered by: {drugResults.provider}</p>}
              </div>
              {/* AI full analysis (Groq/GPT response) */}
              {drugResults.aiAnalysis && (
                <div style={{ padding: '16px 20px', borderRadius: 10, background: 'white', border: '1px solid #e8ecf0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
                  <div className="ai-markdown" style={{ fontSize: 14, lineHeight: 1.7, color: '#2d3748' }}>
                    <ReactMarkdown
                      components={{
                        h3: ({children}) => <h4 style={{margin:'10px 0 4px',fontSize:14,color:'#4a5568'}}>{children}</h4>,
                        p: ({children}) => <p style={{margin:'0 0 8px'}}>{children}</p>,
                        ul: ({children}) => <ul style={{margin:'0 0 8px',paddingLeft:18}}>{children}</ul>,
                        li: ({children}) => <li style={{marginBottom:3}}>{children}</li>,
                        strong: ({children}) => <strong style={{fontWeight:700}}>{children}</strong>,
                      }}
                    >{drugResults.aiAnalysis}</ReactMarkdown>
                  </div>
                </div>
              )}
              {/* Local fallback interaction cards */}
              {drugResults.interactions?.map((interaction: any, i: number) => (
                <div key={i} style={{ padding: 16, borderRadius: 8, background: '#fff', border: '1px solid #eee', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <strong>{interaction.drug1}</strong><span>↔</span><strong>{interaction.drug2}</strong>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                      background: interaction.severity === 'high' ? '#fecaca' : '#fef08a',
                      color: interaction.severity === 'high' ? '#dc2626' : '#ca8a04' }}>{interaction.severity}</span>
                  </div>
                  <p style={{ margin: 0, color: '#555', fontSize: 14 }}>{interaction.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'symptoms' && (
        <div className="module-card" style={{ marginTop: 24 }}>
          <h3>🔬 Symptom Analysis</h3>
          <p style={{ color: '#666', marginBottom: 16 }}>Describe symptoms to receive AI-assisted preliminary analysis</p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <input value={symptomInput} onChange={e => setSymptomInput(e.target.value)} placeholder="e.g. fever, vomiting, lameness"
              style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
            <input value={speciesInput} onChange={e => setSpeciesInput(e.target.value)} placeholder="Species (optional)"
              style={{ width: 200, padding: '12px 16px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }} />
            <button className="module-btn primary" onClick={analyzeSymptoms} disabled={loading}>Analyze</button>
          </div>
          {symptomResults && (
            <div>
              <div style={{ padding: '14px 18px', borderRadius: 10, marginBottom: 16, border: '1px solid #e2e8f0',
                background: symptomResults.overallUrgency === 'high' || symptomResults.overallUrgency === 'emergency'
                  ? '#fef2f2' : symptomResults.overallUrgency === 'moderate' ? '#fffbeb' : '#f0fdf4',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Urgency</span>
                  <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2,
                    color: symptomResults.overallUrgency === 'high' || symptomResults.overallUrgency === 'emergency' ? '#dc2626'
                      : symptomResults.overallUrgency === 'moderate' ? '#d97706' : '#16a34a' }}>
                    {symptomResults.overallUrgency?.toUpperCase()}
                  </div>
                </div>
                <div style={{ width: 1, height: 36, background: '#ddd' }} />
                <div>
                  <span style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>Species</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{symptomResults.species}</div>
                </div>
                {symptomResults.provider && (
                  <div style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>Powered by: {symptomResults.provider}</div>
                )}
              </div>

              {/* AI full analysis */}
              {symptomResults.aiAnalysis && (
                <div style={{ padding: '16px 20px', borderRadius: 10, background: 'white', border: '1px solid #e8ecf0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
                  <div className="ai-markdown" style={{ fontSize: 14, lineHeight: 1.7, color: '#2d3748' }}>
                    <ReactMarkdown
                      components={{
                        h3: ({children}) => <h4 style={{margin:'10px 0 4px',fontSize:14,color:'#4a5568'}}>{children}</h4>,
                        p: ({children}) => <p style={{margin:'0 0 8px'}}>{children}</p>,
                        ul: ({children}) => <ul style={{margin:'0 0 8px',paddingLeft:18}}>{children}</ul>,
                        ol: ({children}) => <ol style={{margin:'0 0 8px',paddingLeft:18}}>{children}</ol>,
                        li: ({children}) => <li style={{marginBottom:3}}>{children}</li>,
                        strong: ({children}) => <strong style={{fontWeight:700}}>{children}</strong>,
                      }}
                    >{symptomResults.aiAnalysis}</ReactMarkdown>
                  </div>
                </div>
              )}
              {/* Local fallback finding cards */}
              {symptomResults.findings?.map((finding: any, i: number) => (
                <div key={i} style={{ padding: 16, borderRadius: 8, background: '#fff', border: '1px solid #eee', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#333' }}>{finding.symptom}</div>
                  <p style={{ margin: '0 0 8px', color: '#555', fontSize: 14, lineHeight: 1.6 }}>{finding.response}</p>
                  <div style={{ fontSize: 12, color: '#888' }}>Confidence: {finding.confidence}% · Sources: {finding.sources?.join(', ')}</div>
                </div>
              ))}
              <div style={{ padding: 12, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', marginTop: 16, fontSize: 13, color: '#92400e' }}>
                ⚠️ {symptomResults.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AICopilot

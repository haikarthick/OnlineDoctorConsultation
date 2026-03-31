import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import { AIChatMessage } from '../types'
import './FloatingChatWidget.css'

interface PetSummary {
  id: string
  name: string
  species: string
}

const DEFAULT_PROMPTS = [
  'My pet is not eating 🍽️',
  'Vaccination schedule? 💉',
  'Emergency first aid 🚑',
  'Common skin issues 🐾',
]

const FloatingChatWidget: React.FC = () => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [initializing, setInitializing] = useState(false)
  const [pets, setPets] = useState<PetSummary[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const petsLoaded = useRef(false)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load user's pets once for personalized prompts
  useEffect(() => {
    if (!isAuthenticated || petsLoaded.current) return
    petsLoaded.current = true
    apiService.listAnimals({ limit: 10 }).then(res => {
      const items = res.data?.items || res.data || []
      setPets(items.map((a: any) => ({ id: a.id, name: a.name, species: a.species })))
    }).catch(() => { /* ignore */ })
  }, [isAuthenticated])

  // Build suggested prompts — personalized if pets exist
  const suggestedPrompts = pets.length > 0
    ? [
        `How is ${pets[0].name} doing based on recent records? 📋`,
        `Are ${pets[0].name}'s vaccinations up to date? 💉`,
        `Any medication reminders for my pets? 💊`,
        `What should I feed ${pets[0].name}? 🥢`,
      ]
    : DEFAULT_PROMPTS

  // Helper: extract readable error from API response
  const getApiError = (err: any): string => {
    const data = err?.response?.data
    return data?.error?.message || data?.message || err?.message || 'Unknown error'
  }

  // Create a brand-new session via the API
  const createNewSession = async (): Promise<string | null> => {
    const res = await apiService.createChatSession({
      title: `AI Buddy ${new Date().toLocaleDateString()}`,
      contextType: 'general',
    })
    const id = res.data?.id
    if (!id) throw new Error('Empty session response')
    setSessionId(id)
    return id
  }

  // Ensure a session exists when panel opens
  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId

    setInitializing(true)
    setError('')

    // Step 1: try to reuse an existing session
    try {
      const listRes = await apiService.listChatSessions()
      const sessions = listRes.data?.items || []
      if (sessions.length > 0) {
        const existing = sessions[0]
        setSessionId(existing.id)
        try {
          const msgRes = await apiService.listChatMessages(existing.id)
          setMessages(msgRes.data || [])
        } catch {
          // Could not load messages — still use the session
        }
        setInitializing(false)
        return existing.id
      }
    } catch (listErr) {
      // listSessions failed — fall through to create a new session
      console.warn('[AI Chat] listSessions failed, will create new session:', getApiError(listErr))
    }

    // Step 2: create a new session
    try {
      const id = await createNewSession()
      setInitializing(false)
      return id
    } catch (createErr) {
      console.error('[AI Chat] createSession failed:', getApiError(createErr))
      setError(t('chat.couldNotStartSession'))
      setInitializing(false)
      return null
    }
  }

  const handleOpen = async () => {
    setOpen(true)
    if (!sessionId) {
      await ensureSession()
    }
  }

  const handleSend = async (text?: string) => {
    const content = (text || input).trim()
    if (!content || sending) return

    setInput('')
    setSending(true)
    setError('')

    // Ensure session
    let sid = sessionId
    if (!sid) {
      sid = await ensureSession()
      if (!sid) { setSending(false); return }
    }

    // Optimistic user message
    const tempMsg: AIChatMessage = {
      id: 'temp-' + Date.now(),
      sessionId: sid,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const res = await apiService.sendChatMessage(sid, content)
      const { userMessage, aiMessage } = res.data
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        userMessage,
        aiMessage,
      ])
    } catch (sendErr) {
      console.error('[AI Chat] sendMessage failed:', getApiError(sendErr))
      setError(t('chat.failedToSendMessage'))
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
    }
    setSending(false)
  }

  const handleNewSession = async () => {
    setSessionId(null)
    setMessages([])
    setError('')
    try {
      await createNewSession()
    } catch (err) {
      console.error('[AI Chat] new session failed:', getApiError(err))
      setError(t('chat.couldNotCreateSession'))
    }
  }

  if (!isAuthenticated) return null

  // Floating bubble
  if (!open) {
    return (
      <button className="chat-widget-bubble" onClick={handleOpen} title={t('chat.aiBuddyHelper')}>
        <span className="chat-widget-bubble-icon">🐕</span>
        <span className="chat-widget-badge" />
      </button>
    )
  }

  // Chat panel
  return (
    <div className="chat-widget-panel">
      {/* Header */}
      <div className="chat-widget-header">
        <div className="chat-widget-header-avatar">🐕</div>
        <div className="chat-widget-header-info">
          <div className="chat-widget-header-title">{t('chat.aiBuddyHelper')}</div>
          <div className="chat-widget-header-status">
            {sending ? t('chat.thinking') : user ? t('chat.userAssistant', { name: user.firstName }) : t('chat.yourAssistant')}
          </div>
        </div>
        <button className="chat-widget-close" onClick={handleNewSession} title={t('chat.newChat')}>🔄</button>
        <button className="chat-widget-close" onClick={() => setOpen(false)} title={t('common.close')}>✕</button>
      </div>

      {/* Error */}
      {error && (
        <div className="chat-widget-error">
          {error}
          <button onClick={() => { setError(''); ensureSession() }} title="Retry">🔄</button>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Messages area */}
      <div className="chat-widget-messages">
        {initializing ? (
          <div className="chat-widget-welcome">
            <div style={{ fontSize: 36 }}>⏳</div>
            <p>{t('chat.startingUp')}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-widget-welcome">
            <div style={{ fontSize: 48 }}>🐕</div>
            <h3>{user ? t('chat.hiUser', { name: user.firstName }) : t('chat.hiGuest')}</h3>
            <p>
              {pets.length > 0
                ? <>{t('chat.iKnowAbout')} <strong>{pets.map(p => p.name).join(', ')}</strong> {t('chat.askMeAnything')}</>
                : t('chat.askMeAnythingGeneral')
              }
            </p>
            <div className="chat-widget-prompts">
              {suggestedPrompts.map(p => (
                <button key={p} className="chat-widget-prompt-btn" onClick={() => handleSend(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={msg.id || i} className={`chat-widget-msg ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chat-widget-msg-avatar ai">🐕</div>
                )}
                <div className={`chat-widget-msg-bubble ${msg.role}`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p>{children}</p>,
                        ul: ({ children }) => <ul>{children}</ul>,
                        ol: ({ children }) => <ol>{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        strong: ({ children }) => <strong>{children}</strong>,
                        code: ({ children }) => <code>{children}</code>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="chat-widget-msg assistant">
                <div className="chat-widget-msg-avatar ai">🐕</div>
                <div className="chat-widget-typing">
                  <div className="chat-widget-typing-dot" />
                  <div className="chat-widget-typing-dot" />
                  <div className="chat-widget-typing-dot" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="chat-widget-input-area">
        <input
          className="chat-widget-input"
          placeholder={t('chat.askAiBuddy')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          disabled={sending || initializing}
        />
        <button
          className="chat-widget-send"
          onClick={() => handleSend()}
          disabled={!input.trim() || sending || initializing}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  )
}

export default FloatingChatWidget

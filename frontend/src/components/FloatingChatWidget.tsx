import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import { AIChatMessage } from '../types'
import './FloatingChatWidget.css'

const SUGGESTED_PROMPTS = [
  'My pet is not eating 🍽️',
  'Vaccination schedule? 💉',
  'Emergency first aid 🚑',
  'Common skin issues 🐾',
]

const FloatingChatWidget: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [initializing, setInitializing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Ensure a session exists when panel opens
  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId

    setInitializing(true)
    try {
      // Try to reuse the most recent session
      const listRes = await apiService.listChatSessions()
      const sessions = listRes.data?.items || []
      if (sessions.length > 0) {
        const existing = sessions[0]
        setSessionId(existing.id)
        // Load existing messages
        const msgRes = await apiService.listChatMessages(existing.id)
        setMessages(msgRes.data || [])
        setInitializing(false)
        return existing.id
      }

      // Create a new session
      const res = await apiService.createChatSession({
        title: `AI Buddy ${new Date().toLocaleDateString()}`,
        contextType: 'general',
      })
      setSessionId(res.data.id)
      setInitializing(false)
      return res.data.id
    } catch {
      setError('Could not start chat session')
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
    } catch {
      setError('Failed to send message')
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
    }
    setSending(false)
  }

  const handleNewSession = async () => {
    setSessionId(null)
    setMessages([])
    setError('')
    try {
      const res = await apiService.createChatSession({
        title: `AI Buddy ${new Date().toLocaleDateString()}`,
        contextType: 'general',
      })
      setSessionId(res.data.id)
    } catch {
      setError('Could not create new session')
    }
  }

  if (!isAuthenticated) return null

  // Floating bubble
  if (!open) {
    return (
      <button className="chat-widget-bubble" onClick={handleOpen} title="AI Buddy Helper">
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
          <div className="chat-widget-header-title">AI Buddy Helper</div>
          <div className="chat-widget-header-status">
            {sending ? 'Thinking...' : 'Your veterinary assistant'}
          </div>
        </div>
        <button className="chat-widget-close" onClick={handleNewSession} title="New chat">🔄</button>
        <button className="chat-widget-close" onClick={() => setOpen(false)} title="Close">✕</button>
      </div>

      {/* Error */}
      {error && (
        <div className="chat-widget-error">
          {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Messages area */}
      <div className="chat-widget-messages">
        {initializing ? (
          <div className="chat-widget-welcome">
            <div style={{ fontSize: 36 }}>⏳</div>
            <p>Starting up...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-widget-welcome">
            <div style={{ fontSize: 48 }}>🐕</div>
            <h3>Hi! I'm AI Buddy 🐾</h3>
            <p>Ask me anything about pet health, symptoms, or veterinary care!</p>
            <div className="chat-widget-prompts">
              {SUGGESTED_PROMPTS.map(p => (
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
          placeholder="Ask AI Buddy..."
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

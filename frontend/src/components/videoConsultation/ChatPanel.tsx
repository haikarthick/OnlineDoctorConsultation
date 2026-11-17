import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/SettingsContext'
import { ChatMessage } from '../../types'

interface ChatPanelProps {
  showChat: boolean
  setShowChat: (show: boolean) => void
  messages: ChatMessage[]
  currentUserId?: string
  newMessage: string
  setNewMessage: (value: string) => void
  onSend: () => void
  chatEndRef: React.RefObject<HTMLDivElement>
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  showChat, setShowChat, messages, currentUserId, newMessage, setNewMessage, onSend, chatEndRef
}) => {
  const { t } = useTranslation()
  const { formatTime } = useSettings()

  if (!showChat) {
    return (
      <button
        className="btn btn-outline si-b34d9cba"

        onClick={() => setShowChat(true)}
      >
        💬 {t('videoConsultation.chat')}
      </button>
    )
  }

  return (
    <div className="chat-panel">
      <div className="card-header">
        <h3>💬 {t('videoConsultation.chat')}</h3>
        <button className="btn btn-sm btn-outline" onClick={() => setShowChat(false)}>✕</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="si-4f4232ea">
            <p>{t('videoConsultation.noMessages')}</p>
            <p className="si-0a803082">{t('videoConsultation.startConversation')}</p>
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`chat-message ${msg.senderId === currentUserId ? 'sent' : 'received'}`}
          >
            <div className="msg-sender">{msg.senderName}</div>
            <div>{msg.message}</div>
            <div className="msg-time">
              {formatTime(msg.timestamp)}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          className="chat-input"
          type="text"
          placeholder={t('videoConsultation.typeMessage')}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
        />
        <button className="chat-send-btn" onClick={onSend}>
          ➤
        </button>
      </div>
    </div>
  )
}

export default ChatPanel

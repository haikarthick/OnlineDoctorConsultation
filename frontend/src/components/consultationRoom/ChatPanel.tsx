import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChatMessage } from '../../types'

interface ChatPanelProps {
  messages: ChatMessage[]
  currentUserId?: string
  formatTime: (ts: any) => string
  newMessage: string
  onChangeMessage: (v: string) => void
  onSendMessage: () => void
  chatEndRef: React.RefObject<HTMLDivElement>
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, currentUserId, formatTime, newMessage, onChangeMessage, onSendMessage, chatEndRef
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="si-97639f58">
            <p>{t('consultationRoom.noMessagesYet')}</p>
            <p className="si-0a803082">{t('consultationRoom.startConversation')}</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.senderId === currentUserId ? 'sent' : 'received'}`}>
            <div className="msg-sender">{msg.senderName}</div>
            <div>{msg.message}</div>
            <div className="msg-time">{formatTime(msg.timestamp)}</div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input-area">
        <input className="chat-input" placeholder={t('consultationRoom.typeMessage')}
          value={newMessage}
          onChange={e => onChangeMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSendMessage()} />
        <button className="chat-send-btn" onClick={onSendMessage}>➤</button>
      </div>
    </>
  )
}

export default ChatPanel

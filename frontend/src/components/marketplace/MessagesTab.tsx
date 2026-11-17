import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceThread, MarketplaceMessage } from '../../types'

export const MessagesTab: React.FC<{
  threads: MarketplaceThread[]; activeThread: MarketplaceThread | null; onOpenThread: (thread: MarketplaceThread) => void; onCloseThread: () => void;
  threadMessages: MarketplaceMessage[]; currentUserId?: string;
  messageDraft: string; onMessageDraftChange: (v: string) => void; onSendMessage: () => void; t: TFunction;
}> = ({ threads, activeThread, onOpenThread, onCloseThread, threadMessages, currentUserId, messageDraft, onMessageDraftChange, onSendMessage, t }) => (
  <div className="mp-messages-layout">
    <div className={`mp-thread-list ${activeThread ? 'has-active' : ''}`}>
      <h3 className="mp-section-title">💬 {t('marketplace.tabs.messages')}</h3>
      {threads.length === 0 && <p className="mp-empty">{t('marketplace.engagement.noMessages')}</p>}
      {threads.map(th => (
        <div key={th.id} className={`mp-thread-item ${activeThread?.id === th.id ? 'active' : ''}`} onClick={() => onOpenThread(th)}>
          <div className="mp-thread-item-top">
            <span className="mp-thread-title">{th.listing_title || t('marketplace.engagement.listing')}</span>
            {(th.my_unread || 0) > 0 && <span className="mp-thread-unread">{th.my_unread}</span>}
          </div>
          <div className="mp-thread-sub">
            <span className="mp-thread-role">{th.my_role === 'buyer' ? `🛒 ${th.seller_name || ''}` : `🏠 ${th.buyer_name || ''}`}</span>
            {th.last_message_at && <span className="mp-thread-time">{new Date(th.last_message_at).toLocaleDateString()}</span>}
          </div>
          {th.last_message && <div className="mp-thread-preview">{th.last_message}</div>}
        </div>
      ))}
    </div>
    <div className={`mp-chat-panel ${activeThread ? 'open' : ''}`}>
      {activeThread ? (
        <>
          <div className="mp-chat-header">
            <button className="mp-chat-back" onClick={onCloseThread}>←</button>
            <div>
              <div className="mp-chat-title">{activeThread.listing_title || t('marketplace.engagement.listing')}</div>
              <div className="mp-chat-sub">{activeThread.my_role === 'buyer' ? activeThread.seller_name : activeThread.buyer_name}</div>
            </div>
          </div>
          <div className="mp-chat-safety">🔒 {t('marketplace.engagement.chatSafety')}</div>
          <div className="mp-chat-messages">
            {threadMessages.length === 0 && <p className="mp-empty">{t('marketplace.engagement.startConversation')}</p>}
            {threadMessages.map(m => (
              <div key={m.id} className={`mp-chat-bubble ${m.sender_id === currentUserId ? 'mine' : 'theirs'}`}>
                <div className="mp-chat-body">{m.body}</div>
                <div className="mp-chat-meta">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
          <div className="mp-chat-input">
            <textarea className="module-input" value={messageDraft} onChange={e => onMessageDraftChange(e.target.value)}
              placeholder={t('marketplace.engagement.typeMessage')} rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage() } }} />
            <button className="module-btn primary" onClick={onSendMessage} disabled={!messageDraft.trim()}>{t('marketplace.engagement.send')}</button>
          </div>
        </>
      ) : (
        <div className="mp-chat-empty">{t('marketplace.engagement.selectConversation')}</div>
      )}
    </div>
  </div>
)

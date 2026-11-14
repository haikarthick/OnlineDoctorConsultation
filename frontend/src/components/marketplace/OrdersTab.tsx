import React from 'react'
import type { TFunction } from 'i18next'
import { MarketplaceOrder } from '../../types'
import { g } from './publicListingShared'

export const OrdersTab: React.FC<{
  orderRole: 'buyer' | 'seller'; onOrderRoleChange: (role: 'buyer' | 'seller') => void;
  inquiries: any[]; orders: MarketplaceOrder[];
  speciesLabel: (s: string, t: TFunction) => string; formatCurrency: (n: number) => string;
  dealPaymentMethod: Record<string, string>; onDealPaymentMethodChange: (orderId: string, method: string) => void;
  onConfirmDeal: (orderId: string) => void; onCancelDeal: (orderId: string) => void; t: TFunction;
}> = ({ orderRole, onOrderRoleChange, inquiries, orders, speciesLabel, formatCurrency, dealPaymentMethod, onDealPaymentMethodChange, onConfirmDeal, onCancelDeal, t }) => (
  <div>
    <div className="mp-order-toggle">
      <button className={`module-btn ${orderRole === 'buyer' ? 'primary' : ''}`} onClick={() => onOrderRoleChange('buyer')}>{t('marketplace.orders.asBuyer')}</button>
      <button className={`module-btn ${orderRole === 'seller' ? 'primary' : ''}`} onClick={() => onOrderRoleChange('seller')}>{t('marketplace.orders.asSeller')}</button>
    </div>
    {inquiries.length > 0 && (
      <div className="mp-section">
        <h3 className="mp-section-title">💌 {t('marketplace.orders.inquiriesTitle')}</h3>
        <div className="data-table-container">
          <table className="module-table">
            <thead><tr><th>{t('marketplace.orders.item')}</th><th>{t('marketplace.orders.message')}</th><th>{t('marketplace.orders.date')}</th><th>{t('marketplace.orders.status')}</th></tr></thead>
            <tbody>
              {inquiries.map((inq: any) => (
                <tr key={inq.id}>
                  <td>{inq.listingTitle || inq.listing_title || '-'}</td>
                  <td>{inq.message || '-'}</td>
                  <td>{inq.created_at ? new Date(inq.created_at).toLocaleDateString() : '-'}</td>
                  <td><span className={`module-badge ${inq.status === 'responded' ? 'success' : ''}`}>{inq.status || 'pending'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    {/* Free-classifieds note: settlement is between the parties, off-platform */}
    <div className="mp-deal-free-note mp-deal-tab-note">💡 {t('marketplace.deal.tabNote')}</div>
    <div className="data-table-container">
      <table className="module-table">
        <thead><tr><th>{t('marketplace.orders.item')}</th><th>{t('marketplace.livestock.species')}</th><th>{orderRole === 'buyer' ? t('marketplace.detail.seller') : t('marketplace.orders.asBuyer').replace('🛒 ', '')}</th><th>{t('marketplace.orders.qty')}</th><th>{t('marketplace.orders.total')}</th><th>{t('marketplace.orders.status')}</th><th>{t('marketplace.orders.date')}</th><th>{t('marketplace.deal.actionsCol')}</th></tr></thead>
        <tbody>
          {orders.map(o => {
            const myConfirm = orderRole === 'buyer' ? g(o, 'buyerConfirmedAt', 'buyer_confirmed_at') : g(o, 'sellerConfirmedAt', 'seller_confirmed_at')
            const otherConfirm = orderRole === 'buyer' ? g(o, 'sellerConfirmedAt', 'seller_confirmed_at') : g(o, 'buyerConfirmedAt', 'buyer_confirmed_at')
            const reservedUntil = g(o, 'reservedUntil', 'reserved_until')
            const statusKey = `marketplace.deal.status.${o.status}`
            const statusLabel = t(statusKey) === statusKey ? o.status : t(statusKey)
            return (
              <tr key={o.id}>
                <td>{g(o, 'listingTitle', 'listing_title') || '-'}</td>
                <td>{o.species ? speciesLabel(o.species, t) : '-'}</td>
                <td>{orderRole === 'buyer' ? g(o, 'sellerName', 'seller_name') : g(o, 'buyerName', 'buyer_name')}</td>
                <td>{o.quantity}</td>
                <td className="mp-price-highlight">{formatCurrency(g(o, 'totalPrice', 'total_price') || 0)}</td>
                <td>
                  <span className={`module-badge ${o.status === 'completed' || o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'error' : ''}`}>{statusLabel}</span>
                  {o.status === 'reserved' && reservedUntil && (
                    <div className="mp-deal-until">{t('marketplace.deal.reservedUntil')}: {new Date(reservedUntil).toLocaleDateString()}</div>
                  )}
                </td>
                <td>{(g(o, 'createdAt', 'created_at')) ? new Date(g(o, 'createdAt', 'created_at')).toLocaleDateString() : '-'}</td>
                <td>
                  {o.status === 'reserved' ? (
                    <div className="mp-deal-actions">
                      {myConfirm ? (
                        <span className="mp-deal-waiting">✓ {t('marketplace.deal.waitingOther')}</span>
                      ) : (
                        <>
                          {orderRole === 'buyer' && (
                            <select className="module-input mp-deal-pm" value={dealPaymentMethod[o.id] || ''} onChange={e => onDealPaymentMethodChange(o.id, e.target.value)}>
                              <option value="">{t('marketplace.deal.paymentMethod')}</option>
                              <option value="cash">{t('marketplace.deal.pm.cash')}</option>
                              <option value="upi">{t('marketplace.deal.pm.upi')}</option>
                              <option value="bank_transfer">{t('marketplace.deal.pm.bankTransfer')}</option>
                              <option value="other">{t('marketplace.deal.pm.other')}</option>
                            </select>
                          )}
                          <button className="module-btn small primary" onClick={() => onConfirmDeal(o.id)}>
                            ✅ {orderRole === 'buyer' ? t('marketplace.deal.confirmReceipt') : t('marketplace.deal.confirmPayment')}
                          </button>
                        </>
                      )}
                      {otherConfirm && !myConfirm && <span className="mp-deal-other-done">👍 {t('marketplace.deal.otherConfirmed')}</span>}
                      <button className="module-btn small" onClick={() => onCancelDeal(o.id)}>✖ {t('marketplace.deal.cancelDeal')}</button>
                    </div>
                  ) : o.status === 'completed' ? (
                    <span className="mp-deal-done">🎉 {t('marketplace.deal.dealDone')}</span>
                  ) : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    {orders.length === 0 && <p className="mp-empty">{t('marketplace.orders.noOrders')}</p>}
  </div>
)

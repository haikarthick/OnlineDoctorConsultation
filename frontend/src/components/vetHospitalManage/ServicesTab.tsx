import React from 'react'
import type { TFunction } from 'i18next'
import type { HospitalService } from '../../types'

interface Props {
  t: TFunction
  services: HospitalService[]
  formatCurrency: (amount: number) => string
  onAddService: () => void
  onEditService: (svc: HospitalService) => void
  onDeleteService: (svc: HospitalService) => void
}

const ServicesTab: React.FC<Props> = ({ t, services, formatCurrency, onAddService, onEditService, onDeleteService }) => (
  <div>
    <div className="si-c66b816b">
      <h3 className="si-44087c4b">{t('vetHospitalManage.services.title')} ({services.length})</h3>
      <button className="btn-primary" onClick={onAddService}>+ {t('vetHospitalManage.modal.addService')}</button>
    </div>
    {services.length === 0
      ? <div className="empty-state"><div className="empty-state-icon">💊</div><p>{t('vetHospitalManage.services.emptyState')}</p></div>
      : <div className="vh-services-grid">
          {services.map(svc => (
            <div key={svc.id} className="vh-service-card">
              <div className="vh-service-cat">{svc.category}</div>
              <div className="vh-service-name">{svc.serviceName}</div>
              {(svc.priceMin || svc.priceMax) && (
                <div className="vh-service-price">
                  {svc.priceMin && svc.priceMax && svc.priceMin !== svc.priceMax
                    ? `${formatCurrency(svc.priceMin)}-${formatCurrency(svc.priceMax)}`
                    : `${formatCurrency(svc.priceMin || svc.priceMax || 0)}`}
                </div>
              )}
              {svc.durationMinutes && <div className="vh-service-duration">⏱ {svc.durationMinutes} min</div>}
              <div className="si-b074ba0c">
                <button className="btn-secondary si-aa7179fc" onClick={() => onEditService(svc)}>{t('common.edit')}</button>
                <button className="btn-danger si-aa7179fc" onClick={() => onDeleteService(svc)}>{t('common.delete')}</button>
              </div>
            </div>
          ))}
        </div>}
  </div>
)

export default ServicesTab

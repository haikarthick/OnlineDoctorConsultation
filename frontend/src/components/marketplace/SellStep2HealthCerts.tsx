import React from 'react'
import type { TFunction } from 'i18next'

export const SellStep2HealthCerts: React.FC<{
  sellForm: Record<string, any>; sf: (key: string, value: any) => void; setSellForm: (updater: (f: Record<string, any>) => Record<string, any>) => void;
  marketplaceConditions: any[]; resolveLabel: (term: any, t: TFunction) => string;
  maxListingImages: number; minRecommendedPhotos: number; uploadingImages: boolean; uploadProgress: { done: number; total: number }; onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingVideo: boolean; onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; maxVideoDurationSeconds: number; maxVideoSizeMb: number;
  onBack: () => void; onNext: () => void; t: TFunction;
}> = ({ sellForm, sf, setSellForm, marketplaceConditions, resolveLabel, maxListingImages, minRecommendedPhotos, uploadingImages, uploadProgress, onImageUpload, uploadingVideo, onVideoUpload, maxVideoDurationSeconds, maxVideoSizeMb, onBack, onNext, t }) => (
  <div className="mp-sell-step">
    <h3>{t('marketplace.sell.healthCertsTitle')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.sell.healthCertsDesc')}</p>
    <div className="module-form">
      <div className="module-form-row">
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.livestock.vaccination')}</label>
          <select className="module-input" value={sellForm.vaccinationStatus} onChange={e => sf('vaccinationStatus', e.target.value)}>
            <option value="unknown">{t('marketplace.vaxLabel.unknown')}</option>
            <option value="fully_vaccinated">{t('marketplace.vaxLabel.fully')}</option>
            <option value="partially_vaccinated">{t('marketplace.vaxLabel.partial')}</option>
            <option value="not_vaccinated">{t('marketplace.vaxLabel.none')}</option>
          </select>
        </div>
        <div className="module-form-group">
          <label className="module-label">{t('marketplace.livestock.condition')}</label>
          <select className="module-input" value={sellForm.condition} onChange={e => sf('condition', e.target.value)}>
            {marketplaceConditions.map(c => <option key={c.code} value={c.code}>{resolveLabel(c, t)}</option>)}
          </select>
        </div>
      </div>
      <div className="module-form-group">
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={sellForm.healthCertificate} onChange={e => sf('healthCertificate', e.target.checked)} />
          {t('marketplace.sell.hasHealthCert')}
        </label>
      </div>
      <div className="module-form-group">
        <label className="mp-checkbox-label">
          <input type="checkbox" checked={sellForm.welfareAttestation} onChange={e => sf('welfareAttestation', e.target.checked)} />
          {t('marketplace.compliance.welfareAttestation')}
        </label>
        <div className="mp-compliance-hint">{t('marketplace.compliance.welfareHint')}</div>
      </div>
      <div className="module-form-group">
        <label className="module-label">{t('marketplace.livestock.contact')}</label>
        <input className="module-input" value={sellForm.contactPhone} onChange={e => sf('contactPhone', e.target.value)} placeholder={t('marketplace.sell.contactPlaceholder')} />
      </div>
      {/* Photos and video: what a buyer looks at first */}
      <div className="mp-form-section">
        <div className="mp-form-section-title">📸 {t('marketplace.sell.imagesTitle', 'Listing Images')}</div>
        <p className="mp-compliance-hint">{t('marketplace.sell.photosHint', { min: minRecommendedPhotos })}</p>
        <div className="mp-media-actions">
          <label className={`module-btn primary mp-media-btn ${uploadingImages || (sellForm.images?.length || 0) >= maxListingImages ? 'muted' : ''}`}>
            📷 {t('marketplace.sell.takePhoto')}
            <input type="file" accept="image/*" capture="environment" className="mp-file-hidden" onChange={onImageUpload}
              disabled={uploadingImages || (sellForm.images?.length || 0) >= maxListingImages} />
          </label>
          <label className={`module-btn mp-media-btn ${uploadingImages || (sellForm.images?.length || 0) >= maxListingImages ? 'muted' : ''}`}>
            🖼️ {t('marketplace.sell.choosePhotos')}
            <input type="file" accept="image/*" multiple className="mp-file-hidden" onChange={onImageUpload}
              disabled={uploadingImages || (sellForm.images?.length || 0) >= maxListingImages} />
          </label>
        </div>
        <div className="mp-media-count" aria-live="polite">
          {t('marketplace.sell.photosCount', { count: sellForm.images?.length || 0, max: maxListingImages })}
          {uploadingImages && <> · {t('marketplace.sell.uploadProgress', { done: uploadProgress.done, total: uploadProgress.total })}</>}
        </div>
        {sellForm.images?.length > 0 && (
          <div className="mp-image-preview-row">
            {sellForm.images.map((url: string, i: number) => (
              <div key={url} className="mp-image-preview">
                <img src={url} alt={`${t('marketplace.gallery.photo')} ${i + 1}`} />
                {i === 0 && <span className="mp-cover-badge">{t('marketplace.sell.coverPhoto')}</span>}
                {i > 0 && (
                  <button type="button" className="mp-image-cover" onClick={() => {
                    setSellForm((prev: Record<string, any>) => ({ ...prev, images: [url, ...prev.images.filter((u: string) => u !== url)] }))
                  }}>{t('marketplace.sell.makeCover')}</button>
                )}
                <button type="button" className="mp-image-remove" aria-label={t('marketplace.sell.removePhoto')} onClick={() => {
                  setSellForm((prev: Record<string, any>) => ({ ...prev, images: prev.images.filter((_: string, idx: number) => idx !== i) }))
                }}>×</button>
              </div>
            ))}
          </div>
        )}
        {/* Optional video */}
        <div className="module-form-group si-7930ee5e">
          <label className="module-label">🎥 {t('marketplace.sell.videoLabel')}</label>
          {sellForm.videoUrl ? (
            <div className="mp-video-set">
              <span>✅ {t('marketplace.sell.videoAdded')}</span>
              <button type="button" className="module-btn small" onClick={() => sf('videoUrl', '')}>{t('marketplace.sell.removeVideo')}</button>
            </div>
          ) : (
            <>
              <div className="mp-media-actions">
                <label className={`module-btn mp-media-btn ${uploadingVideo ? 'muted' : ''}`}>
                  🎬 {t('marketplace.sell.recordVideo')}
                  <input type="file" accept="video/*" capture="environment" className="mp-file-hidden" onChange={onVideoUpload} disabled={uploadingVideo} />
                </label>
                <label className={`module-btn mp-media-btn ${uploadingVideo ? 'muted' : ''}`}>
                  📁 {t('marketplace.sell.chooseVideo')}
                  <input type="file" accept="video/*" className="mp-file-hidden" onChange={onVideoUpload} disabled={uploadingVideo} />
                </label>
              </div>
              {uploadingVideo && <div className="input-error-msg si-8ad4a3c7">{t('marketplace.sell.uploadingVideo', 'Uploading video...')}</div>}
              <div className="mp-compliance-hint">{t('marketplace.sell.videoHint')}</div>
              <div className="mp-compliance-hint">{t('marketplace.sell.videoLimits', { maxSec: maxVideoDurationSeconds, maxMb: maxVideoSizeMb, defaultValue: `Max ${maxVideoDurationSeconds} seconds, up to ${maxVideoSizeMb}MB` })}</div>
            </>
          )}
        </div>
      </div>
    </div>
    <div className="mp-step-actions">
      <button className="module-btn" onClick={onBack}>{t('marketplace.sell.back')}</button>
      <button className="module-btn primary" onClick={onNext}>{t('marketplace.sell.next')}</button>
    </div>
  </div>
)

import React from 'react'
import type { TFunction } from 'i18next'

/** Step 1 of selling: photos and video first - buyers decide from them before they read anything else. */
export const SellStepPhotos: React.FC<{
  sellForm: Record<string, any>; sf: (key: string, value: any) => void; setSellForm: (updater: (f: Record<string, any>) => Record<string, any>) => void;
  maxListingImages: number; minRecommendedPhotos: number; uploadingImages: boolean; uploadProgress: { done: number; total: number }; onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingVideo: boolean; onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; maxVideoDurationSeconds: number; maxVideoSizeMb: number;
  onNext: () => void; t: TFunction;
}> = ({ sellForm, sf, setSellForm, maxListingImages, minRecommendedPhotos, uploadingImages, uploadProgress, onImageUpload, uploadingVideo, onVideoUpload, maxVideoDurationSeconds, maxVideoSizeMb, onNext, t }) => (
  <div className="mp-sell-step">
    <h3>{t('marketplace.sell.photosStepTitle')}</h3>
    <p className="mp-sell-step-desc">{t('marketplace.sell.photosStepDesc')}</p>
    <div className="module-form">
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
      <button className="module-btn primary" onClick={onNext}>{t('marketplace.sell.next')}</button>
    </div>
  </div>
)

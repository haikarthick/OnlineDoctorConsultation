import { usePWA } from '../hooks/usePWA';
import './PWAPrompt.css';

export function PWAPrompt() {
  const { canInstall, updateAvailable, install, applyUpdate, dismissUpdate } = usePWA();

  if (updateAvailable) {
    return (
      <div className="pwa-banner pwa-update-banner">
        <div className="pwa-banner-content">
          <span className="pwa-banner-icon">🔄</span>
          <div className="pwa-banner-text">
            <strong>Update Available</strong>
            <span>A new version of VetCare is ready.</span>
          </div>
        </div>
        <div className="pwa-banner-actions">
          <button className="pwa-btn pwa-btn-secondary" onClick={dismissUpdate}>Later</button>
          <button className="pwa-btn pwa-btn-primary" onClick={applyUpdate}>Update Now</button>
        </div>
      </div>
    );
  }

  if (canInstall) {
    return (
      <div className="pwa-banner pwa-install-banner">
        <div className="pwa-banner-content">
          <span className="pwa-banner-icon">📲</span>
          <div className="pwa-banner-text">
            <strong>Install VetCare</strong>
            <span>Add to your home screen for quick access.</span>
          </div>
        </div>
        <div className="pwa-banner-actions">
          <button className="pwa-btn pwa-btn-primary" onClick={install}>Install</button>
        </div>
      </div>
    );
  }

  return null;
}

import { useState, useEffect, useCallback } from 'react';
import { isInstallAvailable, promptInstall, isPWA } from '../pwa';

interface UsePWAReturn {
  /** Whether the app can be installed (install prompt is available) */
  canInstall: boolean;
  /** Whether the app is already running as a PWA */
  isStandalone: boolean;
  /** Whether an SW update is available */
  updateAvailable: boolean;
  /** Trigger the install prompt */
  install: () => Promise<boolean>;
  /** Apply the pending service worker update */
  applyUpdate: () => void;
  /** Dismiss the update banner */
  dismissUpdate: () => void;
}

export function usePWA(): UsePWAReturn {
  const [canInstall, setCanInstall] = useState(isInstallAvailable());
  const [isStandalone] = useState(isPWA());
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const onInstallAvailable = () => setCanInstall(true);
    const onInstalled = () => setCanInstall(false);
    const onUpdateAvailable = () => setUpdateAvailable(true);

    window.addEventListener('pwa-install-available', onInstallAvailable);
    window.addEventListener('pwa-installed', onInstalled);
    window.addEventListener('sw-update-available', onUpdateAvailable);

    return () => {
      window.removeEventListener('pwa-install-available', onInstallAvailable);
      window.removeEventListener('pwa-installed', onInstalled);
      window.removeEventListener('sw-update-available', onUpdateAvailable);
    };
  }, []);

  const install = useCallback(async () => {
    const accepted = await promptInstall();
    if (accepted) setCanInstall(false);
    return accepted;
  }, []);

  const applyUpdate = useCallback(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { canInstall, isStandalone, updateAvailable, install, applyUpdate, dismissUpdate };
}

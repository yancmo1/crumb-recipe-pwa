import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import { isNativePlatform } from '../utils/nativeLocalNotifications';

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let updateToastShown = false;

let manualCheckTimer: number | null = null;
let manualCheckPending = false;

function clearManualCheck(): void {
  if (manualCheckTimer !== null) {
    window.clearTimeout(manualCheckTimer);
    manualCheckTimer = null;
  }
  manualCheckPending = false;
}

export function initPwaUpdateFlow(): void {
  // Idempotent: safe to call multiple times.
  if (updateSW) return;

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (isNativePlatform()) return;

  updateSW = registerSW({
    onNeedRefresh() {
      // Common practice: inform the user and let them choose when to reload.
      // (Avoid surprise reloads mid-cook.)
      if (updateToastShown) return;
      updateToastShown = true;

      // If this was triggered by a manual "Check for updates", stop the fallback timer.
      clearManualCheck();

      toast('Update available', {
        description: 'A newer version of CrumbWorks is ready. Reload to apply it.',
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: async () => {
            updateToastShown = false;
            try {
              await updateSW?.(true);
            } catch {
              window.location.reload();
            }
          }
        },
        cancel: {
          label: 'Later',
          onClick: () => {
            updateToastShown = false;
          }
        }
      });
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
    onRegisterError(error) {
      console.warn('Service worker registration error:', error);
    }
  });
}

export async function checkForPwaUpdates(opts?: { showNoUpdateToast?: boolean }): Promise<void> {
  if (typeof window === 'undefined') return;

  // Ensure initialization has run (safe + idempotent)
  initPwaUpdateFlow();

  if (!updateSW) {
    if (opts?.showNoUpdateToast) {
      toast('Updates not available', {
        description: 'This environment does not support service worker updates.'
      });
    }
    return;
  }

  if (opts?.showNoUpdateToast) {
    // We can't synchronously know whether an update exists.
    // If onNeedRefresh does not fire shortly, assume we're up to date.
    clearManualCheck();
    manualCheckPending = true;

    manualCheckTimer = window.setTimeout(() => {
      if (!manualCheckPending) return;
      clearManualCheck();
      toast('You’re up to date', {
        description: 'No new update was found.'
      });
    }, 4000);
  }

  try {
    const maybePromise = updateSW(false) as unknown;
    if (maybePromise && typeof (maybePromise as any).catch === 'function') {
      await (maybePromise as any).catch(() => {
        // Ignore update check errors (offline / transient)
      });
    }
  } catch {
    // Ignore update check errors (offline / transient)
  }
}

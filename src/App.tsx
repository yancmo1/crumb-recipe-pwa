import { useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { useRecipeStore } from './state/session';
import Library from './pages/Library';
import ImportRecipe from './pages/ImportRecipe';
import RecipeDetail from './pages/RecipeDetail';
import Settings from './pages/Settings';
import { registerSW } from 'virtual:pwa-register';

// Register service worker
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let updateToastShown = false;

if ('serviceWorker' in navigator) {
  updateSW = registerSW({
    onNeedRefresh() {
      // Common practice: inform the user and let them choose when to reload.
      // (Avoid surprise reloads mid-cook.)
      if (updateToastShown) return;
      updateToastShown = true;

      toast('Update available', {
        description: 'A newer version of Crumb is ready. Reload to apply it.',
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: async () => {
            updateToastShown = false;
            try {
              await updateSW?.(true);
            } catch {
              // If reload fails for some reason, at least don't get stuck.
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
      // Helpful for first install; keep it quiet after that.
      console.log('App ready to work offline');
    },
    onRegisterError(error) {
      console.warn('Service worker registration error:', error);
    }
  });
}

function App() {
  const loadRecipes = useRecipeStore((state) => state.loadRecipes);
  const didInitialLoad = useRef(false);

  useEffect(() => {
    // In React 18 StrictMode (dev), effects run twice.
    // Guard to avoid duplicate network calls + duplicated console noise.
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    loadRecipes();
  }, [loadRecipes]);

  // Periodically check for a new service worker so installed PWAs update promptly.
  // Note: browsers still control SW update timing; this just nudges checks.
  useEffect(() => {
    if (!updateSW) return;

    const checkForUpdates = () => {
      updateSW?.(false).catch(() => {
        // Ignore update check errors (offline / transient)
      });
    };

    // Check shortly after app loads (helps right after deploy)
    const initialTimer = window.setTimeout(checkForUpdates, 10_000);
    // And periodically while open
    const interval = window.setInterval(checkForUpdates, 30 * 60 * 1000); // 30 min

    // Also check when the app/tab comes back into focus
    const onFocus = () => checkForUpdates();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/import" element={<ImportRecipe />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
    </div>
  );
}

export default App;
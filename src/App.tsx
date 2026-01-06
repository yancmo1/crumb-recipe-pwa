import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { useRecipeStore } from './state/session';
import Library from './pages/Library';
const ImportRecipe = lazy(() => import('./pages/ImportRecipe'));
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/About'));
const StyleGuide = lazy(() => import('./pages/StyleGuide'));
import Home from './pages/Home';
const EditRecipe = lazy(() => import('./pages/EditRecipe'));
import { registerSW } from 'virtual:pwa-register';
import { isNativePlatform } from './utils/nativeLocalNotifications.ts';
import { getHasSeenWelcome } from './utils/welcome';
import { initializeDatabase } from './initDatabase';

// Register service worker
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let updateToastShown = false;

if ('serviceWorker' in navigator && !isNativePlatform()) {
  updateSW = registerSW({
    onNeedRefresh() {
      // Common practice: inform the user and let them choose when to reload.
      // (Avoid surprise reloads mid-cook.)
      if (updateToastShown) return;
      updateToastShown = true;

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
  const [dbInitialized, setDbInitialized] = useState(false);

  const WelcomeGate = () => {
    const [hasSeen, setHasSeen] = useState<boolean | null>(null);

    useEffect(() => {
      setHasSeen(getHasSeenWelcome());
    }, []);

    if (hasSeen === null) {
      // Keep initial paint quiet; this resolves immediately in practice.
      return null;
    }

    return hasSeen ? <Navigate to="/library" replace /> : <Home />;
  };

  useEffect(() => {
    // Initialize multi-user database system first
    initializeDatabase()
      .then(() => {
        setDbInitialized(true);
      })
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        toast.error('Failed to initialize app. Please refresh the page.');
      });
  }, []);

  useEffect(() => {
    // In React 18 StrictMode (dev), effects run twice.
    // Guard to avoid duplicate network calls + duplicated console noise.
    if (didInitialLoad.current || !dbInitialized) return;
    didInitialLoad.current = true;
    loadRecipes();
  }, [loadRecipes, dbInitialized]);

  // Periodically check for a new service worker so installed PWAs update promptly.
  // Note: browsers still control SW update timing; this just nudges checks.
  useEffect(() => {
    if (!updateSW) return;

    const checkForUpdates = () => {
      // `virtual:pwa-register`'s update function is typed as returning a Promise,
      // but in some setups it can effectively return void at runtime.
      // Guard before calling `.catch()` to avoid crashes.
      try {
        const maybePromise = updateSW(false) as unknown;
        if (maybePromise && typeof (maybePromise as any).catch === 'function') {
          (maybePromise as any).catch(() => {
            // Ignore update check errors (offline / transient)
          });
        }
      } catch {
        // Ignore update check errors (offline / transient)
      }
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

  // Don't render routes until database is initialized
  if (!dbInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-600">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="p-6 text-center text-gray-600">Loading…</div>}>
        <Routes>
        <Route path="/" element={<WelcomeGate />} />
        <Route path="/home" element={<WelcomeGate />} />
        <Route path="/library" element={<Library />} />
        <Route path="/import" element={<ImportRecipe />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/recipe/:id/edit" element={<EditRecipe />} />
        <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/styleguide" element={<StyleGuide />} />
        </Routes>
      </Suspense>
      <Toaster 
        position="top-center"
        // Safe-area insets: keep toasts out of the status bar region on notch devices.
        // On browsers without safe-area support, env(safe-area-inset-*) resolves to 0px.
        offset={{
          top: 'calc(env(safe-area-inset-top) + 12px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 12px)'
        }}
        mobileOffset={{
          top: 'calc(env(safe-area-inset-top) + 12px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 12px)'
        }}
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
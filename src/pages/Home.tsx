import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { RvHeader } from '../components/RvHeader';
import { RvDrawer } from '../components/RvDrawer';
import { setHasSeenWelcome } from '../utils/welcome';

/**
 * Home / Launch screen for CrumbWorks (deterministic per spec §13)
 * - Full-bleed orange gradient background with radial glow
 * - Hero vault graphic centered
 * - Headline + subhead
 * - CTA: Get Started (56px pill, gradient left→right, shadow)
 * 
 * This page uses heroMode — no nav strip, gradient fills the viewport.
 */
export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // The hero screen is a one-time welcome. Once it has been shown,
    // future launches should go straight to the app.
    setHasSeenWelcome();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile drawer (hidden on tablet+) */}
      <RvDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header — always visible, full-width */}
      <RvHeader title="CrumbWorks" onMenuOpen={() => setDrawerOpen(true)} />

      {/* Hero zone with gradient background and glow */}
      <div className="flex-1 rv-header-gradient relative flex flex-col items-center justify-center px-6 py-12">
        {/* Radial glow behind hero */}
        <div className="absolute inset-0 rv-hero-glow pointer-events-none" />

        {/* Hero graphic (vault icon fallback; replace with PNG asset if available) */}
        <div className="relative z-10 w-40 h-40 md:w-52 md:h-52 rounded-full bg-white/10 flex items-center justify-center shadow-lg">
          <Lock className="h-20 w-20 md:h-28 md:w-28 text-white drop-shadow" />
        </div>

        {/* Headline */}
        <h1 className="relative z-10 mt-8 text-white font-bold text-4xl md:text-5xl text-center tracking-tight">
          Your recipes, safely stored
        </h1>

        {/* Subhead */}
        <p className="relative z-10 mt-3 text-white/90 text-lg md:text-xl text-center max-w-md">
          Organize, edit, and cook with confidence — even offline.
        </p>

        {/* CTA Button */}
        <button
          type="button"
          onClick={() => navigate('/library', { replace: true })}
          className="relative z-10 mt-10 inline-flex items-center justify-center h-14 px-10 rounded-full rv-cta-gradient rv-cta-shadow text-white font-bold text-lg hover:opacity-95 transition-opacity"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

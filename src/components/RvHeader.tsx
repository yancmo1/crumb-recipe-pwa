import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';

type Props = {
  /** Header title text (mobile center) or app name (tablet+ left) */
  title: string;
  /** Optional hamburger click handler (mobile only) */
  onMenuOpen?: () => void;
  /** Optional right slot content (reserved 32px) */
  rightSlot?: ReactNode;
};

/**
 * CrumbWorks Header (LOCKED palette)
 * 
 * LAYOUT RULES:
 * - Always spans 100% width (no sidebar layout)
 * - Mobile (<768px): 72px height, hamburger left, title center
 * - Tablet+ (>=768px): 88px height, "CrumbWorks" left-aligned, no hamburger
 * - Background: orange gradient #CB3002 → #F85F1E → #E77320 (top → bottom)
 * - Safe-area padding added on top
 */
export function RvHeader({ title, onMenuOpen, rightSlot }: Props) {
  return (
    <header
      className="rv-header-gradient sticky top-0 z-40 w-full pt-[env(safe-area-inset-top,0px)]"
    >
      {/* Mobile: 72px height, Tablet+: 88px */}
      <div className="h-[72px] md:h-[88px] flex items-center px-4 max-w-[1200px] mx-auto w-full">
        {/* Left slot: hamburger on mobile, app name on tablet+ */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <div className="w-8 h-8 flex items-center justify-center md:hidden">
            {onMenuOpen ? (
              <button
                onClick={onMenuOpen}
                aria-label="Open navigation"
                className="text-white hover:text-white/80"
              >
                <Menu className="h-6 w-6" />
              </button>
            ) : (
              <span className="w-6 h-6" />
            )}
          </div>

          {/* App name — tablet+ only, left-aligned */}
          <span className="hidden md:block text-white font-bold text-2xl tracking-tight">
            CrumbWorks
          </span>
        </div>

        {/* Center: title (mobile only) */}
        <h1 className="flex-1 text-center text-white font-bold text-2xl truncate px-2 md:hidden">
          {title}
        </h1>

        {/* Center: empty on tablet+ (or could show page title) */}
        <div className="hidden md:block flex-1" />

        {/* Right slot: reserved 32px */}
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          {rightSlot || <span className="w-6 h-6" />}
        </div>
      </div>
    </header>
  );
}

import { useState, type ReactNode } from 'react';
import { RvHeader } from './RvHeader';
import { RvNavStrip } from './RvNavStrip';
import { RvDrawer } from './RvDrawer';

type Props = {
  /** Page title (shown in header on mobile) */
  title: string;
  /** Optional right header slot content */
  rightSlot?: ReactNode;
  /** Page content */
  children: ReactNode;
  /** Use full-bleed hero mode (no page bg, no nav strip) */
  heroMode?: boolean;
};

/**
 * RvLayout — Canonical page layout wrapper
 * 
 * LAYOUT STRUCTURE:
 * 
 * Mobile (<768px):
 * ┌─────────────────────────────┐
 * │  RvHeader (72px, gradient)  │  ← hamburger + title
 * ├─────────────────────────────┤
 * │                             │
 * │        Page Content         │  ← bg: rvPageBg
 * │                             │
 * └─────────────────────────────┘
 * + RvDrawer (slide-in 280px)
 * 
 * Tablet+ (≥768px):
 * ┌─────────────────────────────────────────────┐
 * │       RvHeader (88px, full-width)           │  ← "CrumbWorks" left
 * ├─────────────────────────────────────────────┤
 * │       RvNavStrip (56px, rvBlue)             │  ← horizontal nav
 * ├─────────────────────────────────────────────┤
 * │                                             │
 * │           Page Content (max 1200px)         │  ← centered, bg: rvPageBg
 * │                                             │
 * └─────────────────────────────────────────────┘
 * 
 * heroMode: Skips nav strip and page bg (used by Home page)
 */
export function RvLayout({
  title,
  rightSlot,
  children,
  heroMode = false,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-rvPageBg">
      {/* Mobile drawer (hidden on tablet+) */}
      <RvDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header — always visible, full-width */}
      <RvHeader
        title={title}
        onMenuOpen={() => setDrawerOpen(true)}
        rightSlot={rightSlot}
      />

      {/* Nav strip — tablet+ only, skip in heroMode */}
      {!heroMode && <RvNavStrip />}

      {/* Page content */}
      <main
        className={[
          'flex-1 flex flex-col',
          heroMode ? '' : 'bg-rvPageBg',
        ].join(' ')}
      >
        {children}
      </main>
    </div>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const menuItems = [
  { to: '/library', label: 'Recipes' },
  { to: '/settings', label: 'Settings' },
  { to: '/about', label: 'About' },
];

/**
 * CrumbWorks Mobile Navigation Drawer (LOCKED palette)
 * 
 * MOBILE ONLY (<768px): Slide-in drawer triggered by hamburger.
 * On tablet+ (>=768px), navigation is via the horizontal RvNavStrip.
 * 
 * LAYOUT RULES:
 * - Width: 280px
 * - Background: #162841 (rvBlue)
 * - Active item: 6px left bar #E77320 (rvAccent), background rgba(231,115,32,0.12)
 * - Text: white, font-semibold, text-lg (18px)
 */
export function RvDrawer({ open, onClose }: Props) {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      {/* Overlay (mobile only) */}
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
        />
      )}

      {/* Drawer — mobile only, 280px slide-in from left */}
      <aside
        className={[
          'fixed top-0 left-0 h-full bg-rvBlue text-white z-50',
          'w-[280px] transform transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:hidden', // Hide entirely on tablet+ (nav is via RvNavStrip)
          'pt-[env(safe-area-inset-top,0px)]',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">CrumbWorks</h2>
          <button
            aria-label="Close navigation"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Menu items */}
        <nav className="py-2">
          {menuItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={[
                  'relative flex items-center px-4 py-4 text-lg font-semibold',
                  active
                    ? 'bg-[rgba(231,115,32,0.12)]'
                    : 'hover:bg-white/10 focus-visible:bg-white/10',
                ].join(' ')}
              >
                {/* Active indicator bar — uses rvAccent #E77320 */}
                {active && (
                  <span className="absolute left-0 top-0 bottom-0 w-[6px] bg-rvAccent rounded-r" />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

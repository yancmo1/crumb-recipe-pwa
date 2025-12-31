import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/library', label: 'Recipes' },
  { to: '/settings', label: 'Settings' },
  { to: '/about', label: 'About' },
];

/**
 * Horizontal Navigation Strip (LOCKED palette)
 * 
 * Visible on tablet+ (>=768px) only, directly under RvHeader.
 * 
 * LAYOUT RULES:
 * - Height: 56px
 * - Background: #162841 (rvBlue / Vault Blue)
 * - Nav items: horizontal, centered content, full-width strip
 * - Active state: 6px bottom underline (#E77320 / rvAccent), optional pill bg rgba(231,115,32,0.12)
 * - Text: white, font-semibold, text-base
 */
export function RvNavStrip() {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav
      className="hidden md:block w-full bg-rvBlue"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="h-[56px] flex items-center justify-start gap-1 px-4 max-w-[1200px] mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                'relative h-full flex items-center px-5 text-base font-semibold text-white transition-colors',
                active
                  ? 'bg-[rgba(231,115,32,0.12)]'
                  : 'hover:bg-white/10 focus-visible:bg-white/10',
              ].join(' ')}
            >
              {item.label}
              {/* Active underline indicator */}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-[6px] bg-rvAccent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

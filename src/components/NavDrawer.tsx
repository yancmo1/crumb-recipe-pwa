import { Link, useLocation } from 'react-router-dom';
import { X, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Navigation Drawer / Sidebar
 * - Slides from left
 * - Background: rvBlue (#2C3E50)
 * - Items: Recipes, Settings, About
 */
export function NavDrawer() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Close drawer on route change
    setOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Toggle button (hamburger) */}
      <button
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center p-2 text-white/90 hover:text-white"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Overlay */}
      {open && (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/30"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'} bg-rvBlue text-white z-50 safe-top`}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-semibold">CrumbWorks</h2>
          <button
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="p-2 text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="px-2 py-2">
          <Link to="/library" className="block px-3 py-2 rounded hover:bg-white/10 focus-visible:bg-white/10">
            Recipes
          </Link>
          <Link to="/settings" className="block px-3 py-2 rounded hover:bg-white/10 focus-visible:bg-white/10">
            Settings
          </Link>
          <Link to="/about" className="block px-3 py-2 rounded hover:bg-white/10 focus-visible:bg-white/10">
            About
          </Link>
        </nav>
      </aside>
    </>
  );
}

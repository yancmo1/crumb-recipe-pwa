import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Star, Search, Menu, Clock, Users, Trash2 } from 'lucide-react';
import { RvLayout } from '../components/RvLayout';
import { RvNavStrip } from '../components/RvNavStrip';
import { RvDrawer } from '../components/RvDrawer';

/**
 * Style Guide / Design Proof Page (dev-only)
 * 
 * Screenshots from this page at specific breakpoints serve as proof of:
 * - Palette correctness
 * - Gradient correctness
 * - Component hierarchy
 * - Card/button elevation
 * - Layout stability with placeholder thumbnails
 * - Full-width header (tablet+)
 * - Under-header nav strip (tablet+)
 * - Mobile drawer (mobile)
 * 
 * Required screenshot breakpoints:
 * - Mobile: 390×844
 * - Tablet: 768×1024
 * - Tablet landscape: 1024×768
 * - Desktop: 1440×900
 */
export default function StyleGuide() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <RvLayout title="Style Guide">
      {/* Content area */}
      <div className="flex-1 px-4 md:px-6 py-5 max-w-[1200px] mx-auto w-full space-y-8">
        
        {/* Layout Overview Section */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Layout Architecture</h2>
          <div className="space-y-4 text-sm text-rvGray">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Mobile (&lt;768px)</h3>
              <ul className="space-y-1 text-rvGray/70">
                <li>• Header: 72px, gradient, hamburger left, title center</li>
                <li>• No nav strip (uses slide-in drawer)</li>
                <li>• Drawer: 280px width, rvBlue bg</li>
                <li>• Content: single column</li>
              </ul>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Tablet+ (≥768px)</h3>
              <ul className="space-y-1 text-rvGray/70">
                <li>• Header: 88px, gradient, "CrumbWorks" left</li>
                <li>• Nav strip: 56px, rvBlue bg, horizontal items</li>
                <li>• Active state: 6px underline + pill bg</li>
                <li>• Content: max 1200px, centered</li>
                <li>• No drawer (nav is in strip)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Mobile Drawer Demo */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Mobile Drawer (Demo)</h2>
          <p className="text-sm text-rvGray/70 mb-4">
            Click the button to open the mobile drawer. On tablet+ this drawer is hidden (navigation is via the nav strip above).
          </p>
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="px-4 py-2 bg-rvBlue text-white rounded-lg hover:bg-rvBlue/90 transition-colors md:hidden"
          >
            Open Drawer (Mobile Only)
          </button>
          <p className="hidden md:block text-sm text-rvGray/50 italic">
            Drawer demo is only available on mobile. Resize to &lt;768px to test.
          </p>
          <RvDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />
        </section>

        {/* Nav Strip Demo */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Nav Strip (Tablet+)</h2>
          <p className="text-sm text-rvGray/70 mb-4">
            The horizontal navigation strip appears directly under the header on tablet+ screens.
            It shows the active page with a 6px underline accent.
          </p>
          <div className="rounded-lg overflow-hidden border border-rvGray/10">
            <RvNavStrip />
          </div>
          <p className="md:hidden text-sm text-rvGray/50 italic mt-2">
            Nav strip preview is hidden on mobile. Resize to ≥768px to see.
          </p>
        </section>

        {/* Color Palette Section */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">LOCKED Color Palette</h2>
          
          {/* Header Gradient */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-rvGray mb-2">Header Gradient (top → bottom)</h3>
            <div className="h-16 rv-header-gradient rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">#CB3002 → #F85F1E → #E77320</span>
            </div>
          </div>

          {/* CTA Gradient */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-rvGray mb-2">CTA Gradient (left → right)</h3>
            <div className="h-14 rv-cta-gradient rv-cta-shadow rounded-full flex items-center justify-center">
              <span className="text-white font-bold">#F85F1E → #CB3002</span>
            </div>
          </div>

          {/* Color Swatches */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-16 rounded-xl bg-[#162841] flex items-center justify-center">
                <span className="text-white text-xs font-mono">#162841</span>
              </div>
              <p className="text-xs text-rvGray text-center">Sidebar/NavStrip (rvBlue)</p>
            </div>
            
            <div className="space-y-2">
              <div className="h-16 rounded-xl bg-rvPageBg border border-rvGray/20 flex items-center justify-center">
                <span className="text-rvGray text-xs font-mono">#F7F3EE</span>
              </div>
              <p className="text-xs text-rvGray text-center">Page Bg (rvPageBg)</p>
            </div>
            
            <div className="space-y-2">
              <div className="h-16 rounded-xl bg-rvGray flex items-center justify-center">
                <span className="text-white text-xs font-mono">#53575E</span>
              </div>
              <p className="text-xs text-rvGray text-center">Text Gray (rvGray)</p>
            </div>
            
            <div className="space-y-2">
              <div className="h-16 rounded-xl bg-rvAccent flex items-center justify-center">
                <span className="text-white text-xs font-mono">#E77320</span>
              </div>
              <p className="text-xs text-rvGray text-center">Accent (rvAccent)</p>
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Typography</h2>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-rvGray">Heading 1 — Bold 30px</h1>
            <h2 className="text-2xl font-bold text-rvGray">Heading 2 — Bold 24px</h2>
            <h3 className="text-xl font-semibold text-rvGray">Heading 3 — SemiBold 20px</h3>
            <h4 className="text-lg font-semibold text-rvGray">Heading 4 — SemiBold 18px</h4>
            <p className="text-base text-rvGray">Body text — Regular 16px. The quick brown fox jumps over the lazy dog.</p>
            <p className="text-sm text-rvGray/70">Secondary text — Regular 14px, muted. Recipe metadata, timestamps, hints.</p>
          </div>
        </section>

        {/* Buttons Section */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Buttons</h2>
          
          <div className="flex flex-wrap gap-4 items-center">
            {/* Primary CTA */}
            <button className="h-14 px-10 rv-cta-gradient rv-cta-shadow text-white font-bold rounded-full hover:opacity-95 transition-opacity">
              Primary CTA
            </button>
            
            {/* Secondary */}
            <button className="px-6 py-3 bg-rvCardBg text-rvGray font-semibold rounded-xl shadow-rv-card hover:bg-gray-50 transition-colors">
              Secondary
            </button>
            
            {/* Icon Button */}
            <button aria-label="Add recipe" className="p-4 rv-cta-gradient rv-cta-shadow text-white rounded-full hover:opacity-95 transition-opacity">
              <Plus className="h-6 w-6" />
            </button>
            
            {/* Ghost */}
            <button className="px-4 py-2 text-rvAccent font-semibold hover:bg-rvAccent/10 rounded-lg transition-colors">
              Ghost Button
            </button>
          </div>
        </section>

        {/* Cards Section */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Recipe Cards</h2>
          <p className="text-sm text-rvGray/70 mb-4">Cards: #FFFFFF, 12px radius (rounded-xl), 16px padding, subtle shadow</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card with Image */}
            <div className="bg-rvCardBg rounded-xl shadow-rv-card p-4 relative group">
              <div className="w-full h-[140px] rv-thumb-placeholder rounded-lg mb-4" />
              <h3 className="font-bold text-xl text-rvGray truncate pr-16 mb-1">
                Classic Sourdough Bread
              </h3>
              <p className="text-sm text-rvGray/70 truncate">
                Flour, Water, Salt, Starter
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-rvGray/60">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Serves 8</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 45 min</span>
              </div>
              <button aria-label="Favorite" className="absolute top-4 right-12 p-2 text-rvAccent">
                <Star className="h-5 w-5" fill="currentColor" />
              </button>
              <button aria-label="Delete" className="absolute top-4 right-4 p-2 text-rvGray/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            
            {/* Card without Image */}
            <div className="bg-rvCardBg rounded-xl shadow-rv-card p-4 relative group">
              <div className="w-full h-[140px] bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-gray-400 text-sm">No image</span>
              </div>
              <h3 className="font-bold text-xl text-rvGray truncate pr-16 mb-1">
                Chocolate Chip Cookies
              </h3>
              <p className="text-sm text-rvGray/70 truncate">
                Butter, Sugar, Flour, Chocolate
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-rvGray/60">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Makes 24</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 25 min</span>
              </div>
              <button aria-label="Favorite" className="absolute top-4 right-12 p-2 text-rvGray/40 hover:text-rvAccent">
                <Star className="h-5 w-5" />
              </button>
              <button aria-label="Delete" className="absolute top-4 right-4 p-2 text-rvGray/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            {/* Third card for 3-column demo on desktop */}
            <div className="bg-rvCardBg rounded-xl shadow-rv-card p-4 relative group">
              <div className="w-full h-[140px] rv-thumb-placeholder rounded-lg mb-4" />
              <h3 className="font-bold text-xl text-rvGray truncate pr-16 mb-1">
                Homemade Pasta
              </h3>
              <p className="text-sm text-rvGray/70 truncate">
                Flour, Eggs, Olive Oil, Salt
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-rvGray/60">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Serves 4</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 60 min</span>
              </div>
              <button aria-label="Favorite" className="absolute top-4 right-12 p-2 text-rvGray/40 hover:text-rvAccent">
                <Star className="h-5 w-5" />
              </button>
              <button aria-label="Delete" className="absolute top-4 right-4 p-2 text-rvGray/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        {/* Form Elements Section */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Form Elements</h2>
          
          <div className="space-y-4 max-w-md">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-rvGray/50 h-5 w-5" />
              <input
                type="text"
                placeholder="Search recipes..."
                className="w-full pl-12 pr-4 py-3 bg-rvInputBg border border-rvGray/20 rounded-xl focus:ring-2 focus:ring-rvAccent/30 focus:border-rvAccent text-base text-rvGray"
              />
            </div>
            
            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium text-rvGray mb-2">Recipe URL</label>
              <input
                type="text"
                placeholder="https://example.com/recipe"
                className="w-full px-4 py-3 bg-rvInputBg border border-rvGray/20 rounded-xl focus:ring-2 focus:ring-rvAccent/30 focus:border-rvAccent text-base text-rvGray"
              />
            </div>
            
            {/* Select */}
            <div>
              <label className="block text-sm font-medium text-rvGray mb-2">Category</label>
              <select aria-label="Category" className="w-full px-4 py-3 bg-rvInputBg border border-rvGray/20 rounded-xl focus:ring-2 focus:ring-rvAccent/30 focus:border-rvAccent text-base text-rvGray">
                <option>All categories</option>
                <option>Breakfast</option>
                <option>Dinner</option>
                <option>Desserts</option>
              </select>
            </div>
          </div>
        </section>

        {/* Header Variants Section */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Header Variants</h2>
          
          <div className="space-y-4">
            {/* Mobile: With Hamburger */}
            <div>
              <p className="text-sm text-rvGray/70 mb-2">Mobile (72px, hamburger + title)</p>
              <div className="rounded-xl overflow-hidden">
                <div className="rv-header-gradient h-[72px] flex items-center px-4">
                  <button aria-label="Open menu" className="w-8 h-8 flex items-center justify-center text-white">
                    <Menu className="h-6 w-6" />
                  </button>
                  <h1 className="flex-1 text-center text-white font-bold text-2xl">Recipes</h1>
                  <div className="w-8 h-8" />
                </div>
              </div>
            </div>
            
            {/* Tablet+: With App Name */}
            <div>
              <p className="text-sm text-rvGray/70 mb-2">Tablet+ (88px, "CrumbWorks" left)</p>
              <div className="rounded-xl overflow-hidden">
                <div className="rv-header-gradient h-[88px] flex items-center px-4">
                  <span className="text-white font-bold text-2xl tracking-tight">CrumbWorks</span>
                  <div className="flex-1" />
                  <div className="w-8 h-8" />
                </div>
              </div>
            </div>
            
          </div>
        </section>

        {/* Layout Breakpoints Info */}
        <section className="bg-rvCardBg rounded-xl shadow-rv-card p-4">
          <h2 className="text-xl font-bold text-rvGray mb-4">Layout Breakpoints</h2>
          <div className="text-sm text-rvGray space-y-2">
            <p><strong>Mobile:</strong> width &lt; 768px — Hamburger → drawer, 1-column grid</p>
            <p><strong>Tablet:</strong> width ≥ 768px — Nav strip under header, 2-column grid</p>
            <p><strong>Desktop:</strong> width ≥ 1024px — Nav strip under header, 3-column grid (if space)</p>
            <p><strong>Content max:</strong> 1200px centered</p>
          </div>
        </section>

        {/* Navigation back to app */}
        <div className="text-center pb-8">
          <Link
            to="/library"
            className="inline-flex items-center justify-center h-12 px-6 rv-cta-gradient rv-cta-shadow text-white font-bold rounded-full hover:opacity-95 transition-opacity"
          >
            Back to App →
          </Link>
        </div>
      </div>
    </RvLayout>
  );
}

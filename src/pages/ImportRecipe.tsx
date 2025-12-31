import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRecipeStore } from '../state/session';
import { db } from '../db';
import { RvLayout } from '../components/RvLayout';
import { normalizeRecipeUrl } from '../utils/url';

export default function ImportRecipe() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const addRecipe = useRecipeStore((state) => state.addRecipe);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeRecipeUrl(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || 'Please enter a valid URL');
      return;
    }

    setIsLoading(true);

    try {
      const recipe = await db.importRecipe(normalizedUrl);
      await addRecipe(recipe);
      toast.success('Recipe imported!');
      navigate(`/recipe/${recipe.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Import error:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      toast.error(message || 'Failed to import recipe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RvLayout title="Import">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5">
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <div className="flex items-center space-x-2 mb-4">
            <Link2 className="h-5 w-5 text-rvOrange" />
            <h2 className="text-lg font-semibold text-rvGray">Recipe URL</h2>
          </div>
          
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-rvGray mb-2">
                Paste the recipe URL here
              </label>
              <input
                id="url"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://example.com/recipe"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-3 bg-rvInputBg border border-rvGray/20 rounded-lg focus:ring-2 focus:ring-rvOrange/30 focus:border-rvOrange text-rvGray"
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 rv-cta-gradient rv-cta-shadow text-white font-bold rounded-full hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Importing...</span>
                </div>
              ) : (
                'Import Recipe'
              )}
            </button>
          </form>
          
          <div className="mt-6 p-4 bg-rvInputBg rounded-xl border border-rvGray/10">
            <h3 className="text-sm font-semibold text-rvGray mb-2">Supported sites</h3>
            <ul className="text-sm text-rvGray/70 space-y-1">
              <li>• Any site with JSON-LD recipe markup</li>
              <li>• Popular cooking sites (AllRecipes, Food Network, etc.)</li>
              <li>• Recipe blogs with structured data</li>
            </ul>
          </div>
        </div>
      </div>
    </RvLayout>
  );
}
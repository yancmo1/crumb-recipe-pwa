import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRecipeStore } from '../state/session';

export default function ImportRecipe() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const addRecipe = useRecipeStore((state) => state.addRecipe);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(),
          saveToServer: true 
        }),
      });

      const data = await response.json();

      if (data.success && data.recipe) {
        await addRecipe(data.recipe);
        toast.success('Recipe imported and saved to server!');
        navigate(`/recipe/${data.recipe.id}`);
      } else {
        toast.error(data.error || 'Failed to import recipe');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import recipe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-oatmeal">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Import Recipe</h1>
          </div>
        </div>
      </header>

      <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <Link2 className="h-5 w-5 text-blueberry" />
            <h2 className="text-lg font-semibold text-gray-900">Recipe URL</h2>
          </div>
          
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Paste the recipe URL here
              </label>
              <input
                id="url"
                type="url"
                placeholder="https://example.com/recipe"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry focus:border-transparent"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blueberry text-white py-3 rounded-lg hover:bg-blueberry/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          
          <div className="mt-6 p-4 bg-sage/10 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Supported sites:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Any site with JSON-LD recipe markup</li>
              <li>• Popular cooking sites (AllRecipes, Food Network, etc.)</li>
              <li>• Recipe blogs with structured data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
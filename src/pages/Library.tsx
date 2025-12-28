import { useMemo, useState } from 'react';
import { useRecipeStore } from '../state/session';
import { Link } from 'react-router-dom';
import { Plus, Search, ChefHat, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { IosNavBar } from '../components/IosNavBar';
import { createSampleRecipe } from '../utils/sampleRecipe';

export default function Library() {
  const { recipes, searchQuery, searchRecipes, getFilteredRecipes, isLoading, deleteRecipe, updateRecipe, addRecipe } = useRecipeStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const filteredRecipes = getFilteredRecipes();

  const availableCategories = useMemo(() => {
    const defaults = ['Breakfast', 'Dinner', 'Desserts', 'Drinks'];
    const fromRecipes = recipes
      .map((r) => (typeof r.category === 'string' ? r.category.trim() : ''))
      .filter((c) => c.length > 0);
    const all = [...defaults, ...customCategories, ...fromRecipes];
    const uniq = Array.from(new Set(all));
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [recipes, customCategories]);

  const visibleRecipes = useMemo(() => {
    if (selectedCategory === 'All') return filteredRecipes;
    return filteredRecipes.filter((r) => (r.category || '').trim() === selectedCategory);
  }, [filteredRecipes, selectedCategory]);

  const handleSearch = (query: string) => {
    setLocalQuery(query);
    searchRecipes(query);
  };

  const handleDelete = async (e: React.MouseEvent, recipeId: string, recipeTitle: string) => {
    e.preventDefault(); // Prevent navigation to recipe detail
    e.stopPropagation();
    
    if (confirm(`Are you sure you want to delete "${recipeTitle}"? This action cannot be undone.`)) {
      try {
        await deleteRecipe(recipeId);
        toast.success('Recipe deleted successfully');
      } catch (error) {
        toast.error('Failed to delete recipe');
      }
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, recipeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    try {
      await updateRecipe({
        ...recipe,
        isFavorite: !recipe.isFavorite,
        updatedAt: Date.now()
      });
    } catch (error) {
      toast.error('Failed to update favorite');
    }
  };

  const handleAddCategory = () => {
    const name = prompt('New category name (e.g., Lunch):');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSelectedCategory(trimmed);
  };

  return (
    <div className="min-h-screen ios-page">
      <IosNavBar
        title="Crumb"
        right={
          <Link to="/settings" className="text-blueberry font-medium">
            Settings
          </Link>
        }
      />

      <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-5">
        {/* Search */}
        <div className="relative mb-4 ios-card px-3 py-2">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search"
            value={localQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-transparent border-0 focus:ring-0 focus:outline-none text-[17px]"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-5 ios-card p-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blueberry/20 focus:border-blueberry/30 bg-white/80 text-gray-900"
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddCategory}
            className="px-3 py-3 bg-gray-100/80 text-gray-700 rounded-xl hover:bg-gray-200/80 transition-colors"
            title="Add a new category"
          >
            +
          </button>
        </div>

        {/* Recipe List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="ios-card p-4 animate-pulse">
                <div className="flex space-x-4">
                  <div className="w-16 h-16 bg-gray-300 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : visibleRecipes.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {searchQuery ? 'No recipes found' : 'No recipes yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery 
                ? 'Try searching with different keywords'
                : 'Import your first recipe to get started'
              }
            </p>
            {!searchQuery && (
              <div className="flex flex-col items-center gap-3">
                <Link
                  to="/import"
                  className="inline-flex items-center px-6 py-3 bg-blueberry text-white rounded-lg hover:bg-blueberry/90 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Import Recipe
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const recipe = createSampleRecipe();
                      await addRecipe(recipe);
                      toast.success('Sample recipe added');
                    } catch {
                      toast.error('Failed to add sample recipe');
                    }
                  }}
                  className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Add sample recipe
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="ios-card p-4 transition-shadow relative group"
              >
                <Link
                  to={`/recipe/${recipe.id}`}
                  className="block"
                >
                  <div className="flex space-x-4">
                    {recipe.image ? (
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-dough rounded-lg flex items-center justify-center">
                        <ChefHat className="h-8 w-8 text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate pr-8">
                        {recipe.title}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">
                        {recipe.sourceName || 'Unknown Source'}
                      </p>
                      {recipe.category && recipe.category.trim() && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                            {recipe.category.trim()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                        {recipe.yield && (
                          <span>Serves {recipe.yield}</span>
                        )}
                        {recipe.times?.total && (
                          <span>{recipe.times.total} min</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Favorite button */}
                <button
                  onClick={(e) => handleToggleFavorite(e, recipe.id)}
                  className={`absolute top-4 right-10 p-1 rounded transition-colors ${
                    recipe.isFavorite
                      ? 'text-yellow-500 hover:text-yellow-600'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                  title={recipe.isFavorite ? 'Unfavorite' : 'Favorite'}
                >
                  <Star className="h-4 w-4" fill={recipe.isFavorite ? 'currentColor' : 'none'} />
                </button>
                
                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, recipe.id, recipe.title)}
                  className="absolute top-4 right-4 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete recipe"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Floating Action Button */}
        <Link
          to="/import"
          className="fixed bg-blueberry text-white p-4 rounded-full shadow-lg hover:bg-blueberry/90 transition-colors bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))]"
        >
          <Plus className="h-6 w-6" />
        </Link>
      </div>
    </div>
  );
}
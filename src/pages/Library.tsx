import { useMemo, useState } from 'react';
import { useRecipeStore } from '../state/session';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { RvLayout } from '../components/RvLayout';
import { createSampleRecipe } from '../utils/sampleRecipe';

/**
 * Recipe List screen (deterministic per spec §15)
 * - Mobile: single column list
 * - Tablet+ (md:768px): 2-column grid
 * - Desktop (lg:1024px): 3-column grid if space allows
 * - Cards: 12px radius, shadow, 140px thumbnail (or placeholder gradient)
 */
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
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${recipeTitle}"? This action cannot be undone.`)) {
      try {
        await deleteRecipe(recipeId);
        toast.success('Recipe deleted successfully');
      } catch {
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
      await updateRecipe({ ...recipe, isFavorite: !recipe.isFavorite, updatedAt: Date.now() });
    } catch {
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
    <RvLayout title="Recipes">
      {/* Content area */}
      <div className="flex-1 px-4 md:px-6 py-5 max-w-[1200px] mx-auto w-full">
        {/* Search */}
        <div className="relative mb-4 bg-white rounded-xl shadow-rv-card px-4 py-3">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-rvGray/50 h-5 w-5" />
          <input
            type="text"
            placeholder="Search"
            value={localQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border-0 focus:ring-0 focus:outline-none text-base text-rvGray"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-5 bg-white rounded-xl shadow-rv-card p-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 px-3 py-2 border border-rvGray/20 rounded-lg focus:ring-2 focus:ring-rvOrange/30 focus:border-rvOrange bg-rvInputBg text-rvGray"
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddCategory}
            className="px-3 py-2 bg-rvInputBg text-rvGray rounded-lg hover:bg-gray-200 transition-colors"
            title="Add a new category"
          >
            +
          </button>
        </div>

        {/* Recipe grid/list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-rv-card p-4 animate-pulse">
                <div className="h-[140px] bg-gray-200 rounded-lg mb-4" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : visibleRecipes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rv-thumb-placeholder rounded-xl flex items-center justify-center">
              <Plus className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-rvGray mb-2">
              {searchQuery ? 'No recipes found' : 'No recipes yet'}
            </h3>
            <p className="text-rvGray/70 mb-6">
              {searchQuery ? 'Try searching with different keywords' : 'Import your first recipe to get started'}
            </p>
            {!searchQuery && (
              <div className="flex flex-col items-center gap-3">
                <Link
                  to="/import"
                  className="inline-flex items-center justify-center h-12 px-6 rv-cta-gradient rv-cta-shadow text-white font-bold rounded-full hover:opacity-95 transition-opacity"
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
                  className="inline-flex items-center px-6 py-3 bg-white text-rvGray rounded-lg shadow-rv-card hover:bg-gray-50 transition-colors"
                >
                  Add sample recipe
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleRecipes.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipe/${recipe.id}`}
                className="block bg-white rounded-xl shadow-rv-card p-4 relative group hover:shadow-lg transition-shadow"
              >
                {/* Thumbnail */}
                {recipe.image ? (
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full h-[140px] object-cover rounded-lg mb-4"
                  />
                ) : (
                  <div className="w-full h-[140px] rv-thumb-placeholder rounded-lg mb-4" />
                )}

                {/* Title */}
                <h3 className="font-bold text-xl text-rvGray truncate pr-16 mb-1">
                  {recipe.title}
                </h3>

                {/* Ingredient snippet */}
                {recipe.ingredients.length > 0 && (
                  <p className="text-sm text-rvGray/70 truncate">
                    {recipe.ingredients.slice(0, 3).map((i) => i.item || i.raw).join(', ')}
                  </p>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-3 mt-2 text-xs text-rvGray/60">
                  {recipe.yield && <span>Serves {recipe.yield}</span>}
                  {recipe.times?.total && <span>{recipe.times.total} min</span>}
                </div>

                {/* Favorite button */}
                <button
                  onClick={(e) => handleToggleFavorite(e, recipe.id)}
                  className={`absolute top-4 right-12 p-2 rounded-lg transition-colors ${
                    recipe.isFavorite ? 'text-rvYellow' : 'text-rvGray/40 hover:text-rvGray/60'
                  }`}
                  title={recipe.isFavorite ? 'Unfavorite' : 'Favorite'}
                >
                  <Star className="h-5 w-5" fill={recipe.isFavorite ? 'currentColor' : 'none'} />
                </button>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, recipe.id, recipe.title)}
                  className="absolute top-4 right-4 p-2 text-rvGray/40 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete recipe"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </Link>
            ))}
          </div>
        )}

        {/* Floating Action Button */}
        <Link
          to="/import"
          className="fixed rv-cta-gradient rv-cta-shadow text-white p-4 rounded-full hover:opacity-95 transition-opacity bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))]"
        >
          <Plus className="h-6 w-6" />
        </Link>
      </div>
    </RvLayout>
  );
}
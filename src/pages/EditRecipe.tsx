import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RvLayout } from '../components/RvLayout';
import { useRecipeStore } from '../state/session';
import type { Recipe, IngredientToken } from '../types';
import { toast } from 'sonner';

function parseIngredients(input: string): IngredientToken[] {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((raw) => ({
    raw,
    isGroupHeader: /^\*\*[^*]+:\*\*$/.test(raw)
  }));
}

function parseSteps(input: string): string[] {
  return input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export default function EditRecipe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipes, updateRecipe } = useRecipeStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');

  useEffect(() => {
    if (!id) return;
    const found = recipes.find((r) => r.id === id);
    if (!found) {
      navigate('/library', { replace: true });
      return;
    }
    setRecipe(found);
    setTitle(found.title);
    setCategory(found.category || '');
    setTagsText((found.tags || []).join(', '));
    setIngredientsText(found.ingredients.map((i) => i.raw).join('\n'));
    setStepsText((found.steps || []).join('\n'));
  }, [id, recipes, navigate]);

  const handleSave = async () => {
    if (!recipe) return;
    const next: Recipe = {
      ...recipe,
      title: title.trim() || recipe.title,
      category: category.trim() || undefined,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      ingredients: parseIngredients(ingredientsText),
      steps: parseSteps(stepsText),
      updatedAt: Date.now()
    };
    try {
      await updateRecipe(next);
      toast.success('Recipe saved');
      navigate(`/recipe/${recipe.id}`);
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  if (!recipe) {
    return null;
  }

  return (
    <RvLayout title="Edit Recipe">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5 space-y-5">
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <label className="block text-sm font-medium text-rvGray mb-1">Recipe Name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-3 bg-rvInputBg border border-rvGray/20 rounded-lg focus:ring-2 focus:ring-rvOrange/30 focus:border-rvOrange text-rvGray"
            placeholder="e.g., Sourdough Bread"
          />
        </div>

        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <label className="block text-sm font-medium text-rvGray mb-1">Ingredients</label>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={8}
            className="w-full px-3 py-3 bg-rvInputBg border border-rvGray/20 rounded-lg focus:ring-2 focus:ring-rvOrange/30 focus:border-rvOrange text-rvGray resize-y"
            placeholder="One per line. Use **Group Name:** for section headers."
          />
        </div>

        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <label className="block text-sm font-medium text-rvGray mb-1">Steps</label>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={8}
            className="w-full px-3 py-3 bg-rvInputBg border border-rvGray/20 rounded-lg focus:ring-2 focus:ring-rvOrange/30 focus:border-rvOrange text-rvGray resize-y"
            placeholder="One step per line"
          />
        </div>

        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <label className="block text-sm font-medium text-rvGray mb-1">Tags / Categories</label>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            className="w-full px-3 py-3 bg-rvInputBg border border-rvGray/20 rounded-lg focus:ring-2 focus:ring-rvOrange/30 focus:border-rvOrange text-rvGray"
            placeholder="Comma-separated, e.g., bread, starter, weekend"
          />
        </div>
      </div>

      {/* Sticky Save */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 no-print safe-bottom">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto">
          <button
            onClick={handleSave}
            className="w-full h-14 rv-cta-gradient rv-cta-shadow rounded-full text-white font-bold hover:opacity-95 transition-opacity"
          >
            Save Recipe
          </button>
        </div>
      </div>
      <div className="h-20 no-print" />
    </RvLayout>
  );
}

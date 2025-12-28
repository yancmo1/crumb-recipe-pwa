import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Users, Printer, RotateCcw, Plus, Minus, Trash2, Scale, Camera, Upload, Edit3, Check, X, ExternalLink, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useRecipeStore, useCookSession, useSettings } from '../state/session';
import { scaleIngredients, formatFraction, getMultiplierOptions, getIngredientDisplayAmount } from '../utils/scale';
import { isConvertibleToGrams } from '../utils/conversions';
import { FloatingStepTimer } from '../components/FloatingStepTimer';
import { IosNavBar } from '../components/IosNavBar';
import type { Recipe } from '../types';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipes, deleteRecipe, updateRecipe } = useRecipeStore();
  const { preferGrams, setPreferGrams } = useSettings();
  const { 
    currentSession, 
    loadSession, 
    createNewSession,
    toggleIngredient,
    toggleStep,
    setMultiplier,
    resetSession,
    getTimeRemaining
  } = useCookSession();
  
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [currentMultiplier, setCurrentMultiplier] = useState(1); // Local multiplier state
  const [selectedMultiplier, setSelectedMultiplier] = useState('1');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMultiplier, setCustomMultiplier] = useState('1');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableCategories = useMemo(() => {
    const defaults = ['Breakfast', 'Dinner', 'Desserts', 'Drinks'];
    const fromRecipes = recipes
      .map((r) => (typeof r.category === 'string' ? r.category.trim() : ''))
      .filter((c) => c.length > 0);
    const all = [...defaults, ...fromRecipes];
    const uniq = Array.from(new Set(all));
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const isStepGroupHeader = (step: string) => /^\*\*[^*]+:\*\*$/.test(step.trim());
  const formatStepGroupHeader = (step: string) => step.replace(/\*\*/g, '').replace(/:\s*$/, '').trim();

  const currentStepIndex = useMemo(() => {
    if (!recipe) return 0;
    const checked = currentSession?.checkedSteps || {};
    for (let i = 0; i < recipe.steps.length; i += 1) {
      const s = recipe.steps[i];
      if (isStepGroupHeader(s)) continue;
      if (!checked[i]) return i;
    }
    // If all are checked, fall back to the last non-header step.
    for (let i = recipe.steps.length - 1; i >= 0; i -= 1) {
      if (!isStepGroupHeader(recipe.steps[i])) return i;
    }
    return 0;
  }, [recipe, currentSession?.checkedSteps]);

  useEffect(() => {
    if (id) {
      const foundRecipe = recipes.find(r => r.id === id);
      if (foundRecipe) {
        setRecipe(foundRecipe);
        loadSession(id);
      } else {
        navigate('/');
      }
    }
  }, [id, recipes, navigate, loadSession]);

  // Sync local multiplier with session multiplier
  useEffect(() => {
    if (currentSession?.multiplier) {
      setCurrentMultiplier(currentSession.multiplier);
    }
  }, [currentSession?.multiplier]);

  // Sync notes with recipe
  useEffect(() => {
    if (recipe) {
      setNotesText(recipe.notes || '');
    }
  }, [recipe]);

  if (!recipe) {
    return (
      <div className="min-h-screen bg-oatmeal flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blueberry border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recipe...</p>
        </div>
      </div>
    );
  }

  // Use local multiplier, fallback to session multiplier
  const multiplier = currentMultiplier || currentSession?.multiplier || 1;
  const timeRemaining = getTimeRemaining();
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  // Check if any ingredients can be converted to grams
  const hasConvertibleIngredients = recipe.ingredients.some(ingredient => 
    isConvertibleToGrams(ingredient)
  );

  // Only enable grams mode when it can actually do something.
  const showGrams = preferGrams && hasConvertibleIngredients;

  const scaledIngredients = scaleIngredients(recipe.ingredients, multiplier, showGrams);

  const sourceHost = (() => {
    try {
      return new URL(recipe.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  })();

  const handleStartSession = () => {
    if (id) {
      createNewSession(id);
      // Sync the current multiplier to the new session
      if (currentMultiplier !== 1) {
        setTimeout(() => setMultiplier(currentMultiplier), 100);
      }
    }
    toast.success('Cooking session started!');
  };

  const handleResetSession = () => {
    resetSession();
    toast.success('Session reset!');
  };

  const handleMultiplierChange = (newMultiplier: number | string) => {
    if (newMultiplier === 'custom') {
      setShowCustomInput(true);
      return;
    }
    
    const multiplierValue = typeof newMultiplier === 'string' ? parseFloat(newMultiplier) : newMultiplier;
    if (!isNaN(multiplierValue) && multiplierValue > 0) {
      setCurrentMultiplier(multiplierValue);
      // Also update session if active
      if (currentSession) {
        setMultiplier(multiplierValue);
      }
      setShowCustomInput(false);
    }
  };

  const handleCustomMultiplier = () => {
    const value = parseFloat(customMultiplier);
    if (!isNaN(value) && value > 0) {
      handleMultiplierChange(value);
    } else {
      toast.error('Please enter a valid number');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (!recipe || !id) return;
    
    if (confirm(`Are you sure you want to delete "${recipe.title}"? This action cannot be undone.`)) {
      try {
        await deleteRecipe(id);
        toast.success('Recipe deleted successfully');
        navigate('/');
      } catch (error) {
        toast.error('Failed to delete recipe');
      }
    }
  };

  const handleToggleFavorite = async () => {
    if (!recipe) return;

    const updatedRecipe = {
      ...recipe,
      isFavorite: !recipe.isFavorite,
      updatedAt: Date.now()
    };

    try {
      await updateRecipe(updatedRecipe);
      setRecipe(updatedRecipe);
    } catch (error) {
      toast.error('Failed to update favorite');
    }
  };

  const handleSetCategory = async (categoryValue: string) => {
    if (!recipe) return;
    const nextCategory = categoryValue.trim();
    const updatedRecipe = {
      ...recipe,
      category: nextCategory.length ? nextCategory : undefined,
      updatedAt: Date.now()
    };

    try {
      await updateRecipe(updatedRecipe);
      setRecipe(updatedRecipe);
      toast.success('Category updated');
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const handleAddNewCategory = async () => {
    const name = prompt('New category name (e.g., Lunch):');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    await handleSetCategory(trimmed);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !recipe) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      // Convert image to base64 data URL for local storage
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageDataUrl = e.target?.result as string;
        
        // Update recipe with new image
        const updatedRecipe = {
          ...recipe,
          image: imageDataUrl,
          updatedAt: Date.now()
        };

        await updateRecipe(updatedRecipe);
        setRecipe(updatedRecipe);
        toast.success('Photo updated successfully!');
        setIsUploadingPhoto(false);
      };

      reader.onerror = () => {
        toast.error('Failed to read image file');
        setIsUploadingPhoto(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error('Failed to upload photo');
      setIsUploadingPhoto(false);
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerPhotoUpload = () => {
    fileInputRef.current?.click();
  };

  const handleUpdateNotes = async () => {
    if (!recipe) return;

    try {
      await updateRecipe({
        ...recipe,
        notes: notesText.trim() || undefined
      });
      setIsEditingNotes(false);
      toast.success('Notes updated');
    } catch (error) {
      toast.error('Failed to update notes');
    }
  };

  return (
    <div className="min-h-screen ios-page">
      <IosNavBar
        className="no-print"
        title={recipe?.title || 'Recipe'}
        left={
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 text-blueberry font-medium"
            aria-label="Back to library"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[17px]">Library</span>
          </button>
        }
        right={
          recipe ? (
            <div className="flex items-center gap-1 -mr-2">
              <button
                onClick={handleToggleFavorite}
                className={
                  recipe.isFavorite
                    ? 'text-yellow-500 hover:text-yellow-600 p-2'
                    : 'text-gray-500 hover:text-gray-800 p-2'
                }
                title={recipe.isFavorite ? 'Unfavorite' : 'Favorite'}
                aria-label={recipe.isFavorite ? 'Unfavorite recipe' : 'Favorite recipe'}
              >
                <Star className="h-5 w-5" fill={recipe.isFavorite ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={handleDelete}
                className="text-gray-500 hover:text-red-600 p-2"
                title="Delete recipe"
                aria-label="Delete recipe"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ) : null
        }
      />

      {/* Session Status */}
      {currentSession && timeRemaining > 0 && (
        <div className="bg-sage text-white p-3 no-print">
          <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 flex items-center justify-between">
            <span className="text-sm">
              Session expires in {hoursRemaining}h {minutesRemaining}m
            </span>
            <button
              onClick={handleResetSession}
              className="text-sm underline hover:no-underline"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Recipe Info */}
        <div className="ios-card p-5 recipe-content">
          {/* Recipe Image with Upload Option */}
          <div className="relative mb-4">
            {recipe.image ? (
              <div className="relative group">
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={triggerPhotoUpload}
                  disabled={isUploadingPhoto}
                  className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-lg transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                  aria-label="Change photo"
                >
                  {isUploadingPhoto ? (
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <div className="flex flex-col items-center text-white">
                      <Camera className="h-8 w-8 mb-1" />
                      <span className="text-sm font-medium">Change Photo</span>
                    </div>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={triggerPhotoUpload}
                disabled={isUploadingPhoto}
                className="w-full h-48 bg-gray-100 rounded-lg flex flex-col items-center justify-center hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300 hover:border-gray-400"
                aria-label="Add photo"
              >
                {isUploadingPhoto ? (
                  <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-gray-400 mb-2" />
                    <span className="text-gray-600 font-medium">Add Photo</span>
                    <span className="text-gray-500 text-sm">Click to upload</span>
                  </>
                )}
              </button>
            )}
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              aria-label="Upload recipe photo"
            />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{recipe.title}</h1>

          {/* Category */}
          <div className="mb-4 no-print">
            <label htmlFor="recipe-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <div className="flex items-center gap-2">
              <select
                id="recipe-category"
                value={(recipe.category || '').trim()}
                onChange={(e) => handleSetCategory(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry focus:border-transparent bg-white text-gray-900"
              >
                <option value="">Uncategorized</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddNewCategory}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title="Add a new category"
              >
                +
              </button>
            </div>
          </div>
          
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mb-4">
            {recipe.sourceName && (
              <span>{recipe.sourceName}</span>
            )}
            {recipe.author && (
              <span>by {recipe.author}</span>
            )}

            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blueberry hover:underline"
                title="Open the original recipe page"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Original</span>
                {sourceHost && <span className="text-gray-500">({sourceHost})</span>}
              </a>
            )}
          </div>

          <div className="flex items-center space-x-6 text-sm text-gray-600">
            {recipe.yield && (
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{recipe.yield}</span>
              </div>
            )}
            {recipe.times?.total && (
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{recipe.times.total} min</span>
              </div>
            )}
          </div>
        </div>

        {/* Scale Control */}
        <div className="ios-card p-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Scale Recipe</h3>
            {hasConvertibleIngredients && (
              <button
                onClick={() => setPreferGrams(!preferGrams)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-sm font-medium transition-colors ${
                  showGrams 
                    ? 'bg-sage text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Convert to grams"
              >
                <Scale className="h-4 w-4" />
                <span>Grams</span>
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            <div
              className="ios-card p-5 recipe-content md:sticky md:top-6 md:max-h-[calc(100vh-8rem)] md:overflow-auto"
              aria-label="Ingredients"
            >
              <select
                id="multiplier-select"
                value={multiplier.toString()}
                onChange={(e) => handleMultiplierChange(e.target.value)}
                aria-label="Scale multiplier"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry focus:border-transparent bg-white text-gray-900"
              >
                {getMultiplierOptions().map(({ value, label }) => (
                  <option key={value} value={value.toString()}>
                    {label} {value === 1 ? '(Original)' : value < 1 ? '(Smaller)' : '(Larger)'}
                  </option>
                ))}
                <option value="custom">Custom Amount...</option>
              </select>
            </div>
            
            {multiplier !== 1 && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                Recipe scaled by {formatFraction(multiplier)}×
              </div>
            )}
          </div>

          {showCustomInput && (
            <div className="mt-3 space-y-2">
              <label htmlFor="custom-multiplier" className="block text-sm font-medium text-gray-700">
                Custom Multiplier
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="custom-multiplier"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="10"
                  value={customMultiplier}
                  onChange={(e) => setCustomMultiplier(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry focus:border-transparent"
                  placeholder="e.g., 1.5"
                />
                <button
                  onClick={handleCustomMultiplier}
                  className="px-4 py-2 bg-blueberry text-white rounded-lg hover:bg-blueberry/90 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => setShowCustomInput(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ingredients + Instructions (two-column on tablet/desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Ingredients */}
          <section
            className="bg-white rounded-lg p-6 shadow-sm recipe-content md:sticky md:top-6 md:max-h-[calc(100vh-8rem)] md:overflow-auto"
            aria-label="Ingredients"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Ingredients</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {multiplier !== 1 && (
                  <span>Scaled by {formatFraction(multiplier)}×</span>
                )}
                {showGrams && (
                  <span className="bg-sage text-white px-2 py-1 rounded text-xs">
                    Grams
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {scaledIngredients.map((ingredient, index) => {
                // Render group headers differently
                if (ingredient.isGroupHeader) {
                  return (
                    <h3 key={index} className="text-base font-semibold text-gray-800 mt-4 mb-2 first:mt-0">
                      {ingredient.raw
                        .replace(/\*\*/g, '')
                        // Only remove a trailing colon (e.g., "Levain:"), keep internal colons like "1:10:10"
                        .replace(/:\s*$/, '')
                        .trim()}
                    </h3>
                  );
                }

                // Regular ingredient with checkbox
                return (
                  <div
                    key={index}
                    className="flex items-start space-x-3 ingredient-item"
                  >
                    {currentSession ? (
                      <button
                        onClick={() => toggleIngredient(index)}
                        className={`mt-1 w-5 h-5 rounded border-2 flex-shrink-0 no-print ${
                          currentSession.checkedIngredients[index]
                            ? 'bg-sage border-sage'
                            : 'border-gray-300'
                        }`}
                      >
                        {currentSession.checkedIngredients[index] && (
                          <svg className="w-3 h-3 text-white m-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <div className="mt-1 w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0 print-only"></div>
                    )}

                    <span className={`text-gray-900 ${currentSession?.checkedIngredients[index] ? 'line-through opacity-60' : ''}`}>
                      {(() => {
                        if (showGrams && ingredient.gramsDisplay) {
                          // Show grams conversion
                          const item = ingredient.item;
                          const note = ingredient.note;

                          return [
                            ingredient.gramsDisplay,
                            item && ` ${item}`,
                            note && ` (${note})`
                          ].filter(Boolean).join('');
                        } else {
                          // Show original measurements
                          const amount = getIngredientDisplayAmount(ingredient, false);
                          const unit = ingredient.unit;
                          const item = ingredient.item;
                          const note = ingredient.note;

                          return [
                            amount,
                            unit && ` ${unit}`,
                            item && ` ${item}`,
                            note && ` (${note})`
                          ].filter(Boolean).join('');
                        }
                      })()}
                      {showGrams && !ingredient.gramsDisplay && (
                        <span className="text-gray-500 text-sm ml-2">(conversion not available)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Instructions */}
          <section className="ios-card p-5 recipe-content" aria-label="Instructions">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Instructions</h2>

            <div className="space-y-4">
              {recipe.steps.map((step, index) => {
                // Render section headers (e.g. "**Levain:**") without checkboxes
                if (isStepGroupHeader(step)) {
                  return (
                    <h3 key={index} className="text-base font-semibold text-gray-800 mt-4 mb-2 first:mt-0">
                      {formatStepGroupHeader(step)}
                    </h3>
                  );
                }

                return (
                  <div key={index} className="flex items-start space-x-3 step-item">
                    {currentSession ? (
                      <button
                        onClick={() => toggleStep(index)}
                        className={`mt-1 w-6 h-6 rounded-full border-2 flex-shrink-0 no-print ${
                          currentSession.checkedSteps[index]
                            ? 'bg-sage border-sage'
                            : 'border-gray-300'
                        }`}
                      >
                        {currentSession.checkedSteps[index] && (
                          <svg className="w-4 h-4 text-white m-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <span className="mt-1 w-6 h-6 rounded-full bg-blueberry text-white text-sm flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                    )}

                    <div className="flex-1">
                      <p className={`text-gray-900 ${currentSession?.checkedSteps[index] ? 'line-through opacity-60' : ''}`}>
                        {step}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <FloatingStepTimer
          recipeTitle={recipe.title}
          recipeImageUrl={recipe.image}
          stepIndex={currentStepIndex}
          stepText={recipe.steps[currentStepIndex] || ''}
          enabled={!!currentSession}
          onTimerComplete={(seconds) => toast.success(`Timer done (${Math.round(seconds / 60)} min)`)}
        />

        {/* Tips */}
        {recipe.tips && recipe.tips.length > 0 && (
          <div className="ios-card p-5 recipe-content">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tips</h2>
            <div className="space-y-2">
              {recipe.tips.map((tip, index) => (
                <p key={index} className="text-gray-700">
                  • {tip}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Nutrition Information */}
        {recipe.nutrition && (
          <div className="ios-card p-5 recipe-content">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nutrition Facts</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {recipe.nutrition.calories !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Calories</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.calories}</div>
                </div>
              )}
              {recipe.nutrition.protein !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Protein</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.protein}g</div>
                </div>
              )}
              {recipe.nutrition.totalCarbohydrates !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Carbs</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.totalCarbohydrates}g</div>
                </div>
              )}
              {recipe.nutrition.totalFat !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Total Fat</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.totalFat}g</div>
                </div>
              )}
              {recipe.nutrition.saturatedFat !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Saturated Fat</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.saturatedFat}g</div>
                </div>
              )}
              {recipe.nutrition.cholesterol !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Cholesterol</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.cholesterol}mg</div>
                </div>
              )}
              {recipe.nutrition.sodium !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Sodium</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.sodium}mg</div>
                </div>
              )}
              {recipe.nutrition.dietaryFiber !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Fiber</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.dietaryFiber}g</div>
                </div>
              )}
              {recipe.nutrition.sugars !== undefined && (
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-sm text-gray-600">Sugars</div>
                  <div className="text-lg font-semibold text-gray-900">{recipe.nutrition.sugars}g</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Personal Notes */}
        <div className="ios-card p-5 recipe-content">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">My Notes</h2>
            {!isEditingNotes ? (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="text-blueberry hover:text-blueberry/80 p-1"
                title="Edit notes"
              >
                <Edit3 size={20} />
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleUpdateNotes}
                  className="text-green-600 hover:text-green-800 p-1"
                  title="Save notes"
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={() => {
                    setIsEditingNotes(false);
                    setNotesText(recipe?.notes || '');
                  }}
                  className="text-gray-500 hover:text-gray-700 p-1"
                  title="Cancel"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>
          
          {isEditingNotes ? (
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add your personal notes about this recipe..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blueberry/20 focus:border-blueberry resize-none"
              rows={4}
              autoFocus
            />
          ) : (
            <div className="text-gray-700 whitespace-pre-wrap min-h-[1.5rem]">
              {recipe?.notes || (
                <span className="text-gray-400 italic">No notes yet. Click the edit button to add your own notes about this recipe.</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 no-print ios-padding">
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto flex justify-center space-x-4">
          {!currentSession ? (
            <button
              onClick={handleStartSession}
              className="flex-1 bg-blueberry text-white py-3 rounded-lg hover:bg-blueberry/90 transition-colors"
            >
              Start Cooking
            </button>
          ) : (
            <>
              <button
                onClick={handleResetSession}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Reset</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 bg-sage text-white py-3 rounded-lg hover:bg-sage/90 transition-colors flex items-center justify-center space-x-2"
              >
                <Printer className="h-5 w-5" />
                <span>Print</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom padding for sticky bar */}
      <div className="h-20 no-print"></div>
    </div>
  );
}
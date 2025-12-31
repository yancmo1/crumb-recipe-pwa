import { useState } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, useRecipeStore } from '../state/session';
import { db } from '../db';
import { RvLayout } from '../components/RvLayout';

export default function Settings() {
  const {
    theme,
    setTheme,
    keepSessionsOnClose,
    setKeepSessionsOnClose,
    syncKey,
    setSyncKey,
    apiBaseUrl,
    setApiBaseUrl,
    preferGrams,
    setPreferGrams,
    conversionOverrides,
    upsertConversionOverride,
    removeConversionOverride
  } = useSettings();
  const { recipes, loadRecipes } = useRecipeStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  const [overrideIngredientKey, setOverrideIngredientKey] = useState('');
  const [overrideUnit, setOverrideUnit] = useState('');
  const [overrideGramsPerUnit, setOverrideGramsPerUnit] = useState('');

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await db.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crumbworks-recipes-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Recipes exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export recipes');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (!data.recipes || !Array.isArray(data.recipes)) {
          throw new Error('Invalid file format');
        }

        await db.importData(data);
        await loadRecipes();
        toast.success(`Imported ${data.recipes.length} recipes successfully!`);
      } catch (error) {
        console.error('Import failed:', error);
        toast.error('Failed to import recipes. Please check the file format.');
      } finally {
        setIsImporting(false);
        // Reset the input
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleClearAllData = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL recipes from the server AND local cache. This cannot be undone!\n\nAre you absolutely sure?')) {
      return;
    }

    setIsClearingData(true);
    try {
      // Get all recipe IDs
      const allRecipes = await db.getAllRecipes();
      
      // Delete from server (which also clears cache)
      for (const recipe of allRecipes) {
        await db.deleteRecipe(recipe.id);
      }
      
      // Clear sessions
      await db.sessions.clear();
      await loadRecipes();
      toast.success('All data cleared successfully');
    } catch (error) {
      console.error('Clear data failed:', error);
      toast.error('Failed to clear data');
    } finally {
      setIsClearingData(false);
    }
  };

  const handleAddOverride = () => {
    upsertConversionOverride(
      overrideIngredientKey,
      overrideUnit,
      Number(overrideGramsPerUnit)
    );
    setOverrideIngredientKey('');
    setOverrideUnit('');
    setOverrideGramsPerUnit('');
    toast.success('Conversion override saved');
  };

  return (
    <RvLayout title="Settings">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* Theme Settings */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-4">Appearance</h2>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-rvGray">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
          </div>
        </div>

        {/* Measurement Settings */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-4">Measurements</h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-rvGray">Prefer grams by default</span>
                <p className="text-sm text-gray-500">When conversions are available, show ingredient weights in grams</p>
              </div>
              <input
                type="checkbox"
                checked={preferGrams}
                onChange={(e) => setPreferGrams(e.target.checked)}
                className="w-5 h-5 accent-rvAccent rounded focus:ring-rvAccent"
              />
            </label>
          </div>
        </div>

        {/* Sync Settings */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-2">Sync</h2>
          <p className="text-sm text-gray-500 mb-4">
            Use the same sync key on multiple devices to share the same recipe library (no account required).
          </p>

          <label className="block">
            <span className="text-sm font-medium text-rvGray">Sync key</span>
            <input
              value={syncKey}
              onChange={(e) => setSyncKey(e.target.value)}
              placeholder="e.g., family-kitchen"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rvAccent focus:border-transparent"
            />
          </label>

          <div className="mt-4">
            <label className="block">
              <span className="text-sm font-medium text-rvGray">Server URL (API base)</span>
              <input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://your-domain.com/api"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rvAccent focus:border-transparent"
              />
            </label>
            <p className="mt-2 text-sm text-gray-500">
              Set this to your deployed server’s API (ends with <span className="font-mono">/api</span>).
              For local development, <span className="font-mono">http://localhost:3000/api</span> often works.
            </p>
          </div>
        </div>

        {/* Conversion Overrides */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-2">Conversion Overrides</h2>
          <p className="text-sm text-gray-500 mb-4">
            Add your own ingredient/unit → grams conversions. These are used before built-in conversions.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <input
                value={overrideIngredientKey}
                onChange={(e) => setOverrideIngredientKey(e.target.value)}
                placeholder="Ingredient (e.g., bread flour)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rvAccent focus:border-transparent"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={overrideUnit}
                  onChange={(e) => setOverrideUnit(e.target.value)}
                  placeholder="Unit (cup)"
                  className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rvAccent focus:border-transparent"
                />
                <input
                  value={overrideGramsPerUnit}
                  onChange={(e) => setOverrideGramsPerUnit(e.target.value)}
                  placeholder="g per unit"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  className="col-span-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rvAccent focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAddOverride}
                  disabled={!overrideIngredientKey.trim() || !overrideUnit.trim() || !overrideGramsPerUnit.trim()}
                  className="col-span-1 px-3 py-2 rv-cta-gradient text-white rounded-lg hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              {Object.keys(conversionOverrides).length === 0 ? (
                <p className="text-sm text-gray-500">No overrides yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(conversionOverrides)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([ingredientKey, units]) => (
                      <div key={ingredientKey} className="bg-gray-50 rounded-lg p-3">
                        <div className="font-medium text-rvGray">{ingredientKey}</div>
                        <div className="mt-2 space-y-1">
                          {Object.entries(units)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([unit, gramsPerUnit]) => (
                              <div key={`${ingredientKey}:${unit}`} className="flex items-center justify-between text-sm">
                                <span className="text-rvGray">
                                  1 {unit} = {gramsPerUnit} g
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeConversionOverride(ingredientKey, unit)}
                                  className="text-red-700 hover:text-red-800"
                                  aria-label={`Remove override ${ingredientKey} ${unit}`}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Settings */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-4">Cooking Sessions</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-rvGray">Keep sessions when closing app</span>
                <p className="text-sm text-gray-500">Sessions will persist until they expire</p>
              </div>
              <input
                type="checkbox"
                checked={keepSessionsOnClose}
                onChange={(e) => setKeepSessionsOnClose(e.target.checked)}
                className="w-5 h-5 accent-rvAccent rounded focus:ring-rvAccent"
              />
            </label>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-4">Data Management</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-rvGray">Export Recipes</span>
                <p className="text-sm text-gray-500">Download all recipes as JSON</p>
              </div>
              <button
                onClick={handleExportData}
                disabled={isExporting || recipes.length === 0}
                className="flex items-center space-x-2 px-4 py-2 rv-cta-gradient text-white rounded-lg hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-rvGray">Import Recipes</span>
                <p className="text-sm text-gray-500">Upload recipes from JSON file</p>
              </div>
              <label className="flex items-center space-x-2 px-4 py-2 bg-rvBlue text-white rounded-lg hover:bg-rvBlue/90 cursor-pointer transition-colors">
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Import</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-red-700">Clear All Data</span>
                  <p className="text-sm text-gray-500">Delete all recipes and sessions</p>
                </div>
                <button
                  onClick={handleClearAllData}
                  disabled={isClearingData}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isClearingData ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Clear</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-4">About</h2>
          
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Recipes:</strong> {recipes.length}</p>
            <p><strong>Storage:</strong> Server + Offline Cache</p>
            <p className="text-xs text-gray-500 mt-2">
              Your recipes sync to the server and are cached locally for offline use.
            </p>
          </div>
        </div>
      </div>
    </RvLayout>
  );
}
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Moon, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, useRecipeStore } from '../state/session';
import { db } from '../db';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, keepSessionsOnClose, setKeepSessionsOnClose } = useSettings();
  const { recipes, loadRecipes } = useRecipeStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await db.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crumb-recipes-${new Date().toISOString().split('T')[0]}.json`;
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

  return (
    <div className="min-h-screen bg-oatmeal">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Back to library"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Theme Settings */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Appearance</h2>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Theme</span>
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

        {/* Session Settings */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cooking Sessions</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-gray-700">Keep sessions when closing app</span>
                <p className="text-sm text-gray-500">Sessions will persist until they expire</p>
              </div>
              <input
                type="checkbox"
                checked={keepSessionsOnClose}
                onChange={(e) => setKeepSessionsOnClose(e.target.checked)}
                className="w-5 h-5 text-blueberry rounded focus:ring-blueberry"
              />
            </label>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Management</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-700">Export Recipes</span>
                <p className="text-sm text-gray-500">Download all recipes as JSON</p>
              </div>
              <button
                onClick={handleExportData}
                disabled={isExporting || recipes.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-blueberry text-white rounded-lg hover:bg-blueberry/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                <span className="text-gray-700">Import Recipes</span>
                <p className="text-sm text-gray-500">Upload recipes from JSON file</p>
              </div>
              <label className="flex items-center space-x-2 px-4 py-2 bg-sage text-white rounded-lg hover:bg-sage/90 cursor-pointer transition-colors">
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
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
          
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
    </div>
  );
}
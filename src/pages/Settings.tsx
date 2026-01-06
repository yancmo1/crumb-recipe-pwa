import { useState, useRef } from 'react';
import { Download, Upload, Trash2, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, useRecipeStore } from '../state/session';
import { getDb } from '../db';
import { RvLayout } from '../components/RvLayout';
import { listProfiles, getActiveProfile, createProfile, setActiveProfile, deleteProfile } from '../profile/profileManager';
import { reinitializeForProfile } from '../initDatabase';
import { exportSnapshot, importSnapshot, downloadSnapshot, parseSnapshotFile } from '../sharing/snapshot';
import type { Profile } from '../types';

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

  // Profile management state
  const [profiles, setProfiles] = useState<Profile[]>(listProfiles());
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(getActiveProfile());
  const [newProfileLabel, setNewProfileLabel] = useState('');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);

  // Snapshot import state
  const [isImportingSnapshot, setIsImportingSnapshot] = useState(false);
  const snapshotFileInputRef = useRef<HTMLInputElement>(null);

  const [overrideIngredientKey, setOverrideIngredientKey] = useState('');
  const [overrideUnit, setOverrideUnit] = useState('');
  const [overrideGramsPerUnit, setOverrideGramsPerUnit] = useState('');

  const refreshProfiles = () => {
    setProfiles(listProfiles());
    setActiveProfileState(getActiveProfile());
  };

  const handleCreateProfile = async () => {
    if (!newProfileLabel.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    setIsCreatingProfile(true);
    try {
      const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 15)}`;
      const newId = `local:${uuid}`;
      createProfile(newId, newProfileLabel.trim());
      refreshProfiles();
      setNewProfileLabel('');
      toast.success(`Profile "${newProfileLabel}" created!`);
    } catch (error) {
      console.error('Failed to create profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleSwitchProfile = async (userId: string) => {
    if (userId === activeProfile?.userId) {
      return;
    }

    setIsSwitchingProfile(true);
    try {
      // Set active profile
      setActiveProfile(userId);
      
      // Reinitialize database for new profile
      await reinitializeForProfile(userId);
      
      // Reload recipes for new profile
      await loadRecipes();
      
      refreshProfiles();
      toast.success('Switched profile successfully!');
      
      // Reload page to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to switch profile:', error);
      toast.error('Failed to switch profile');
      setIsSwitchingProfile(false);
    }
  };

  const handleDeleteProfile = (userId: string) => {
    const profile = profiles.find(p => p.userId === userId);
    if (!profile) return;

    if (!confirm(`Delete profile "${profile.label}"? This will NOT delete the profile's data, only remove it from the list.`)) {
      return;
    }

    try {
      deleteProfile(userId);
      refreshProfiles();
      toast.success(`Profile "${profile.label}" removed`);
    } catch (error) {
      console.error('Failed to delete profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete profile');
    }
  };

  const handleExportSnapshot = async () => {
    setIsExporting(true);
    try {
      const db = getDb();
      const snapshot = await exportSnapshot(db.db, {
        includeSessions: false,
        userId: activeProfile?.userId
      });
      
      downloadSnapshot(snapshot, `crumbworks-${activeProfile?.label || 'profile'}-${Date.now()}.json`);
      toast.success('Snapshot exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export snapshot');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSnapshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingSnapshot(true);
    try {
      const snapshot = await parseSnapshotFile(file);
      
      const db = getDb();
      const result = await importSnapshot(db.db, snapshot, 'merge');
      
      await loadRecipes();
      toast.success(`Imported ${result.imported} recipes! (${result.skipped} skipped)`);
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import snapshot');
    } finally {
      setIsImportingSnapshot(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const db = getDb();
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

        const db = getDb();
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
      const db = getDb();
      const allRecipes = await db.getAllRecipes();
      
      // Delete from server (which also clears cache)
      for (const recipe of allRecipes) {
        await db.deleteRecipe(recipe.id);
      }
      
      // Clear sessions
      await db.db.sessions.clear();
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
        {/* Profile Management */}
        <div className="bg-white rounded-xl shadow-rv-card p-5">
          <h2 className="text-lg font-semibold text-rvGray mb-2">Profile Management</h2>
          <p className="text-sm text-gray-500 mb-4">
            Create and switch between multiple profiles. Each profile has its own recipes and settings.
          </p>

          {/* Active Profile */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-rvGray">Current Profile</div>
                <div className="text-sm text-gray-600">{activeProfile?.label || 'My Profile'}</div>
              </div>
            </div>
          </div>

          {/* Profile List */}
          {profiles.length > 1 && (
            <div className="mb-4 space-y-2">
              <div className="text-sm font-medium text-rvGray">Available Profiles</div>
              {profiles.map(profile => (
                <div
                  key={profile.userId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    profile.userId === activeProfile?.userId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-rvGray">{profile.label}</span>
                    {profile.userId === activeProfile?.userId && (
                      <span className="text-xs text-blue-600 font-medium">(active)</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {profile.userId !== activeProfile?.userId && (
                      <>
                        <button
                          onClick={() => handleSwitchProfile(profile.userId)}
                          disabled={isSwitchingProfile}
                          className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          Switch
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(profile.userId)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create New Profile */}
          <div className="border-t border-gray-200 pt-4">
            <div className="text-sm font-medium text-rvGray mb-2">Create New Profile</div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newProfileLabel}
                onChange={(e) => setNewProfileLabel(e.target.value)}
                placeholder="Profile name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rvAccent focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
              />
              <button
                onClick={handleCreateProfile}
                disabled={isCreatingProfile || !newProfileLabel.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-rvBlue text-white rounded-lg hover:bg-rvBlue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreatingProfile ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span>Create</span>
              </button>
            </div>
          </div>
        </div>

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
          <h2 className="text-lg font-semibold text-rvGray mb-2">Data Management</h2>
          <p className="text-sm text-gray-500 mb-4">
            Export and import your recipe data.
          </p>
          
          <div className="space-y-4">
            {/* Snapshot Export/Import */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-semibold text-rvGray mb-3">Profile Snapshot</h3>
              
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-rvGray">Export Snapshot</span>
                  <p className="text-sm text-gray-500">Download current profile's data as JSON</p>
                </div>
                <button
                  onClick={handleExportSnapshot}
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
                  <span className="text-rvGray">Import Snapshot</span>
                  <p className="text-sm text-gray-500">Upload a profile snapshot (merges with existing data)</p>
                </div>
                <label className="flex items-center space-x-2 px-4 py-2 bg-rvBlue text-white rounded-lg hover:bg-rvBlue/90 cursor-pointer transition-colors">
                  {isImportingSnapshot ? (
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
                    ref={snapshotFileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportSnapshot}
                    disabled={isImportingSnapshot}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Legacy Export/Import */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-sm font-semibold text-rvGray mb-3">Legacy Format</h3>
              
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-rvGray">Export Recipes (Legacy)</span>
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
                  <span className="text-rvGray">Import Recipes (Legacy)</span>
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
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-red-700">Clear All Data</span>
                  <p className="text-sm text-gray-500">Delete all recipes and sessions from current profile</p>
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
            <p><strong>Active Profile:</strong> {activeProfile?.label || 'My Profile'}</p>
            <p><strong>Recipes:</strong> {recipes.length}</p>
            <p><strong>Storage:</strong> Multi-Profile + Server Sync</p>
            <p className="text-xs text-gray-500 mt-2">
              Each profile has its own recipes and settings. Data syncs to the server and is cached locally for offline use.
            </p>
          </div>
        </div>
      </div>
    </RvLayout>
  );
}
# Web Share Target Testing Guide

## Overview
This document describes how to test the Web Share Target feature in CrumbWorks.

## Prerequisites
- CrumbWorks must be installed as a PWA
- Device/browser must support Web Share Target API

## Platform-Specific Installation

### iOS (Safari)
1. Open CrumbWorks in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Confirm installation

### Android (Chrome)
1. Open CrumbWorks in Chrome
2. Tap the menu (three dots)
3. Select "Install app" or "Add to Home screen"
4. Confirm installation

### Desktop (Chrome/Edge)
1. Open CrumbWorks in Chrome or Edge
2. Click the install icon in the address bar
3. Confirm installation

## Testing the Feature

### Test Case 1: Share from Mobile Browser
1. Open any recipe webpage in your mobile browser
2. Tap the Share button in the browser
3. Look for "CrumbWorks" in the share menu
4. Tap "CrumbWorks"
5. **Expected**: CrumbWorks opens to the import page with the URL already populated
6. **Expected**: URL is validated and normalized
7. Tap "Import Recipe" to complete the import

### Test Case 2: Invalid URL Handling
1. Share a non-recipe URL (e.g., "file:///etc/passwd")
2. Select CrumbWorks from share menu
3. **Expected**: CrumbWorks opens with error toast showing the URL is invalid
4. **Expected**: Raw URL is still populated in the field for user to fix

### Test Case 3: URL Parameter Cleanup
1. Share a recipe URL to CrumbWorks
2. Note the `/import?url=...` in the address bar initially
3. **Expected**: URL parameter is automatically removed from address bar
4. **Expected**: Refreshing the page doesn't re-import the URL

## Supported Browsers

### Full Support (Share Target API)
- ✅ Chrome/Edge on Android (v71+)
- ✅ Safari on iOS (v15+)
- ✅ Chrome/Edge on desktop (v89+)

### No Support (Share Target API not available)
- ❌ Firefox (not yet implemented)
- ❌ Safari on macOS (PWA limitations)

**Note**: When share target is not available, users can still manually copy/paste URLs into the import page.

## Manifest Verification

To verify the share_target is properly configured:

1. Build the app: `npm run build`
2. Check the manifest: `cat dist/manifest.webmanifest`
3. Look for:
```json
{
  "share_target": {
    "action": "/import",
    "method": "GET",
    "enctype": "application/x-www-form-urlencoded",
    "params": {
      "url": "url"
    }
  }
}
```

## Troubleshooting

### "CrumbWorks" doesn't appear in share menu
- Ensure the app is installed as a PWA (not just bookmarked)
- Reinstall the PWA if necessary
- Check browser support (see above)

### URL not auto-populated
- Check browser console for errors
- Verify the share_target configuration in manifest
- Check that the URL parameter is being passed correctly

### Infinite loop or repeated imports
- Fixed in current implementation using `window.history.replaceState()`
- If you see this, ensure you have the latest version

## Technical Details

### Implementation Files
- **Manifest**: `vite.config.ts` (PWA manifest configuration)
- **Handler**: `src/pages/ImportRecipe.tsx` (URL parameter handling)
- **Documentation**: `README.md` (user-facing documentation)

### Flow Diagram
```
Browser Share → PWA opens at /import?url=<recipe-url>
  ↓
ImportRecipe component mounts
  ↓
useEffect reads query parameter
  ↓
Validates URL with normalizeRecipeUrl()
  ↓
Sets URL field (or shows error if invalid)
  ↓
Clears query parameter with replaceState
  ↓
User clicks "Import Recipe"
  ↓
Recipe imported and displayed
```

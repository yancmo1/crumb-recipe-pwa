# iOS removal audit

This document records the removal of iOS-native development artifacts and iOS-native instructions from this repository while preserving the web/PWA implementation.

## Scope

Removed or de-scoped items include:

- iOS-native projects/artifacts (Xcode, Swift/SwiftUI/UIKit, CocoaPods, Fastlane)
- iOS-native wrapper/tooling (Capacitor-based native builds)
- iOS-only automation/scripts and editor settings pointing at Xcode workspaces
- iOS-native distribution references (TestFlight / App Store Connect)

Intentionally retained (because they are web/PWA behavior):

- Safari/WebKit PWA meta tags
- Safe-area inset handling for notched devices
- Service worker, manifest, IndexedDB (Dexie), and offline-first behavior

## Removed files and directories (no longer tracked)

The following iOS-native paths are no longer present as tracked files in git:

- `ios/`
- `fastlane/`
- `Gemfile`
- `Gemfile.lock`
- `capacitor.config.ts`
- `IOS_NATIVE_SETUP.md`
- `FASTLANE_GUIDE.md`

Additional non-source artifacts removed from the repo:

- `.DS_Store`
- `har.har`
- `crumb-recipes-2025-08-27 (1).json`

## Exact documentation/config lines removed

The lines below are quoted exactly as they existed before this cleanup and were removed or rewritten.

### `.gitignore`

Removed native build automation ignores:

- `# Bundler`
- `/.bundle/*`
- `!/.bundle/config`
- `vendor/bundle/`
- `# Fastlane outputs`
- `fastlane/report.xml`
- `fastlane/Preview.html`
- `fastlane/screenshots/`
- `fastlane/test_output/`
- `fastlane/build/`
- `*.ipa`
- `*.dSYM.zip`

### `PRD.md`

Platform wording and roadmap items removed/reworded:

- `- Installable on iOS Safari and Android Chrome`
- `- Apple-specific meta tags for iOS`
- `- ✅ Install prompt works on iOS and Android`
- `| PWA Support | ✅ Done | 1.0 | iOS + Android |`

Removed native-app roadmap items:

- `- [ ] Native iOS app (Swift)`
- `- [ ] Native Android app (Kotlin)`
- `- [ ] Wearable support`
- `  - Apple Watch complications`
- `  - Timer controls from watch`
- `  - HomeKit`

Reworded iOS-specific headings/notes:

- `**Recipe Vault Brand Palette (iOS UI/UX Refactor):**`
- `-**iOS Safari Optimizations:**`
- `-## 6.4 iOS UI/UX Redesign Compliance (Recipe Vault)`
- `- **Font Family:** System font stack (San Francisco on iOS, Roboto on Android)`
- `- ✅ PWA installable on iOS/Android`

### `README.md`

Removed iOS-only framing in support section:

- `### iOS Safari Support`
- `- ✅ iOS Safari 14+ (primary target)`

### `crumb-recipe-pwa.code-workspace`

Removed references to iOS artwork folders and Xcode workspace paths:

- `"path": "../~Artwork for apps/iOS Apps/CrumbWorks"`
- `"sweetpad.build.xcodeWorkspacePath": "ios/App/App.xcodeproj/project.xcworkspace"`

### `index.html`

Removed native-wrapper mention and iOS-only wording in comments:

- `// This helps diagnose Capacitor "⚡️ JS Eval error" messages that may occur very early.`
- `<!-- Viewport + safe areas (needed for iOS notch/Dynamic Island) -->`
- `<!-- iOS Safari PWA Meta Tags -->`
- `<!-- Splash screens for iOS (optional - can be generated) -->`

### `vite.config.ts` / `vite.config.js`

Removed Capacitor-specific wording:

- `// In Capacitor WKWebView, WebKit can emit noisy privacy warnings like:`
- `// and query-string icons aren't needed for native builds anyway.`

### `public/masked-icon.svg`

Removed iOS-specific language in mask guidance:

- `Full-bleed background; artwork kept within safe padding so iOS/Android masks don't crop the bread.`

## Verification

Tracked-file scan for iOS-native and native-wrapper terms:

- `git grep -n -I -E '\\b(iOS|Xcode|SwiftUI|UIKit|fastlane|TestFlight|App Store Connect|Capacitor|CocoaPods|Podfile|ActivityKit|WidgetKit)\\b'` → no matches

No iOS development or iOS instruction traces remain in this repository.

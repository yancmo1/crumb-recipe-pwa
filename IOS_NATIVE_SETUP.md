# iOS native setup (Capacitor)

This repo includes an iOS wrapper under `ios/` using Capacitor.

## Prereqs

- Xcode installed
- An Apple ID added to Xcode (Xcode → Settings → Accounts)

## Build / run

1. Build the web assets

- `npm run build`

1. Sync Capacitor

- `npx cap sync ios`

1. Open the Xcode project

- Open `ios/App/App.xcodeproj`

1. Fix signing (required for device builds)

In Xcode:

- Select the `App` target
- Go to **Signing & Capabilities**
- Check **Automatically manage signing**
- Select a **Team** (your Personal Team or an org team)

If you see **“Signing for 'App' requires a development team”**, it means Xcode doesn’t have a Team selected for this project yet.

### Notes

- The bundle id is currently `com.yancmo.crumb`.
  - If you don’t control that identifier on your team, change it in **Signing & Capabilities**.

## Live Activities / Dynamic Island status

Live Activities / Dynamic Island support is implemented using **ActivityKit + WidgetKit**:

- Native bridge: `ios/App/App/LiveActivitiesPlugin.swift`
- Widget extension: `ios/App/TimerLiveActivityExtension/*`
- JS wrapper: `src/utils/liveActivities.ts`
- Manual test harness: in the iOS app, open **Settings → Live Activities** and tap **Start test Live Activity** (see `QUICK_START.md`).

### If Xcode shows SwiftPM “missing xcframework zip” errors

Occasionally Xcode’s SwiftPM artifact cache can get into a bad state and you may see errors like:

- `.../SourcePackages/artifacts/capacitor-swift-pm/Cordova/Cordova.xcframework.zip` (file not found)
- `.../SourcePackages/artifacts/capacitor-swift-pm/Capacitor/Capacitor.xcframework.zip` (file not found)

Fix:

- Run `npm run ios:spm:repair` (deletes this project’s Xcode DerivedData so SwiftPM can re-fetch artifacts)
- Re-open Xcode and build again


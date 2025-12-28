# Fastlane + VS Code Guide (Drop-in)

This file is meant to be copied into **any iOS app repo** to standardize how you run Fastlane locally and via VS Code Tasks.

It assumes:
- You run Fastlane via **Bundler** (`bundle exec fastlane ...`) so everyone uses the same Fastlane version.
- You authenticate to App Store Connect using an **App Store Connect API key** (preferred), or fall back to Apple ID session when needed.
- Your lanes are under `platform :ios` and you set `default_platform(:ios)` so you can run `fastlane beta` (or `fastlane ios beta`).

---

## What to keep in every repo

### 1) `Gemfile`
Pin Fastlane so it’s reproducible across machines.

Recommended minimal `Gemfile`:
- `source "https://rubygems.org"`
- `gem "fastlane", "~> 2.x"`

Then install:
- `bundle install`

### 2) `fastlane/` folder
Typical files:
- `fastlane/Fastfile` — lanes you actually run (beta, tests, release, etc)
- `fastlane/Appfile` — app identifier / Apple ID info (optional when using API key)
- `fastlane/metadata/` — App Store metadata (optional)

### 3) `.vscode/tasks.json`
Add Tasks so anyone can run:
- upload to TestFlight
- check TestFlight status
- run tests
- upload metadata
- submit for App Store review

A copy/paste template is included below.

---

## Authentication (App Store Connect) ✅

### Preferred: App Store Connect API key
Create an App Store Connect API key in App Store Connect (Users and Access → Keys).

Set these environment variables:
- `ASC_KEY_ID` — Key ID (e.g. `ABC123DEFG`)
- `ASC_ISSUER_ID` — Issuer ID (UUID)
- `ASC_KEY_PATH` — absolute path to the `.p8` file on your machine

**Keep the `.p8` outside the repo** (e.g. `$HOME/.appstoreconnect/private_keys/`).

Recommended file permissions:
- `chmod 600 "$ASC_KEY_PATH"`

#### Important: API key permissions vary by action
Some actions (especially `deliver` for metadata/review submission) can require broader App Store Connect permissions than TestFlight upload.

Portable pattern:
- Use the API key for TestFlight-related actions.
- Default to Apple ID auth for `deliver` *unless* you explicitly opt in (example: `DELIVER_USE_API_KEY=1`).

### Optional (legacy fallback): Apple ID session / app-specific password
If you don’t use an API key, Fastlane may require:
- `FASTLANE_USER`
- `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD`
- or a `FASTLANE_SESSION`

API key auth is strongly recommended because it avoids session expiry drama.

---

## Environment management (recommended) — `direnv`

If you use `direnv`, commit a safe example file and keep secrets local.

1) Copy an example into place:
- copy `.envrc.example` → `.envrc`

2) Allow it:
- `direnv allow`

3) In VS Code Tasks, prefix commands with:
- `eval "$(direnv export zsh)" && ...`

If you don’t use `direnv`, remove that prefix from tasks and export vars another way.

### `.envrc.example` template
Create this in each repo (safe to commit **without** secrets beyond IDs):
- `ASC_KEY_ID="..."`
- `ASC_ISSUER_ID="..."`
- `ASC_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8"`

Optional per-repo knobs are also fine to include (commented out by default), for example:
- wait for TestFlight processing (`WAIT_FOR_PROCESSING=1` or an app-prefixed variant like `STRIDELOG_WAIT_FOR_PROCESSING=1`)
- force API key usage for deliver (`DELIVER_USE_API_KEY=1`)

---

## Common lanes (suggested standard)

These are lane names that tend to work well across projects:

### `fastlane tests`
- Runs unit/UI tests via `scan`.

Recommended optional env vars:
- `SCAN_DERIVED_DATA_PATH` — keep scan derived data under your repo to avoid macOS privacy/TCC issues.
- `SCAN_DESTINATION` — override simulator destination when different machines have different runtimes.

### `fastlane beta`
- Builds + uploads to TestFlight.

Optional env var for waiting on build processing:
- Prefer a generic flag for portability: `WAIT_FOR_PROCESSING=1`
- If you like app-scoped vars, use a prefix: `STRIDELOG_WAIT_FOR_PROCESSING=1`

In your Fastfile, it’s easy to support both:
- treat processing-wait as enabled if either `WAIT_FOR_PROCESSING=="1"` or `APPNAME_WAIT_FOR_PROCESSING=="1"`.

### `fastlane tf_status`
- Prints latest processed build info.

### `fastlane tf_list_all`
- Lists all processed TestFlight builds.

### `fastlane force_bump`
- Forces a local build number bump (e.g. via `agvtool`).

### `fastlane beta_force`
- Force bump, then upload.

### `fastlane archive`
- Creates an archive without uploading.

### `fastlane upload_metadata`
- Uploads metadata/screenshots to App Store Connect (no binary upload).

### `fastlane release`
- Submits the latest build for App Store review (usually using `deliver`).

### `fastlane release_full`
- Upload metadata/screenshots and submit for review in one go.

### (Optional) External TestFlight distribution
Fastlane also supports distributing an existing processed build to external testers via `pilot`.

Common pattern:
- Upload the build (optionally wait for processing)
- Then run `fastlane pilot distribute ...` to submit for external review / notify tester groups

> Tip: Keep lane behavior consistent repo-to-repo even if the underlying build system differs (XcodeGen, Xcodeproj, workspace, etc).

---

## VS Code Tasks (copy/paste)

Add (or merge) the following into `.vscode/tasks.json`.

Notes:
- These tasks assume Bundler: `bundle exec fastlane ...`
- These tasks assume `direnv` is used to load `ASC_*` env vars.
- If you *don’t* use `direnv`, delete the `eval "$(direnv export zsh)" &&` prefix.

**Template tasks** (JSONC):

- `Fastlane: Beta Upload`
- `Fastlane: Beta Upload (Wait)`
- `Fastlane: TestFlight Status`
- `Fastlane: Tests`
- `Fastlane: Upload Metadata & Screenshots`
- `Fastlane: Submit for App Store Review`
- `Fastlane: Full App Store Submission`

(Recommended) include a meta-task:
- `Fastlane: Beta External (Upload + Submit)` using `dependsOn`.

If you already have non-Fastlane tasks (deploy scripts, etc.), keep them alongside these.

### Concrete `tasks.json` template (recommended)
This is the set of tasks we’ve found most useful in practice. Copy into `.vscode/tasks.json` and tweak the few project-specific bits (groups/team IDs, lane names, etc.).

Notes:
- Uses `direnv` if installed; remove the `eval "$(direnv export zsh)" &&` prefix if you don’t use it.
- The “wait” task uses an app-prefixed env var (`STRIDELOG_WAIT_FOR_PROCESSING=1`) to avoid collisions; feel free to rename to `WAIT_FOR_PROCESSING=1` across repos.

```jsonc
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "📦 Fastlane: Beta Upload",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane beta",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated", "clear": true },
      "group": { "kind": "build", "isDefault": false },
      "detail": "Archives and uploads to TestFlight without waiting for processing."
    },
    {
      "label": "📦 Fastlane: Beta Upload (Wait)",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && STRIDELOG_WAIT_FOR_PROCESSING=1 bundle exec fastlane beta --verbose",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated", "clear": true },
      "group": { "kind": "build", "isDefault": true },
      "detail": "Uploads and waits for TestFlight processing to complete."
    },
    {
      "label": "🚀 Fastlane: Beta External (Submit for Review)",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane pilot distribute --distribute_external true --notify_external_testers true --groups 'Public Beta' --changelog \"New beta build available for testing\"",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated", "clear": true },
      "group": { "kind": "build", "isDefault": false },
      "detail": "Submits the latest build for External TestFlight review and notifies testers."
    },
    {
      "label": "🚀 Fastlane: Beta External (Upload + Submit)",
      "dependsOn": ["📦 Fastlane: Beta Upload (Wait)", "🚀 Fastlane: Beta External (Submit for Review)"],
      "dependsOrder": "sequence",
      "detail": "Uploads a build and then submits it for External TestFlight review."
    },
    {
      "label": "📊 Fastlane: TestFlight Status",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane tf_status",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated" },
      "group": "none",
      "detail": "Shows latest processed build info from App Store Connect."
    },
    {
      "label": "📊 Fastlane: List All TestFlight Builds",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane tf_list_all",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated" },
      "group": "none",
      "detail": "Lists all processed TestFlight builds with details."
    },
    {
      "label": "🧪 Fastlane: Tests",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane tests",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated", "clear": true },
      "group": { "kind": "test", "isDefault": false },
      "detail": "Runs unit/UI tests via Fastlane."
    },
    {
      "label": "📝 Fastlane: Upload Metadata & Screenshots",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane upload_metadata",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated", "clear": true },
      "group": "none",
      "detail": "Uploads app metadata and screenshots to App Store Connect (does not submit for review)."
    },
    {
      "label": "🏪 Fastlane: Submit for App Store Review",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane release",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated", "clear": true },
      "group": "none",
      "detail": "Submits the latest TestFlight build for App Store review (requires metadata/screenshots already uploaded)."
    },
    {
      "label": "🏪 Fastlane: Full App Store Submission",
      "type": "shell",
      "command": "eval \"$(direnv export zsh)\" && bundle exec fastlane release_full",
      "options": { "cwd": "${workspaceFolder}" },
      "presentation": { "reveal": "always", "panel": "dedicated", "clear": true },
      "group": "none",
      "detail": "Uploads metadata, screenshots, AND submits for App Store review in one step."
    }
  ]
}
```

---

## Minimal Fastfile patterns (high level)

A portable pattern that works well:

1) `maybe_setup_api_key` private lane
- If `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_KEY_PATH` exist → call `app_store_connect_api_key(...)`.
- Otherwise print a message and continue (Apple ID auth fallback).

1b) `maybe_setup_api_key_for_deliver` (recommended)
- Default to Apple ID auth for `deliver` to avoid API key permission surprises.
- Allow forcing API key usage: `DELIVER_USE_API_KEY=1`.

2) Build number strategy
Pick one per repo and document it:
- Xcode “Current Project Version” (agvtool)
- Info.plist `CFBundleVersion`
- XcodeGen `project.yml` as source-of-truth
- “remote-driven” (compare local build vs latest TestFlight build and bump accordingly)

If you use “remote-driven”, be explicit about the algorithm, e.g.:
- resolve marketing version
- fetch latest TestFlight build for that version
- set build to `max(localBuild, latestRemote + 1)`

3) `beta` lane
- build
- upload_to_testflight
- optional wait flag driven by env var

4) Metadata/submission lanes (`upload_metadata`, `release`, `release_full`)
- Consider handling common “already submitted” errors as success (keeps automation idempotent).
- If you’re on version 1.0.0, you may want to temporarily omit release notes to avoid deliver complaining.

---

## Troubleshooting

### `bundle exec fastlane` fails with Ruby errors
- Ensure you’re using a modern Ruby (via `rbenv`, `asdf`, or `ruby-install`).
- Re-run `bundle install`.

### TestFlight upload auth issues
- Prefer API key auth (ASC vars).
- If using Apple ID auth, sessions expire; refresh the session or switch to API keys.

### Xcode signing issues
- For local builds, you may need:
  - Automatic signing enabled
  - `-allowProvisioningUpdates`
  - correct `DEVELOPMENT_TEAM`

### Processing wait takes forever
- Waiting on processing can take a while (minutes to an hour). Keep the wait optional via an env var.

### `deliver` forbidden / permission errors
- If you’re using API keys for `deliver`, your key role may be too limited (often needs App Manager/Admin + app access).
- A practical default is: Apple ID auth for `deliver`, API key auth for TestFlight.
- If you want to force API key auth for `deliver`, set `DELIVER_USE_API_KEY=1`.

---

## Suggested repo checklist

- [ ] `Gemfile` pins fastlane (and you commit `Gemfile.lock`)
- [ ] `bundle install` works cleanly
- [ ] `fastlane/Fastfile` has lanes: `tests`, `beta`, `tf_status`, `tf_list_all`, `upload_metadata`, `release`, `release_full`, `archive`
- [ ] `.envrc.example` exists and is safe to commit
- [ ] `.vscode/tasks.json` includes the Fastlane tasks

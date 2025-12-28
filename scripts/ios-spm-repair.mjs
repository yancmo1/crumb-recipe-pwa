#!/usr/bin/env node
/**
 * Repair SwiftPM binary artifact issues in Xcode DerivedData.
 *
 * Symptom this targets:
 * - Xcode build fails with missing files like:
 *   .../SourcePackages/artifacts/capacitor-swift-pm/Cordova/Cordova.xcframework.zip
 *   .../SourcePackages/artifacts/capacitor-swift-pm/Capacitor/Capacitor.xcframework.zip
 *
 * Strategy:
 * - Find DerivedData folders whose info.plist WorkspacePath matches this repo's ios/App/App.xcodeproj
 * - Delete those DerivedData folders (forcing Xcode/SwiftPM to re-download/rebuild)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    dryRun: args.has('--dry-run') || args.has('-n'),
    force: args.has('--force') || args.has('-f'),
    verbose: args.has('--verbose') || args.has('-v')
  };
}

function readPlistKeyUsingPlutilPrint(plistPath, key) {
  // Note: Xcode's DerivedData info.plist can contain objects that don't round-trip
  // to JSON via `plutil -convert json`.
  const out = execFileSync('plutil', ['-p', plistPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // plutil -p output looks like:  "WorkspacePath" => "/path/to/App.xcodeproj"
  // but the string can be wrapped across lines in the output, so match across \s\S.
  const re = new RegExp(`"${key}"\\s*=>\\s*"([\\s\\S]*?)"`);
  const m = out.match(re);
  return m?.[1] ?? null;
}

function normalizeWorkspacePath(maybePath) {
  if (typeof maybePath !== 'string') return null;

  // Defensive: some tools/terminals can introduce wrapped newlines in display.
  // If a newline is *actually* present in the plist string, remove it.
  let s = maybePath.trim().replace(/[\r\n]/g, '');

  // Xcode sometimes stores file:// URLs.
  if (s.startsWith('file://')) {
    try {
      s = fileURLToPath(s);
    } catch {
      // If it's a malformed file URL, fall back to the raw string.
    }
  }

  // Resolve relative paths and then dereference symlinks where possible.
  const resolved = path.resolve(s);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function rmRf(targetPath, { dryRun, verbose }) {
  if (dryRun) {
    console.log(`[dry-run] rm -rf ${targetPath}`);
    return;
  }
  if (verbose) console.log(`rm -rf ${targetPath}`);
  fs.rmSync(targetPath, { recursive: true, force: true });
}

const { dryRun, force, verbose } = parseArgs(process.argv.slice(2));

if (!dryRun && !force) {
  console.error('Refusing to delete files without --force. Use --dry-run to preview.');
  process.exit(2);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const workspacePath = path.resolve(repoRoot, 'ios', 'App', 'App.xcodeproj');

const derivedDataRoot = path.join(os.homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData');

if (!fs.existsSync(derivedDataRoot)) {
  console.log(`No DerivedData folder found at: ${derivedDataRoot}`);
  process.exit(0);
}

const entries = fs.readdirSync(derivedDataRoot, { withFileTypes: true });
const candidateDirs = entries
  .filter((e) => e.isDirectory())
  .map((e) => path.join(derivedDataRoot, e.name));

const matches = [];
const normalizedWorkspacePath = normalizeWorkspacePath(workspacePath);
for (const ddPath of candidateDirs) {
  const infoPlist = path.join(ddPath, 'info.plist');
  if (!fs.existsSync(infoPlist)) continue;

  try {
    const ws = readPlistKeyUsingPlutilPrint(infoPlist, 'WorkspacePath');
    if (typeof ws !== 'string') continue;

    const resolvedWs = normalizeWorkspacePath(ws);
    if (!resolvedWs || !normalizedWorkspacePath) continue;

    // Accept exact match, and also accept the common cases where Xcode stores
    // a child path (e.g. ...App.xcodeproj/project.xcworkspace).
    const isMatch =
      resolvedWs === normalizedWorkspacePath ||
      resolvedWs.startsWith(normalizedWorkspacePath + path.sep) ||
      normalizedWorkspacePath.startsWith(resolvedWs + path.sep);

    if (isMatch) {
      matches.push(ddPath);
    } else if (verbose) {
      // Keep this lightweight; printing every non-match is noisy.
      // Only log obvious "App-" derived data folders.
      const base = path.basename(ddPath);
      if (base.startsWith('App-')) {
        console.warn(`Not a match: ${ddPath}`);
        console.warn(`  WorkspacePath: ${resolvedWs}`);
      }
    }
  } catch (e) {
    if (verbose) console.warn(`Skipping unreadable plist: ${infoPlist}`);
  }
}

if (matches.length === 0) {
  console.log('No matching Xcode DerivedData folders found for this project.');
  console.log(`Expected WorkspacePath: ${workspacePath}`);
  process.exit(0);
}

console.log(`Found ${matches.length} DerivedData folder(s) for this project:`);
for (const m of matches) console.log(`- ${m}`);

console.log('');
console.log(dryRun ? 'Dry run only (no changes made).' : 'Deleting…');

for (const ddPath of matches) {
  rmRf(ddPath, { dryRun, verbose });
}

console.log('');
console.log('Done. Next: open Xcode and re-build (it will re-fetch SwiftPM artifacts).');

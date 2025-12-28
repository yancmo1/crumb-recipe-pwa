#!/usr/bin/env node
/**
 * Print current Xcode DerivedData + SwiftPM artifact status for this repo.
 * Useful for "is Capacitor/Cordova artifact cache healthy right now?" checks.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function readPlistKeyUsingPlutilPrint(plistPath, key) {
  const out = execFileSync('plutil', ['-p', plistPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const re = new RegExp(`"${key}"\\s*=>\\s*"([\\s\\S]*?)"`);
  const m = out.match(re);
  return m?.[1] ?? null;
}

function normalizeWorkspacePath(maybePath) {
  if (typeof maybePath !== 'string') return null;
  let s = maybePath.trim().replace(/[\r\n]/g, '');
  if (s.startsWith('file://')) {
    try {
      s = fileURLToPath(s);
    } catch {
      // ignore
    }
  }
  const resolved = path.resolve(s);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const workspacePath = normalizeWorkspacePath(path.resolve(repoRoot, 'ios', 'App', 'App.xcodeproj'));

const derivedDataRoot = path.join(os.homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData');

if (!workspacePath) {
  console.log('Workspace path could not be resolved.');
  process.exit(1);
}

if (!fs.existsSync(derivedDataRoot)) {
  console.log(`No DerivedData folder: ${derivedDataRoot}`);
  process.exit(0);
}

const entries = fs.readdirSync(derivedDataRoot, { withFileTypes: true });
const candidateDirs = entries
  .filter((e) => e.isDirectory())
  .map((e) => path.join(derivedDataRoot, e.name));

const matches = [];
for (const ddPath of candidateDirs) {
  const infoPlist = path.join(ddPath, 'info.plist');
  if (!fs.existsSync(infoPlist)) continue;
  try {
    const rawWs = readPlistKeyUsingPlutilPrint(infoPlist, 'WorkspacePath');
    const ws = normalizeWorkspacePath(rawWs);
    if (!ws) continue;

    const isMatch = ws === workspacePath || ws.startsWith(workspacePath + path.sep);
    if (isMatch) matches.push({ ddPath, ws });
  } catch {
    // ignore
  }
}

if (matches.length === 0) {
  console.log('DerivedData: no folders found for this project.');
  console.log(`Expected WorkspacePath: ${workspacePath}`);
  process.exit(0);
}

for (const m of matches) {
  console.log(`DerivedData: ${m.ddPath}`);
  const artifactsRoot = path.join(m.ddPath, 'SourcePackages', 'artifacts', 'capacitor-swift-pm');
  const capXcframework = path.join(artifactsRoot, 'Capacitor', 'Capacitor.xcframework');
  const cordovaXcframework = path.join(artifactsRoot, 'Cordova', 'Cordova.xcframework');

  const capZip = path.join(artifactsRoot, 'Capacitor', 'Capacitor.xcframework.zip');
  const cordovaZip = path.join(artifactsRoot, 'Cordova', 'Cordova.xcframework.zip');

  const exists = (p) => (fs.existsSync(p) ? 'yes' : 'no');

  console.log(`  capacitor-swift-pm artifacts root: ${exists(artifactsRoot)} (${artifactsRoot})`);
  console.log(`  Capacitor.xcframework: ${exists(capXcframework)}`);
  console.log(`  Cordova.xcframework:   ${exists(cordovaXcframework)}`);
  console.log(`  Capacitor.xcframework.zip: ${exists(capZip)}`);
  console.log(`  Cordova.xcframework.zip:   ${exists(cordovaZip)}`);
}

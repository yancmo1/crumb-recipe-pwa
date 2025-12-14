// Simple smoke test for local dev.
// - Confirms Vite dev server is reachable
// - Confirms backend health is reachable directly (default :3000)
// - Confirms /api/health works through Vite proxy (frontend -> backend)
//
// Usage:
//   node scripts/dev-smoke.mjs
//
// Exit codes:
//   0 = ok
//   1 = failed

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_INTERVAL_MS = 1_250;

const viteBase = process.env.SMOKE_VITE_BASE || 'http://localhost:5173';
// Prefer the same backend base that Vite proxies to, if it's configured.
// This avoids false negatives when the API isn't on :3000 (e.g. Docker/dev overrides).
const apiBaseDirect =
  process.env.SMOKE_API_BASE ||
  process.env.VITE_API_PROXY_TARGET ||
  'http://127.0.0.1:3000';

const targets = [
  { name: 'vite', url: `${viteBase}/` },
  { name: 'api-direct', url: `${apiBaseDirect}/health` },
  { name: 'api-via-vite-proxy', url: `${viteBase}/api/health` },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkOnce(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    // Vite returns HTML (200), health returns JSON (200)
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function waitForAll({ timeoutMs, intervalMs }) {
  const start = Date.now();
  const last = new Map();

  while (Date.now() - start < timeoutMs) {
    let okCount = 0;

    for (const t of targets) {
      const r = await checkOnce(t.url);
      last.set(t.name, r);
      if (r.ok) okCount++;
    }

    if (okCount === targets.length) {
      return { ok: true };
    }

    await sleep(intervalMs);
  }

  const summary = {};
  for (const [name, result] of last.entries()) summary[name] = result;
  return { ok: false, summary };
}

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
const intervalMs = Number(process.env.SMOKE_INTERVAL_MS || DEFAULT_INTERVAL_MS);

console.log('Dev smoke test: waiting for services...');
console.log(`- Vite: ${viteBase}`);
console.log(`- API:  ${apiBaseDirect}`);

const result = await waitForAll({ timeoutMs, intervalMs });

if (result.ok) {
  console.log('✓ Dev smoke test passed');
  process.exit(0);
}

console.error('✗ Dev smoke test failed (timed out)');
console.error(JSON.stringify(result.summary, null, 2));
process.exit(1);

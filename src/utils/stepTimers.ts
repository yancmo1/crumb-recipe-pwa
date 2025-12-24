export type ExtractedDuration = {
  /** Total seconds represented by this duration expression. */
  seconds: number;
  /** Human-friendly label (e.g., "30 min", "1 hr 30 min"). */
  label: string;
  /** The exact snippet from the instruction text that was parsed. */
  source: string;
  /** Character offsets in the original instruction string. */
  startIndex: number;
  endIndex: number;
};

type Unit = 'h' | 'm' | 's';

type UnitMatch = {
  value: number;
  unit: Unit;
  startIndex: number;
  endIndex: number;
};

const UNIT_REGEX = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi;

function normalizeUnit(u: string): Unit | null {
  const unit = u.toLowerCase();
  if (unit === 'h' || unit === 'hr' || unit === 'hrs' || unit === 'hour' || unit === 'hours') return 'h';
  if (unit === 'm' || unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes') return 'm';
  if (unit === 's' || unit === 'sec' || unit === 'secs' || unit === 'second' || unit === 'seconds') return 's';
  return null;
}

function unitToSeconds(unit: Unit): number {
  if (unit === 'h') return 60 * 60;
  if (unit === 'm') return 60;
  return 1;
}

function isJoinerText(textBetween: string): boolean {
  // Allow common joiners between units: whitespace, punctuation, "and"
  // Examples: "1 hour 30 minutes", "1 hr and 30 min", "1h 30m"
  const t = textBetween.trim().toLowerCase();
  if (!t) return true;
  if (t === 'and') return true;
  if (/^[,;/\-–—]+$/.test(t)) return true;
  // "and" with punctuation/whitespace
  if (/^,?\s*and\s*,?$/.test(t)) return true;
  return false;
}

function buildLabel(parts: Array<{ value: number; unit: Unit }>): string {
  const out: string[] = [];
  for (const p of parts) {
    const v = Number.isInteger(p.value) ? String(p.value) : String(p.value);
    if (p.unit === 'h') out.push(`${v} hr`);
    if (p.unit === 'm') out.push(`${v} min`);
    if (p.unit === 's') out.push(`${v} sec`);
  }
  return out.join(' ');
}

/**
 * Extract timer durations from a single instruction step.
 *
 * - Supports: "30 minutes", "1 hr 30 min", "1.5 hours", "45 sec".
 * - Combines adjacent unit expressions when they form a single time span.
 * - Does not match bare numbers (so step-number lines like "5" are ignored).
 */
export function extractDurationsFromInstruction(step: string): ExtractedDuration[] {
  const text = String(step ?? '');
  const matches: UnitMatch[] = [];

  for (const m of text.matchAll(UNIT_REGEX)) {
    const rawValue = m[1];
    const rawUnit = m[2];
    const unit = normalizeUnit(rawUnit);
    if (!unit) continue;

    const value = Number.parseFloat(rawValue);
    if (!Number.isFinite(value) || value <= 0) continue;

    const startIndex = m.index ?? 0;
    const endIndex = startIndex + m[0].length;

    matches.push({ value, unit, startIndex, endIndex });
  }

  if (matches.length === 0) return [];

  // Combine sequential matches into composite durations when separated by joiners.
  const combined: Array<{ parts: Array<{ value: number; unit: Unit }>; startIndex: number; endIndex: number }> = [];

  let i = 0;
  while (i < matches.length) {
    const first = matches[i];
    const parts: Array<{ value: number; unit: Unit }> = [{ value: first.value, unit: first.unit }];
    let startIndex = first.startIndex;
    let endIndex = first.endIndex;

    let j = i + 1;
    while (j < matches.length) {
      const prev = matches[j - 1];
      const next = matches[j];
      const between = text.slice(prev.endIndex, next.startIndex);

      // Only merge if the text between is a joiner and the unit ordering makes sense.
      // We allow h -> m -> s, and m -> s.
      const lastUnit = parts[parts.length - 1].unit;
      const canFollow =
        (lastUnit === 'h' && (next.unit === 'm' || next.unit === 's')) ||
        (lastUnit === 'm' && next.unit === 's');

      if (!canFollow) break;
      if (!isJoinerText(between)) break;

      parts.push({ value: next.value, unit: next.unit });
      endIndex = next.endIndex;
      j += 1;
    }

    combined.push({ parts, startIndex, endIndex });
    i = j;
  }

  return combined
    .map((c) => {
      const seconds = c.parts.reduce((sum, p) => sum + p.value * unitToSeconds(p.unit), 0);
      const roundedSeconds = Math.round(seconds);
      const source = text.slice(c.startIndex, c.endIndex);
      return {
        seconds: Math.max(1, roundedSeconds),
        label: buildLabel(c.parts),
        source,
        startIndex: c.startIndex,
        endIndex: c.endIndex
      } satisfies ExtractedDuration;
    })
    .filter((d) => Number.isFinite(d.seconds) && d.seconds > 0);
}

export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!h && !m) parts.push(`${sec}s`);
  return parts.join(' ');
}

export function formatDurationClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');

  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }

  return `${m}:${ss.padStart(2, '0')}`;
}

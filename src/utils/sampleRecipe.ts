import type { Recipe } from '../types';

function createId(): string {
  const c = typeof crypto !== 'undefined' ? (crypto as Crypto | undefined) : undefined;
  // iOS 16+ has crypto.randomUUID.
  if (c && 'randomUUID' in c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `r_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function createSampleRecipe(nowMs: number = Date.now()): Recipe {
  return {
    id: createId(),
    title: 'Skillet Toast (Sample)',
    sourceUrl: 'https://crumb.app/sample/skillet-toast',
    sourceName: 'Crumb Sample',
    category: 'Breakfast',
    yield: '1 toast',
    times: { prep: 1, cook: 6, total: 7 },
    ingredients: [
      { isGroupHeader: true, raw: '**Ingredients:**' },
      { raw: '1 slice bread', amount: 1, unit: 'slice', item: 'bread' },
      { raw: '1 tbsp butter', amount: 1, unit: 'tbsp', item: 'butter' },
      { raw: 'Pinch salt', item: 'salt', note: 'optional' }
    ],
    steps: [
      '**Cook:**',
      'Heat a skillet over medium. Melt the butter.',
      'Toast the bread 2 minutes per side.',
      'Rest for 1 minute, then serve.'
    ],
    tips: ['This sample recipe exists so you can test timers + Live Activities offline.'],
    createdAt: nowMs,
    updatedAt: nowMs
  };
}

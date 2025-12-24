import { LiveActivities } from 'capacitor-live-activities';
import type { LayoutElement, LiveActivitiesOptions } from 'capacitor-live-activities';

import { isNativePlatform } from './nativeLocalNotifications';

export type TimerLiveActivityInput = {
  recipeTitle: string;
  stepIndex: number;
  stepText: string;
  endTimeMs: number;
  widgetUrl: string;
};

function buildTimerLiveActivityOptions(input: TimerLiveActivityInput): LiveActivitiesOptions {
  const title = input.recipeTitle || 'Crumb';
  const stepLabel = `Step ${input.stepIndex + 1}`;
  const snippet = String(input.stepText || '').trim().slice(0, 120);

  const mainChildren: LayoutElement[] = [
    {
      type: 'text',
      properties: [
        { text: title },
        { fontSize: 12 },
        { fontWeight: 'semibold' },
        { color: '#FFFFFF' },
        { opacity: 0.9 }
      ]
    },
    {
      type: 'text',
      properties: [{ text: stepLabel }, { fontSize: 12 }, { color: '#8E8E93' }]
    },
    {
      type: 'timer',
      properties: [
        { endTime: input.endTimeMs },
        { style: 'timer' },
        { fontSize: 22 },
        { fontWeight: 'bold' },
        { color: '#FFFFFF' },
        { alignment: 'center' },
        { monospacedDigit: true }
      ]
    }
  ];

  if (snippet) {
    mainChildren.push({
      type: 'text',
      properties: [{ text: snippet }, { fontSize: 11 }, { color: '#8E8E93' }, { lineLimit: 2 }]
    });
  }

  return {
    layout: {
      type: 'container',
      properties: [
        { direction: 'vertical' },
        { spacing: 8 },
        { padding: 16 },
        { backgroundColor: '#1C1C1E' },
        { cornerRadius: 14 }
      ],
      children: mainChildren
    },

    dynamicIslandLayout: {
      expanded: {
        leading: {
          type: 'image',
          properties: [{ systemName: 'timer' }, { width: 20 }, { height: 20 }, { color: '#FFFFFF' }]
        },
        trailing: {
          type: 'timer',
          properties: [
            { endTime: input.endTimeMs },
            { style: 'timer' },
            { fontSize: 12 },
            { fontWeight: 'bold' },
            { color: '#FFFFFF' },
            { monospacedDigit: true }
          ]
        },
        center: {
          type: 'text',
          properties: [{ text: stepLabel }, { fontSize: 11 }, { fontWeight: 'medium' }, { color: '#FFFFFF' }]
        },
        bottom: {
          type: 'text',
          properties: [{ text: title }, { fontSize: 12 }, { color: '#8E8E93' }]
        }
      },
      compactLeading: {
        type: 'image',
        properties: [{ systemName: 'timer' }, { width: 16 }, { height: 16 }, { color: '#FFFFFF' }]
      },
      compactTrailing: {
        type: 'timer',
        properties: [
          { endTime: input.endTimeMs },
          { style: 'timer' },
          { fontSize: 12 },
          { fontWeight: 'bold' },
          { color: '#FFFFFF' },
          { monospacedDigit: true }
        ]
      },
      minimal: {
        type: 'image',
        properties: [{ systemName: 'timer' }, { width: 12 }, { height: 12 }, { color: '#FFFFFF' }]
      }
    },

    behavior: {
      widgetUrl: input.widgetUrl,
      systemActionForegroundColor: '#34C759',
      keyLineTint: '#34C759'
    },

    data: {
      title,
      stepLabel,
      snippet,
      endTimeMs: input.endTimeMs
    },

    staleDate: input.endTimeMs + 5 * 60 * 1000
  };
}

export async function startTimerLiveActivity(input: TimerLiveActivityInput): Promise<string | null> {
  if (!isNativePlatform()) return null;

  const options = buildTimerLiveActivityOptions(input);
  const result = await LiveActivities.startActivity(options);
  return result.activityId;
}

export async function endTimerLiveActivity(activityId: string): Promise<void> {
  if (!isNativePlatform()) return;
  await LiveActivities.endActivity({
    activityId,
    data: { endedAt: Date.now() }
  });
}

import { isNativePlatform } from './nativeLocalNotifications';
import { registerPlugin } from '@capacitor/core';

export type TimerLiveActivityInput = {
  recipeTitle: string;
  stepIndex: number;
  stepText: string;
  endTimeMs: number;
  widgetUrl: string;
  imageUrl?: string;
};

type LiveActivitiesPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  startTimer(options: {
    recipeTitle: string;
    stepIndex: number;
    stepText: string;
    endTimeMs: number;
    widgetUrl?: string;
    imageUrl?: string;
  }): Promise<{ activityId: string | null }>;
  endTimer(options: { activityId: string }): Promise<void>;
  endAll(): Promise<void>;
};

const LiveActivities = registerPlugin<LiveActivitiesPlugin>('LiveActivities');

export async function startTimerLiveActivity(input: TimerLiveActivityInput): Promise<string | null> {
  if (!isNativePlatform()) return null;

  try {
    const support = await LiveActivities.isSupported();
    if (!support.supported) return null;

    const imageUrl = (() => {
      if (!input.imageUrl) return undefined;
      if (/^https?:\/\//i.test(input.imageUrl)) return input.imageUrl;
      return undefined;
    })();

    const res = await LiveActivities.startTimer({
      recipeTitle: input.recipeTitle,
      stepIndex: input.stepIndex,
      stepText: input.stepText,
      endTimeMs: input.endTimeMs,
      widgetUrl: input.widgetUrl,
      imageUrl
    });

    return res.activityId ?? null;
  } catch {
    return null;
  }
}

export async function endTimerLiveActivity(activityId: string): Promise<void> {
  if (!isNativePlatform()) return;

  if (!activityId) return;

  try {
    await LiveActivities.endTimer({ activityId });
  } catch {
    // ignore
  }
}

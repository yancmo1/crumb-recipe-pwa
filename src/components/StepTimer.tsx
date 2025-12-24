import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { extractDurationsFromInstruction, formatDurationClock, formatDurationShort } from '../utils/stepTimers';
import { ensureNotificationPermission, showTimerNotification } from '../utils/notifications';
import { cancelScheduledPush, schedulePush } from '../utils/push';
import { cancelServiceWorkerTimer, scheduleServiceWorkerTimer } from '../utils/serviceWorkerTimers';

type TimerState = {
  isRunning: boolean;
  remainingSeconds: number;
  endAtMs?: number;
};

function useCountdownTimer(initialSeconds: number, onComplete?: () => void) {
  const [state, setState] = useState<TimerState>(() => ({
    isRunning: false,
    remainingSeconds: Math.max(1, Math.round(initialSeconds))
  }));

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // If initialSeconds changes, reset to match.
    setState({ isRunning: false, remainingSeconds: Math.max(1, Math.round(initialSeconds)) });
  }, [initialSeconds]);

  useEffect(() => {
    if (!state.isRunning || !state.endAtMs) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.endAtMs! - Date.now()) / 1000));
      setState((prev) => {
        if (!prev.isRunning || !prev.endAtMs) return prev;
        return { ...prev, remainingSeconds: remaining };
      });

      if (remaining <= 0) {
        setState((prev) => ({ ...prev, isRunning: false, endAtMs: undefined, remainingSeconds: 0 }));
        onCompleteRef.current?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state.isRunning, state.endAtMs]);

  const start = () => {
    setState((prev) => {
      if (prev.isRunning) return prev;
      const remaining = prev.remainingSeconds > 0 ? prev.remainingSeconds : Math.max(1, Math.round(initialSeconds));
      return {
        isRunning: true,
        remainingSeconds: remaining,
        endAtMs: Date.now() + remaining * 1000
      };
    });
  };

  const pause = () => {
    setState((prev) => {
      if (!prev.isRunning || !prev.endAtMs) return { ...prev, isRunning: false, endAtMs: undefined };
      const remaining = Math.max(0, Math.ceil((prev.endAtMs - Date.now()) / 1000));
      return { isRunning: false, endAtMs: undefined, remainingSeconds: remaining };
    });
  };

  const reset = () => {
    setState({ isRunning: false, endAtMs: undefined, remainingSeconds: Math.max(1, Math.round(initialSeconds)) });
  };

  return { state, start, pause, reset };
}

export function StepTimers({
  stepText,
  onTimerComplete
}: {
  stepText: string;
  onTimerComplete?: (label: string) => void;
}) {
  const durations = useMemo(() => extractDurationsFromInstruction(stepText), [stepText]);

  if (durations.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2 no-print">
      {durations.map((d, idx) => (
        <SingleTimer
          key={`${d.startIndex}-${d.endIndex}-${idx}`}
          seconds={d.seconds}
          label={d.label || formatDurationShort(d.seconds)}
          stepText={stepText}
          onComplete={() => onTimerComplete?.(d.label || formatDurationShort(d.seconds))}
        />
      ))}
    </div>
  );
}

function SingleTimer({
  seconds,
  label,
  stepText,
  onComplete
}: {
  seconds: number;
  label: string;
  stepText: string;
  onComplete?: () => void;
}) {
  const scheduledPushIdRef = useRef<string | null>(null);
  const scheduledSWTimerIdRef = useRef<string | null>(null);

  const handleComplete = () => {
    onComplete?.();

    // Show in-app notification only if no background notification was scheduled
    if (!scheduledPushIdRef.current && !scheduledSWTimerIdRef.current) {
      void showTimerNotification({
        title: 'Timer done',
        body: `${label} • ${String(stepText).trim().slice(0, 120)}`,
        tag: `crumb-step-timer-${Date.now()}`
      });
    } else {
      // Cancel any pending schedules
      if (scheduledPushIdRef.current) {
        const id = scheduledPushIdRef.current;
        scheduledPushIdRef.current = null;
        void cancelScheduledPush(id).catch(() => {});
      }
      if (scheduledSWTimerIdRef.current) {
        const id = scheduledSWTimerIdRef.current;
        scheduledSWTimerIdRef.current = null;
        void cancelServiceWorkerTimer(id).catch(() => {});
      }
    }
  };

  const { state, start, pause, reset } = useCountdownTimer(seconds, handleComplete);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (scheduledPushIdRef.current) {
        void cancelScheduledPush(scheduledPushIdRef.current).catch(() => {});
      }
      if (scheduledSWTimerIdRef.current) {
        void cancelServiceWorkerTimer(scheduledSWTimerIdRef.current).catch(() => {});
      }
    };
  }, []);

  const handleStart = async () => {
    await ensureNotificationPermission();

    const remaining = state.remainingSeconds > 0 ? state.remainingSeconds : seconds;
    const fireAtMs = Date.now() + remaining * 1000;
    const notificationPayload = {
      title: 'Timer done',
      body: `${label} • ${String(stepText).trim().slice(0, 120)}`,
      tag: `crumb-step-timer-${Date.now()}`,
      url: typeof location !== 'undefined' ? location.href : '/'
    };

    // Try server-side Web Push first
    try {
      const pushId = await schedulePush({
        fireAtMs,
        payload: notificationPayload
      });
      scheduledPushIdRef.current = pushId;
    } catch {
      // Fall back to service worker timer
      scheduledPushIdRef.current = null;
      try {
        const swTimerId = await scheduleServiceWorkerTimer(fireAtMs, notificationPayload);
        scheduledSWTimerIdRef.current = swTimerId;
      } catch {
        scheduledSWTimerIdRef.current = null;
      }
    }

    start();
  };

  const handlePause = () => {
    if (scheduledPushIdRef.current) {
      void cancelScheduledPush(scheduledPushIdRef.current).catch(() => {});
      scheduledPushIdRef.current = null;
    }
    if (scheduledSWTimerIdRef.current) {
      void cancelServiceWorkerTimer(scheduledSWTimerIdRef.current).catch(() => {});
      scheduledSWTimerIdRef.current = null;
    }
    pause();
  };

  const handleReset = () => {
    if (scheduledPushIdRef.current) {
      void cancelScheduledPush(scheduledPushIdRef.current).catch(() => {});
      scheduledPushIdRef.current = null;
    }
    if (scheduledSWTimerIdRef.current) {
      void cancelServiceWorkerTimer(scheduledSWTimerIdRef.current).catch(() => {});
      scheduledSWTimerIdRef.current = null;
    }
    reset();
  };

  const display = state.isRunning || state.remainingSeconds !== seconds
    ? formatDurationClock(state.remainingSeconds)
    : label;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm">
      <Timer className="h-4 w-4 text-gray-500" />
      <span className="font-medium text-gray-800 tabular-nums">{display}</span>

      <div className="flex items-center gap-1">
        {!state.isRunning ? (
          <button
            type="button"
            onClick={handleStart}
            className="rounded-full p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Start timer"
            title="Start"
          >
            <Play className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="rounded-full p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Pause timer"
            title="Pause"
          >
            <Pause className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="rounded-full p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          aria-label="Reset timer"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

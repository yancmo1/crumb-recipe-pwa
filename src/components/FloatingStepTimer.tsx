import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Edit3, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { ensureNotificationPermission, showTimerNotification } from '../utils/notifications';
import {
  cancelNativeTimerNotification,
  isNativePlatform,
  NATIVE_TIMER_NOTIFICATION_ID,
  scheduleNativeTimerNotification
} from '../utils/nativeLocalNotifications';
import { endTimerLiveActivity, startTimerLiveActivity } from '../utils/liveActivities';
import { cancelScheduledPush, schedulePush } from '../utils/push';
import { cancelServiceWorkerTimer, scheduleServiceWorkerTimer } from '../utils/serviceWorkerTimers';
import {
  extractDurationsFromInstruction,
  formatDurationClock,
  formatDurationHuman,
  formatSecondsAsEditableValue,
  parseEditableDurationToSeconds
} from '../utils/stepTimers';

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

export function FloatingStepTimer({
  recipeTitle,
  recipeImageUrl,
  stepIndex,
  stepText,
  enabled,
  onTimerComplete
}: {
  recipeTitle: string;
  /** Optional recipe image URL (ideally https://...) used for Live Activities thumbnail */
  recipeImageUrl?: string;
  /** 0-based index into recipe.steps */
  stepIndex: number;
  stepText: string;
  /** Show/hide the widget depending on whether a cooking session is active */
  enabled: boolean;
  onTimerComplete?: (seconds: number) => void;
}) {
  const detected = useMemo(() => {
    const durations = extractDurationsFromInstruction(stepText);
    return durations.length ? durations[0].seconds : null;
  }, [stepText]);

  const [configuredByStep, setConfiguredByStep] = useState<Record<number, number>>({});

  const defaultSeconds = useMemo(() => {
    const fromEdited = configuredByStep[stepIndex];
    if (typeof fromEdited === 'number' && Number.isFinite(fromEdited) && fromEdited > 0) return fromEdited;
    if (typeof detected === 'number' && detected > 0) return detected;
    // If no time detected in the step, default to 5 minutes.
    return 5 * 60;
  }, [configuredByStep, detected, stepIndex]);

  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Track scheduled background notifications (server push or service worker timer)
  const scheduledNativeIdRef = useRef<number | null>(null);
  const scheduledPushIdRef = useRef<string | null>(null);
  const scheduledSWTimerIdRef = useRef<string | null>(null);
  const liveActivityIdRef = useRef<string | null>(null);

  const { state, start, pause, reset } = useCountdownTimer(defaultSeconds, () => {
    onTimerComplete?.(defaultSeconds);

    // If we scheduled a background notification, it may have already fired or will fire soon.
    // Show in-app notification only if no background notification was scheduled.
    if (!scheduledNativeIdRef.current && !scheduledPushIdRef.current && !scheduledSWTimerIdRef.current) {
      void showTimerNotification({
        title: `Timer done • ${recipeTitle}`,
        body: `Step ${stepIndex + 1}: ${formatDurationHuman(defaultSeconds)} finished\n${String(stepText).trim().slice(0, 120)}`,
        tag: `crumb-floating-${stepIndex}`
      });
    } else {
      // Best-effort: cancel any still-pending schedules (they may already have fired).
      if (scheduledNativeIdRef.current) {
        const id = scheduledNativeIdRef.current;
        scheduledNativeIdRef.current = null;
        void cancelNativeTimerNotification(id).catch(() => {
          // ignore
        });
      }
      if (scheduledPushIdRef.current) {
        const id = scheduledPushIdRef.current;
        scheduledPushIdRef.current = null;
        void cancelScheduledPush(id).catch(() => {
          // ignore
        });
      }
      if (scheduledSWTimerIdRef.current) {
        const id = scheduledSWTimerIdRef.current;
        scheduledSWTimerIdRef.current = null;
        void cancelServiceWorkerTimer(id).catch(() => {
          // ignore
        });
      }
    }

    // Live Activity should be ended once the timer completes.
    if (liveActivityIdRef.current) {
      const id = liveActivityIdRef.current;
      liveActivityIdRef.current = null;
      void endTimerLiveActivity(id).catch(() => {
        // ignore
      });
    }
  });

  // If we switch steps while editing, close editor.
  useEffect(() => {
    setIsEditing(false);
    // Keep the widget collapsed when advancing steps (less visual jumpiness).
    setIsExpanded(false);

    // If the step changes, the timer's meaning changes too. Cancel any pending notifications.
    const nativeId = scheduledNativeIdRef.current;
    const pushId = scheduledPushIdRef.current;
    const swTimerId = scheduledSWTimerIdRef.current;
    const activityId = liveActivityIdRef.current;
    if (nativeId) {
      scheduledNativeIdRef.current = null;
      void cancelNativeTimerNotification(nativeId).catch(() => {
        // ignore
      });
    }
    if (pushId) {
      scheduledPushIdRef.current = null;
      void cancelScheduledPush(pushId).catch(() => {
        // ignore
      });
    }
    if (swTimerId) {
      scheduledSWTimerIdRef.current = null;
      void cancelServiceWorkerTimer(swTimerId).catch(() => {
        // ignore
      });
    }

    if (activityId) {
      liveActivityIdRef.current = null;
      void endTimerLiveActivity(activityId).catch(() => {
        // ignore
      });
    }
  }, [stepIndex]);

  // On unmount, cancel any pending schedules.
  useEffect(() => {
    return () => {
      const nativeId = scheduledNativeIdRef.current;
      const pushId = scheduledPushIdRef.current;
      const swTimerId = scheduledSWTimerIdRef.current;
      const activityId = liveActivityIdRef.current;
      if (nativeId) {
        scheduledNativeIdRef.current = null;
        void cancelNativeTimerNotification(nativeId).catch(() => {
          // ignore
        });
      }
      if (pushId) {
        scheduledPushIdRef.current = null;
        void cancelScheduledPush(pushId).catch(() => {
          // ignore
        });
      }
      if (swTimerId) {
        scheduledSWTimerIdRef.current = null;
        void cancelServiceWorkerTimer(swTimerId).catch(() => {
          // ignore
        });
      }

      if (activityId) {
        liveActivityIdRef.current = null;
        void endTimerLiveActivity(activityId).catch(() => {
          // ignore
        });
      }
    };
  }, []);

  if (!enabled) return null;

  const snippet = String(stepText || '').trim();

  const bubbleTime = state.isRunning ? state.remainingSeconds : defaultSeconds;
  const bubbleLabel = formatDurationClock(bubbleTime);

  return (
    <>
      <div className="fixed right-4 bottom-24 z-40 no-print">
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="h-14 w-14 rounded-full shadow-lg border border-gray-200 bg-white flex flex-col items-center justify-center"
            aria-label="Open timer"
            title="Open timer"
          >
            <Timer className={`h-5 w-5 ${state.isRunning ? 'text-sage' : 'text-gray-600'}`} />
            <span className="mt-0.5 text-[11px] font-mono tabular-nums text-gray-900">
              {bubbleLabel}
            </span>
          </button>
        ) : (
          <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-500">Step {stepIndex + 1}</div>
                    {!detected && (
                      <span className="text-[11px] text-gray-500">no time detected</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 truncate">{formatDurationHuman(defaultSeconds)}</div>
                  {snippet && (
                    <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                      {snippet}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="rounded-full p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    aria-label="Minimize timer"
                    title="Minimize"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-full p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    aria-label="Edit timer"
                    title="Edit"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>

                  {!state.isRunning ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const remaining = state.remainingSeconds > 0 ? state.remainingSeconds : defaultSeconds;
                        const fireAtMs = Date.now() + remaining * 1000;
                        const notificationPayload = {
                          title: `Timer done • ${recipeTitle}`,
                          body: `Step ${stepIndex + 1}: ${formatDurationHuman(remaining)} finished\n${String(stepText).trim().slice(0, 120)}`,
                          tag: `crumb-floating-${stepIndex}`,
                          url: typeof location !== 'undefined' ? location.href : '/'
                        };

                        // Prefer native local notifications when running inside Capacitor.
                        if (isNativePlatform()) {
                          try {
                            const id = await scheduleNativeTimerNotification({
                              id: NATIVE_TIMER_NOTIFICATION_ID,
                              fireAtMs,
                              title: notificationPayload.title,
                              body: notificationPayload.body
                            });
                            scheduledNativeIdRef.current = id;
                            scheduledPushIdRef.current = null;
                            scheduledSWTimerIdRef.current = null;
                          } catch {
                            scheduledNativeIdRef.current = null;
                          }

                          // Start a Live Activity (Dynamic Island) for iOS 16.1+ devices.
                          try {
                            if (liveActivityIdRef.current) {
                              const prevId = liveActivityIdRef.current;
                              liveActivityIdRef.current = null;
                              await endTimerLiveActivity(prevId);
                            }
                            const activityId = await startTimerLiveActivity({
                              recipeTitle,
                              stepIndex,
                              stepText,
                              endTimeMs: fireAtMs,
                              widgetUrl: `crumb://timer?step=${stepIndex + 1}`,
                              imageUrl: recipeImageUrl
                            });
                            liveActivityIdRef.current = activityId;
                          } catch {
                            liveActivityIdRef.current = null;
                          }
                        }

                        // Web fallback: try server-side Web Push first.
                        if (!scheduledNativeIdRef.current) {
                          await ensureNotificationPermission();

                          try {
                            const pushId = await schedulePush({
                              fireAtMs,
                              payload: notificationPayload
                            });
                            scheduledPushIdRef.current = pushId;
                            scheduledSWTimerIdRef.current = null;
                          } catch {
                            // Server push not available (no VAPID keys or server not configured).
                            // Fall back to service worker timer (works for shorter timers, may not survive device sleep).
                            scheduledPushIdRef.current = null;
                            try {
                              const swTimerId = await scheduleServiceWorkerTimer(fireAtMs, notificationPayload);
                              scheduledSWTimerIdRef.current = swTimerId;
                            } catch {
                              scheduledSWTimerIdRef.current = null;
                              // Neither method available; in-app notification will still work if app stays open.
                            }
                          }
                        }

                        start();
                      }}
                      className="rounded-full p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      aria-label="Start timer"
                      title="Start"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const nativeId = scheduledNativeIdRef.current;
                        const pushId = scheduledPushIdRef.current;
                        const swTimerId = scheduledSWTimerIdRef.current;
                        const activityId = liveActivityIdRef.current;
                        if (nativeId) {
                          scheduledNativeIdRef.current = null;
                          void cancelNativeTimerNotification(nativeId).catch(() => {
                            // ignore
                          });
                        }
                        if (pushId) {
                          scheduledPushIdRef.current = null;
                          void cancelScheduledPush(pushId).catch(() => {
                            // ignore
                          });
                        }
                        if (swTimerId) {
                          scheduledSWTimerIdRef.current = null;
                          void cancelServiceWorkerTimer(swTimerId).catch(() => {
                            // ignore
                          });
                        }

                        if (activityId) {
                          liveActivityIdRef.current = null;
                          void endTimerLiveActivity(activityId).catch(() => {
                            // ignore
                          });
                        }
                        pause();
                      }}
                      className="rounded-full p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      aria-label="Pause timer"
                      title="Pause"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const nativeId = scheduledNativeIdRef.current;
                      const pushId = scheduledPushIdRef.current;
                      const swTimerId = scheduledSWTimerIdRef.current;
                      const activityId = liveActivityIdRef.current;
                      if (nativeId) {
                        scheduledNativeIdRef.current = null;
                        void cancelNativeTimerNotification(nativeId).catch(() => {
                          // ignore
                        });
                      }
                      if (pushId) {
                        scheduledPushIdRef.current = null;
                        void cancelScheduledPush(pushId).catch(() => {
                          // ignore
                        });
                      }
                      if (swTimerId) {
                        scheduledSWTimerIdRef.current = null;
                        void cancelServiceWorkerTimer(swTimerId).catch(() => {
                          // ignore
                        });
                      }

                      if (activityId) {
                        liveActivityIdRef.current = null;
                        void endTimerLiveActivity(activityId).catch(() => {
                          // ignore
                        });
                      }
                      reset();
                    }}
                    className="rounded-full p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    aria-label="Reset timer"
                    title="Reset"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-gray-500" />
                  <span className="font-mono text-sm tabular-nums text-gray-900">
                    {state.isRunning ? formatDurationClock(state.remainingSeconds) : formatDurationClock(defaultSeconds)}
                  </span>
                </div>
                {state.isRunning && (
                  <span className="text-[11px] text-sage font-medium">running</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditing && (
        <DurationEditor
          initialSeconds={defaultSeconds}
          onCancel={() => setIsEditing(false)}
          onSave={(seconds) => {
            setConfiguredByStep((prev) => ({ ...prev, [stepIndex]: seconds }));
            setIsEditing(false);
          }}
        />
      )}
    </>
  );
}

function DurationEditor({
  initialSeconds,
  onCancel,
  onSave
}: {
  initialSeconds: number;
  onCancel: () => void;
  onSave: (seconds: number) => void;
}) {
  const [value, setValue] = useState(() => formatSecondsAsEditableValue(initialSeconds));
  const [replaceAllOnNextKey, setReplaceAllOnNextKey] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseEditableDurationToSeconds(value), [value]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const applyKey = (key: string) => {
    setValue((prev) => {
      const current = replaceAllOnNextKey ? '' : prev;
      let next = current;

      if (key === 'clear') return '';
      if (key === 'back') return current.length ? current.slice(0, -1) : '';

      if (key === ':') {
        if (next.includes(':')) return next;
        if (!next.length) return '0:';
        return `${next}:`;
      }

      if (/^[0-9]$/.test(key)) {
        if (next.includes(':')) {
          const [h, m = ''] = next.split(':');
          if (m.length >= 2) return next;
          return `${h}:${m}${key}`;
        }
        if (next.length >= 5) return next;
        return `${next}${key}`;
      }

      return next;
    });

    setReplaceAllOnNextKey(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        aria-label="Close timer editor"
      />

      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Edit timer</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-600 mb-1">Minutes (e.g., 200) or H:MM (e.g., 2:30)</label>
          <input
            ref={inputRef}
            value={value}
            readOnly
            onFocus={() => {
              setReplaceAllOnNextKey(true);
              inputRef.current?.select();
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono text-lg tracking-wide"
            inputMode="none"
            aria-label="Timer duration input"
          />
          {!parsed.ok && value.trim().length > 0 && (
            <div className="text-sm text-red-600 mt-1">Enter minutes or H:MM</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {['1','2','3','4','5','6','7','8','9',':','0','back'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => applyKey(k)}
              className="h-12 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 font-semibold hover:bg-gray-100 active:bg-gray-200"
            >
              {k === 'back' ? '⌫' : k}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setValue(formatSecondsAsEditableValue(initialSeconds));
              setReplaceAllOnNextKey(true);
              inputRef.current?.focus();
              inputRef.current?.select();
            }}
            className="flex-1 h-11 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              if (!parsed.ok) return;
              onSave(parsed.seconds);
            }}
            disabled={!parsed.ok}
            className="flex-1 h-11 rounded-lg bg-blueberry text-white hover:bg-blueberry/90 disabled:opacity-50 disabled:hover:bg-blueberry"
          >
            Save
          </button>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              setValue('');
              setReplaceAllOnNextKey(true);
              inputRef.current?.focus();
              inputRef.current?.select();
            }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

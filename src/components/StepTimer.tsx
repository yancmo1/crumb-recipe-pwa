import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { extractDurationsFromInstruction, formatDurationClock, formatDurationShort } from '../utils/stepTimers';

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
    // If initialSeconds changes (rare, but possible), reset to match.
    setState({ isRunning: false, remainingSeconds: Math.max(1, Math.round(initialSeconds)) });
  }, [initialSeconds]);

  useEffect(() => {
    if (!state.isRunning || !state.endAtMs) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.endAtMs! - Date.now()) / 1000));
      setState((prev) => {
        // If we were paused/reset between scheduling and running, don't clobber.
        if (!prev.isRunning || !prev.endAtMs) return prev;
        return { ...prev, remainingSeconds: remaining };
      });

      if (remaining <= 0) {
        setState((prev) => ({ ...prev, isRunning: false, endAtMs: undefined, remainingSeconds: 0 }));
        onCompleteRef.current?.();
      }
    };

    // Initial tick (fast UI response), then every second.
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
          onComplete={() => onTimerComplete?.(d.label || formatDurationShort(d.seconds))}
        />
      ))}
    </div>
  );
}

function SingleTimer({
  seconds,
  label,
  onComplete
}: {
  seconds: number;
  label: string;
  onComplete?: () => void;
}) {
  const { state, start, pause, reset } = useCountdownTimer(seconds, onComplete);

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
            onClick={start}
            className="rounded-full p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Start timer"
            title="Start"
          >
            <Play className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="rounded-full p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Pause timer"
            title="Pause"
          >
            <Pause className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={reset}
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

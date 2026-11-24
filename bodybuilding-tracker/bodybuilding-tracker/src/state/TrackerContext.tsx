import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Program, SetEntry } from '../domain/schema';
import { TrackerService, type TrackerState } from '../domain/trackerService';
import type { UserDataRepository } from '../storage/types';

interface TrackerContextValue {
  program: Program;
  repo: UserDataRepository;
  state: TrackerState;
  setExerciseCompleted(exerciseId: string, completed: boolean): Promise<void>;
  resetWorkout(workoutId: string): Promise<void>;
  saveSets(exerciseId: string, sets: SetEntry[]): Promise<void>;
  selectWeek(weekNumber: number): Promise<void>;
  reload(): Promise<void>;
}

const Ctx = createContext<TrackerContextValue | null>(null);

export function TrackerProvider({ program, repo, children }: { program: Program; repo: UserDataRepository; children: ReactNode }) {
  const service = useMemo(() => new TrackerService(repo, program), [repo, program]);
  const [state, setState] = useState<TrackerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Latest state for sequential writes (fast double taps).
  const stateRef = useRef<TrackerState | null>(null);
  stateRef.current = state;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(fn: () => Promise<T>) => {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const reload = useCallback(async () => {
    try {
      setState(await service.load());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [service]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<TrackerContextValue | null>(() => {
    if (!state) return null;
    return {
      program,
      repo,
      state,
      reload,
      setExerciseCompleted: (exerciseId, completed) =>
        enqueue(async () => {
          const cur = stateRef.current!;
          const res = await service.setExerciseCompleted(exerciseId, completed, cur.completed);
          setState((s) => {
            if (!s) return s;
            const wc = new Map(s.workoutCompletedAt);
            if (res.workoutCompletedAt) {
              if (!wc.has(res.workoutId)) wc.set(res.workoutId, res.workoutCompletedAt);
            } else wc.delete(res.workoutId);
            const next = { ...s, completed: res.completed, workoutCompletedAt: wc, history: res.event ? [res.event, ...s.history] : s.history };
            stateRef.current = next;
            return next;
          });
        }),
      resetWorkout: (workoutId) =>
        enqueue(async () => {
          const event = await service.resetWorkout(workoutId);
          setState((s) => {
            if (!s) return s;
            const completed = new Set([...s.completed].filter((id) => !id.startsWith(`${workoutId}-exercise-`)));
            const wc = new Map(s.workoutCompletedAt);
            wc.delete(workoutId);
            const next = { ...s, completed, workoutCompletedAt: wc, history: [event, ...s.history] };
            stateRef.current = next;
            return next;
          });
        }),
      saveSets: (exerciseId, sets) =>
        enqueue(async () => {
          const log = await service.saveSets(exerciseId, sets);
          setState((s) => (s ? { ...s, setLogs: new Map(s.setLogs).set(exerciseId, log) } : s));
        }),
      selectWeek: async (weekNumber) => {
        setState((s) => (s ? { ...s, selectedWeek: weekNumber } : s));
        await service.selectWeek(weekNumber);
      },
    };
  }, [state, program, repo, reload, service, enqueue]);

  if (error) {
    return (
      <div className="fatal" role="alert">
        <h1>Saved data could not be opened</h1>
        <p>{error}</p>
        <p>Your browser may be blocking storage for this site. Check that site data is allowed, then reload.</p>
      </div>
    );
  }
  if (!value) return <div className="loading">Loading…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTracker(): TrackerContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTracker must be used inside TrackerProvider');
  return v;
}

import { useState } from 'react';
import type { Workout } from '../domain/schema';
import { workoutProgress } from '../domain/progress';
import { useTracker } from '../state/TrackerContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ExerciseCard } from '../ui/ExerciseCard';
import { PlateRack } from '../ui/PlateRack';
import { plateColor } from '../ui/plate';

export function WorkoutDetail({ workout }: { workout: Workout }) {
  const { state, resetWorkout } = useTracker();
  const [confirming, setConfirming] = useState(false);
  const p = workoutProgress(workout, state.completed);

  const onReset = () => {
    if (p.done === 0) return;
    setConfirming(true);
  };

  return (
    <main className="page workout-detail" style={{ ['--plate' as string]: plateColor(workout.order) }}>
      <ol className="exercise-list">
        {workout.exercises.map((e) => (
          <ExerciseCard key={e.exerciseId} exercise={e} />
        ))}
      </ol>

      <section className="summary" aria-live="polite">
        {p.isComplete && <p className="complete-banner">Workout Completed!</p>}
        <PlateRack workout={workout} completed={state.completed} percent={p.percent} />
        <div className="summary-row">
          <p className="counter">
            Exercises completed: <strong>{p.done} / {p.total}</strong>
          </p>
          <p className="pct">{p.percent}%</p>
        </div>
      </section>

      <button className="btn btn-block reset-btn" onClick={onReset} disabled={p.done === 0}>
        Reset workout
      </button>

      {confirming && (
        <ConfirmDialog
          title={p.isComplete ? 'Reset this completed workout?' : 'Reset this workout?'}
          confirmLabel="Reset workout"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void resetWorkout(workout.workoutId);
          }}
        >
          <p>All {p.done} checked exercises will be unchecked. Loads and reps you logged are kept.</p>
        </ConfirmDialog>
      )}
    </main>
  );
}

import type { Workout } from '../domain/schema';
import { plateColor } from './plate';

/** Progress bar drawn as one plate per exercise, in workout order. */
export function PlateRack({ workout, completed, percent }: { workout: Workout; completed: ReadonlySet<string>; percent: number }) {
  const done = workout.exercises.filter((e) => completed.has(e.exerciseId)).length;
  return (
    <div
      className="rack"
      role="progressbar"
      aria-label="Workout progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${done} of ${workout.exercises.length} exercises`}
      style={{ ['--plate' as string]: plateColor(workout.order) }}
    >
      {workout.exercises.map((e) => (
        <span key={e.exerciseId} className={completed.has(e.exerciseId) ? 'rack-plate on' : 'rack-plate'} />
      ))}
    </div>
  );
}

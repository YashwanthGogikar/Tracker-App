import { Fragment } from 'react';
import { findWorkout, workoutProgress } from '../domain/progress';
import { useTracker } from '../state/TrackerContext';
import { plateColor } from '../ui/plate';
import { WorkoutDetail } from './WorkoutDetail';

interface Props {
  openWorkoutId: string | null;
  onOpenWorkout(id: string): void;
  onBack(): void;
}

export function WorkoutsScreen({ openWorkoutId, onOpenWorkout, onBack }: Props) {
  const { program, state, selectWeek } = useTracker();
  const weeks = program.weeks;
  const week = weeks.find((w) => w.weekNumber === state.selectedWeek) ?? weeks[0];
  const opened = openWorkoutId ? findWorkout(program, openWorkoutId) : null;
  const idx = weeks.indexOf(week);

  return (
    <>
      <header className="top">
        <p className="program-name">{program.programName}</p>
        {opened ? (
          <>
            <button className="back" onClick={onBack}>
              <span aria-hidden="true">‹</span> Week {opened.week.weekNumber} workouts
            </button>
            <h1 className="title" style={{ ['--plate' as string]: plateColor(opened.workout.order) }}>
              <span className="title-week">Week {opened.week.weekNumber}</span>
              {opened.workout.name}
            </h1>
          </>
        ) : (
          <>
            <h1 className="title">
              <span className="title-week">{week.block}</span>
              Week {week.weekNumber}
            </h1>
            <div className="week-picker">
              <button className="btn btn-icon" aria-label="Previous week" disabled={idx <= 0} onClick={() => void selectWeek(weeks[idx - 1].weekNumber)}>‹</button>
              <label className="sr-only" htmlFor="week-select">Week</label>
              <select id="week-select" value={week.weekNumber} onChange={(e) => void selectWeek(Number(e.target.value))}>
                {weeks.map((w) => (
                  <option key={w.weekNumber} value={w.weekNumber}>
                    Week {w.weekNumber} ({w.block})
                  </option>
                ))}
              </select>
              <button className="btn btn-icon" aria-label="Next week" disabled={idx >= weeks.length - 1} onClick={() => void selectWeek(weeks[idx + 1].weekNumber)}>›</button>
            </div>
          </>
        )}
      </header>

      {opened ? (
        <WorkoutDetail key={opened.workout.workoutId} workout={opened.workout} />
      ) : (
        <main className="page">
          {week.blockNote && <p className="block-note">{week.blockNote}</p>}
          <ul className="workout-list">
            {week.workouts.map((w) => {
              const p = workoutProgress(w, state.completed);
              return (
                <Fragment key={w.workoutId}>
                  <li>
                    <button className="workout-item" style={{ ['--plate' as string]: plateColor(w.order) }} onClick={() => onOpenWorkout(w.workoutId)}>
                      <span className="workout-item-text">
                        <span className="workout-item-name">{w.name}</span>
                        <span className="workout-item-meta">{w.exercises.length} exercises</span>
                      </span>
                      <span className={p.isComplete ? 'workout-item-status complete' : 'workout-item-status'}>
                        {p.isComplete ? 'Completed' : `${p.done} / ${p.total}`}
                      </span>
                    </button>
                  </li>
                  {w.restDayAfter && (
                    <li className="rest-day" aria-label="Rest day">Rest Day</li>
                  )}
                </Fragment>
              );
            })}
          </ul>
        </main>
      )}
    </>
  );
}

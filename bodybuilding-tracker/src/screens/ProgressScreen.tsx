import { findWorkout, overallProgress } from '../domain/progress';
import { useTracker } from '../state/TrackerContext';

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function ProgressScreen({ onOpenWeek }: { onOpenWeek(week: number): void }) {
  const { program, state } = useTracker();
  const o = overallProgress(program, state.completed);
  const recent = state.history.slice(0, 10);

  return (
    <>
      <header className="top">
        <p className="program-name">{program.programName}</p>
        <h1 className="title">Progress</h1>
      </header>
      <main className="page">
        <section className="overall">
          <p className="overall-pct">{o.exercises.percent}%</p>
          <p className="overall-label">of the program completed</p>
          <Bar value={o.exercises.percent} label="Overall completion" />
          <dl className="overall-stats">
            <div><dt>Completed workouts</dt><dd>{o.workouts.done} / {o.workouts.total}</dd></div>
            <div><dt>Completed exercises</dt><dd>{o.exercises.done} / {o.exercises.total}</dd></div>
          </dl>
        </section>

        <h2 className="section-title">Weekly completion</h2>
        <ul className="week-list">
          {o.weeks.map((w) => {
            const week = program.weeks.find((x) => x.weekNumber === w.weekNumber)!;
            return (
              <li key={w.weekNumber}>
                <button className="week-row" onClick={() => onOpenWeek(w.weekNumber)}>
                  <span className="week-row-head">
                    <span className="week-row-name">Week {w.weekNumber}</span>
                    <span className="week-row-block">{week.block}</span>
                    <span className="week-row-pct">{w.exercises.percent}%</span>
                  </span>
                  <Bar value={w.exercises.percent} label={`Week ${w.weekNumber} completion`} />
                  <span className="week-row-meta">
                    {w.workouts.done} / {w.workouts.total} workouts, {w.exercises.done} / {w.exercises.total} exercises
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <h2 className="section-title">Workout history</h2>
        {recent.length === 0 ? (
          <p className="muted">Finished workouts appear here. Check off every exercise in a workout to complete it.</p>
        ) : (
          <ul className="history">
            {recent.map((h) => {
              const found = findWorkout(program, h.workoutId);
              return (
                <li key={h.id}>
                  <span>
                    {h.type === 'workout_completed' ? 'Completed' : 'Reset'} {found?.workout.name ?? h.workoutId}, week {h.weekNumber}
                  </span>
                  <time dateTime={h.at}>{fmt.format(new Date(h.at))}</time>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import type { Exercise, SetEntry } from '../domain/schema';
import { useTracker } from '../state/TrackerContext';

function Link({ href, children }: { href: string | null; children: string }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function emptySets(n: number): SetEntry[] {
  return Array.from({ length: n }, () => ({ load: '', reps: '' }));
}

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const { state, setExerciseCompleted, saveSets } = useTracker();
  const [open, setOpen] = useState(false);
  const id = useId();
  const done = state.completed.has(exercise.exerciseId);
  const slots = Math.min(Math.max(exercise.workingSets, 1), exercise.trackingSlots);
  const saved = state.setLogs.get(exercise.exerciseId)?.sets;
  const [sets, setSets] = useState<SetEntry[]>(() => mergeSets(saved, slots));
  // True while the user has typed something not yet handed to saveSets.
  // Prevents a finishing save from overwriting input typed in the meantime.
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setSets(mergeSets(saved, slots));
  }, [saved, slots]);

  const update = (i: number, field: keyof SetEntry, value: string) => {
    dirty.current = true;
    setSets((cur) => cur.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  };
  const persist = () => {
    if (!dirty.current) return;
    dirty.current = false;
    if (JSON.stringify(mergeSets(saved, slots)) !== JSON.stringify(sets)) void saveSets(exercise.exerciseId, sets);
  };

  return (
    <li className={done ? 'exercise done' : 'exercise'}>
      <div className="exercise-main">
        <input
          id={`${id}-check`}
          type="checkbox"
          className="check"
          checked={done}
          onChange={(e) => void setExerciseCompleted(exercise.exerciseId, e.target.checked)}
        />
        <label htmlFor={`${id}-check`} className="exercise-label">
          <span className="exercise-name">{exercise.name}</span>
          <span className="exercise-rx">
            {exercise.workingSets} {exercise.workingSets === 1 ? 'set' : 'sets'} × {exercise.reps} reps
          </span>
        </label>
        <span className={done ? 'status status-done' : 'status'}>{done ? 'Done' : 'To do'}</span>
      </div>
      <button
        className="details-toggle"
        aria-expanded={open}
        aria-controls={`${id}-details`}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide details' : 'Details and logging'}
      </button>
      {open && (
        <div className="details" id={`${id}-details`}>
          <dl className="rx-grid">
            <div><dt>Warm-up sets</dt><dd>{exercise.warmupSets}</dd></div>
            <div><dt>Working sets</dt><dd>{exercise.workingSets}</dd></div>
            <div><dt>Early-set RPE</dt><dd>{exercise.earlySetRpe}</dd></div>
            <div><dt>Last-set RPE</dt><dd>{exercise.lastSetRpe}</dd></div>
            <div><dt>Rest</dt><dd>{exercise.rest}</dd></div>
            <div><dt>Last-set intensity technique</dt><dd>{exercise.intensityTechnique}</dd></div>
          </dl>

          {exercise.notes && <p className="ex-notes">{exercise.notes}</p>}

          <div className="subs">
            <h4>Substitution options</h4>
            <ol>
              {exercise.substitutions.map((s) => (
                <li key={s.name}><Link href={s.demoUrl}>{s.name}</Link></li>
              ))}
            </ol>
            {exercise.demoUrl && (
              <p className="demo"><Link href={exercise.demoUrl}>Watch exercise demo (needs internet)</Link></p>
            )}
          </div>

          <fieldset className="log">
            <legend>Load and reps</legend>
            {sets.map((s, i) => (
              <div className="log-row" key={i}>
                <span className="log-set">Set {i + 1}</span>
                <label>
                  <span className="sr-only">Set {i + 1} load</span>
                  <input
                    inputMode="decimal"
                    placeholder="Load"
                    value={s.load}
                    onChange={(e) => update(i, 'load', e.target.value)}
                    onBlur={persist}
                  />
                </label>
                <label>
                  <span className="sr-only">Set {i + 1} reps</span>
                  <input
                    inputMode="numeric"
                    placeholder="Reps"
                    value={s.reps}
                    onChange={(e) => update(i, 'reps', e.target.value)}
                    onBlur={persist}
                  />
                </label>
              </div>
            ))}
          </fieldset>
        </div>
      )}
    </li>
  );
}

function mergeSets(saved: SetEntry[] | undefined, slots: number): SetEntry[] {
  const base = emptySets(slots);
  saved?.forEach((s, i) => {
    if (i < slots) base[i] = { ...s };
  });
  return base;
}

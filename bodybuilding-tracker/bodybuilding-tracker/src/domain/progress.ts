import type { Program, Week, Workout } from './schema';

export interface Tally {
  done: number;
  total: number;
  percent: number;
}

export function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function tally(done: number, total: number): Tally {
  return { done, total, percent: percent(done, total) };
}

/** `completed` holds the exerciseIds currently checked. */
export function workoutProgress(workout: Workout, completed: ReadonlySet<string>): Tally & { isComplete: boolean } {
  const done = workout.exercises.filter((e) => completed.has(e.exerciseId)).length;
  const t = tally(done, workout.exercises.length);
  return { ...t, isComplete: t.total > 0 && done === t.total };
}

export interface WeekProgress {
  weekNumber: number;
  workouts: Tally;
  exercises: Tally;
}

export function weekProgress(week: Week, completed: ReadonlySet<string>): WeekProgress {
  let workoutsDone = 0;
  let exDone = 0;
  let exTotal = 0;
  for (const w of week.workouts) {
    const p = workoutProgress(w, completed);
    if (p.isComplete) workoutsDone++;
    exDone += p.done;
    exTotal += p.total;
  }
  return {
    weekNumber: week.weekNumber,
    workouts: tally(workoutsDone, week.workouts.length),
    exercises: tally(exDone, exTotal),
  };
}

export interface OverallProgress {
  workouts: Tally;
  exercises: Tally;
  weeks: WeekProgress[];
}

export function overallProgress(program: Program, completed: ReadonlySet<string>): OverallProgress {
  const weeks = program.weeks.map((w) => weekProgress(w, completed));
  const sum = (pick: (w: WeekProgress) => Tally) =>
    tally(weeks.reduce((a, w) => a + pick(w).done, 0), weeks.reduce((a, w) => a + pick(w).total, 0));
  return { workouts: sum((w) => w.workouts), exercises: sum((w) => w.exercises), weeks };
}

export function findWorkout(program: Program, workoutId: string): { week: Week; workout: Workout } | null {
  for (const week of program.weeks) {
    const workout = week.workouts.find((w) => w.workoutId === workoutId);
    if (workout) return { week, workout };
  }
  return null;
}

export function allExerciseIds(program: Program): Set<string> {
  return new Set(program.weeks.flatMap((w) => w.workouts.flatMap((wo) => wo.exercises.map((e) => e.exerciseId))));
}

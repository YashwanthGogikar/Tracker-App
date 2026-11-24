import type { Exercise, HistoryEvent, Program, SetEntry, SetLog, Week, Workout } from './schema';
import { findWorkout } from './progress';
import type { UserDataRepository } from '../storage/types';

export interface TrackerState {
  completed: Set<string>;
  setLogs: Map<string, SetLog>;
  workoutCompletedAt: Map<string, string>;
  history: HistoryEvent[];
  selectedWeek: number;
}

const SELECTED_WEEK = 'selectedWeek';

/** Business rules on top of a repository. Holds no state of its own. */
export class TrackerService {
  constructor(private repo: UserDataRepository, private program: Program, private clock: () => Date = () => new Date()) {}

  async load(): Promise<TrackerState> {
    const [ex, logs, wc, history, week] = await Promise.all([
      this.repo.listExerciseCompletions(),
      this.repo.listSetLogs(),
      this.repo.listWorkoutCompletions(),
      this.repo.listHistory(),
      this.repo.getSetting<number>(SELECTED_WEEK),
    ]);
    const weekNumbers = this.program.weeks.map((w) => w.weekNumber);
    return {
      completed: new Set(ex.filter((r) => r.completed).map((r) => r.exerciseId)),
      setLogs: new Map(logs.map((l) => [l.exerciseId, l])),
      workoutCompletedAt: new Map(wc.map((w) => [w.workoutId, w.completedAt])),
      history,
      selectedWeek: week && weekNumbers.includes(week) ? week : weekNumbers[0],
    };
  }

  async selectWeek(weekNumber: number) {
    await this.repo.putSetting(SELECTED_WEEK, weekNumber);
  }

  private locate(exerciseId: string): { week: Week; workout: Workout; exercise: Exercise } {
    const workoutId = exerciseId.replace(/-exercise-\d+$/, '');
    const found = findWorkout(this.program, workoutId);
    const exercise = found?.workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (!found || !exercise) throw new Error(`Unknown exercise ${exerciseId}`);
    return { ...found, exercise };
  }

  /**
   * Saves one exercise's completion, then keeps the workout record in sync.
   * Returns the workout-level change so the UI can react.
   */
  async setExerciseCompleted(exerciseId: string, completed: boolean, currentlyCompleted: ReadonlySet<string>) {
    const { week, workout, exercise } = this.locate(exerciseId);
    const now = this.clock().toISOString();
    await this.repo.putExerciseCompletion({
      exerciseId,
      workoutId: workout.workoutId,
      weekNumber: week.weekNumber,
      exerciseOrder: exercise.order,
      completed,
      updatedAt: now,
    });
    const next = new Set(currentlyCompleted);
    if (completed) next.add(exerciseId);
    else next.delete(exerciseId);
    const allDone = workout.exercises.every((e) => next.has(e.exerciseId));
    const wasDone = workout.exercises.every((e) => currentlyCompleted.has(e.exerciseId));
    let event: HistoryEvent | null = null;
    if (allDone && !wasDone) {
      await this.repo.putWorkoutCompletion({ workoutId: workout.workoutId, weekNumber: week.weekNumber, completedAt: now });
      event = { id: `${now}-${workout.workoutId}-completed`, type: 'workout_completed', workoutId: workout.workoutId, weekNumber: week.weekNumber, at: now };
      await this.repo.addHistory(event);
    } else if (!allDone && wasDone) {
      await this.repo.deleteWorkoutCompletion(workout.workoutId);
    }
    return { completed: next, workoutCompletedAt: allDone ? now : null, workoutId: workout.workoutId, event };
  }

  /** Unchecks every exercise in the workout. Logged loads and reps are kept. */
  async resetWorkout(workoutId: string) {
    const found = findWorkout(this.program, workoutId);
    if (!found) throw new Error(`Unknown workout ${workoutId}`);
    await this.repo.clearWorkout(workoutId);
    const now = this.clock().toISOString();
    const event: HistoryEvent = { id: `${now}-${workoutId}-reset`, type: 'workout_reset', workoutId, weekNumber: found.week.weekNumber, at: now };
    await this.repo.addHistory(event);
    return event;
  }

  async saveSets(exerciseId: string, sets: SetEntry[]): Promise<SetLog> {
    const { week, workout } = this.locate(exerciseId);
    const log: SetLog = { exerciseId, workoutId: workout.workoutId, weekNumber: week.weekNumber, sets, updatedAt: this.clock().toISOString() };
    await this.repo.putSetLog(log);
    return log;
  }
}

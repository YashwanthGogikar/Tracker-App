import type {
  ExerciseCompletion,
  HistoryEvent,
  Program,
  SetLog,
  Snapshot,
  WorkoutCompletion,
} from '../domain/schema';

/**
 * Repository interfaces. The UI and TrackerService depend only on these, so a
 * REST implementation (e.g. an EC2-hosted API) can replace the IndexedDB one
 * without touching components. See docs/FUTURE_BACKEND.md.
 */

/** Read-only workout program (generated from the workbook). */
export interface ProgramRepository {
  getProgram(): Promise<Program>;
}

/** Per-exercise and per-workout completion records. */
export interface CompletionRepository {
  listExerciseCompletions(): Promise<ExerciseCompletion[]>;
  putExerciseCompletion(record: ExerciseCompletion): Promise<void>;
  /** Marks every exercise of the workout as not completed and clears the workout record. */
  clearWorkout(workoutId: string): Promise<void>;
  listWorkoutCompletions(): Promise<WorkoutCompletion[]>;
  putWorkoutCompletion(record: WorkoutCompletion): Promise<void>;
  deleteWorkoutCompletion(workoutId: string): Promise<void>;
}

/** User-entered training data, history and preferences. */
export interface ProgressRepository {
  listSetLogs(): Promise<SetLog[]>;
  putSetLog(log: SetLog): Promise<void>;
  listHistory(): Promise<HistoryEvent[]>;
  addHistory(event: HistoryEvent): Promise<void>;
  getSetting<T>(key: string): Promise<T | undefined>;
  putSetting(key: string, value: unknown): Promise<void>;
}

/** Whole-dataset access for backup and restore. */
export interface SnapshotRepository {
  exportSnapshot(): Promise<Snapshot>;
  /** Atomically replaces all user data. */
  replaceSnapshot(snapshot: Snapshot): Promise<void>;
}

export type UserDataRepository = CompletionRepository & ProgressRepository & SnapshotRepository;

import { z } from 'zod';

/** Schema for src/data/workouts.json, produced by scripts/import_workbook.py. */
const LinkedName = z.object({ name: z.string().min(1), demoUrl: z.string().url().nullable() });

export const ExerciseSchema = z.object({
  exerciseId: z.string().regex(/^week-\d+-workout-\d+-exercise-\d+$/),
  order: z.number().int().positive(),
  name: z.string().min(1),
  demoUrl: z.string().url().nullable(),
  intensityTechnique: z.string(),
  warmupSets: z.string(),
  workingSets: z.number().int().positive(),
  reps: z.string(),
  earlySetRpe: z.string(),
  lastSetRpe: z.string(),
  rest: z.string(),
  substitutions: z.array(LinkedName),
  notes: z.string(),
  trackingSlots: z.number().int().positive(),
  sourceRow: z.number().int().positive(),
  rawValues: z.record(z.object({ excelSerial: z.number(), numberFormat: z.string() })).optional(),
});

export const WorkoutSchema = z.object({
  workoutId: z.string().regex(/^week-\d+-workout-\d+$/),
  order: z.number().int().positive(),
  name: z.string().min(1),
  sourceRow: z.number().int().positive(),
  restDayAfter: z.boolean(),
  exercises: z.array(ExerciseSchema).min(1),
});

export const WeekSchema = z.object({
  weekNumber: z.number().int().positive(),
  label: z.string(),
  block: z.string().nullable(),
  blockNote: z.string().nullable(),
  workouts: z.array(WorkoutSchema).min(1),
});

export const WarmUpSectionSchema = z.object({
  title: z.string(),
  description: z.string(),
  items: z.array(z.object({ label: z.string(), instruction: z.string() })),
});

export const ProgramSchema = z.object({
  programName: z.string(),
  workbookTitle: z.string().nullable(),
  copyright: z.string().nullable(),
  source: z.object({ workbook: z.string(), sheet: z.string() }),
  programNotes: z.string().nullable(),
  warmUpProtocol: z.array(WarmUpSectionSchema),
  weeks: z.array(WeekSchema).min(1),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type Week = z.infer<typeof WeekSchema>;
export type Program = z.infer<typeof ProgramSchema>;

/* ---------- User records ---------- */

export const ExerciseCompletionSchema = z.object({
  exerciseId: z.string(),
  workoutId: z.string(),
  weekNumber: z.number().int(),
  exerciseOrder: z.number().int(),
  completed: z.boolean(),
  updatedAt: z.string(),
});

export const WorkoutCompletionSchema = z.object({
  workoutId: z.string(),
  weekNumber: z.number().int(),
  completedAt: z.string(),
});

export const SetEntrySchema = z.object({ load: z.string(), reps: z.string() });

export const SetLogSchema = z.object({
  exerciseId: z.string(),
  workoutId: z.string(),
  weekNumber: z.number().int(),
  sets: z.array(SetEntrySchema),
  updatedAt: z.string(),
});

export const HistoryEventSchema = z.object({
  id: z.string(),
  type: z.enum(['workout_completed', 'workout_reset']),
  workoutId: z.string(),
  weekNumber: z.number().int(),
  at: z.string(),
});

export const SettingSchema = z.object({ key: z.string(), value: z.unknown() });

export type ExerciseCompletion = z.infer<typeof ExerciseCompletionSchema>;
export type WorkoutCompletion = z.infer<typeof WorkoutCompletionSchema>;
export type SetEntry = z.infer<typeof SetEntrySchema>;
export type SetLog = z.infer<typeof SetLogSchema>;
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;
export type Setting = z.infer<typeof SettingSchema>;

export const BACKUP_FORMAT = 'bodybuilding-tracker-backup';
export const BACKUP_VERSION = 1;

export const SnapshotSchema = z.object({
  exerciseCompletions: z.array(ExerciseCompletionSchema),
  workoutCompletions: z.array(WorkoutCompletionSchema),
  setLogs: z.array(SetLogSchema),
  history: z.array(HistoryEventSchema),
  settings: z.array(SettingSchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const BackupSchema = SnapshotSchema.extend({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  programName: z.string(),
});
export type Backup = z.infer<typeof BackupSchema>;

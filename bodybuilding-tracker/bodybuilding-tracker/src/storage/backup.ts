import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupSchema,
  type Backup,
  type Program,
} from '../domain/schema';
import { allExerciseIds } from '../domain/progress';
import type { SnapshotRepository } from './types';

export async function createBackup(repo: SnapshotRepository, program: Program, now = new Date()): Promise<Backup> {
  const snap = await repo.exportSnapshot();
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), programName: program.programName, ...snap };
}

export function backupFileName(now = new Date()): string {
  return `bts-tracker-backup-${now.toISOString().slice(0, 10)}.json`;
}

export interface BackupPreview {
  backup: Backup;
  exportedAt: string;
  completedExercises: number;
  loggedExercises: number;
  completedWorkouts: number;
  unknownExerciseIds: string[];
  programMismatch: boolean;
}

export class BackupError extends Error {}

/** Parses and validates a backup file's text. Throws BackupError with a readable message. */
export function parseBackup(text: string, program: Program): BackupPreview {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('This file is not valid JSON. Choose a file exported from this app.');
  }
  const result = BackupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BackupError(`This file is not a tracker backup (${issue.path.join('.') || 'root'}: ${issue.message}).`);
  }
  const backup = result.data;
  const known = allExerciseIds(program);
  const ids = new Set([...backup.exerciseCompletions.map((r) => r.exerciseId), ...backup.setLogs.map((r) => r.exerciseId)]);
  return {
    backup,
    exportedAt: backup.exportedAt,
    completedExercises: backup.exerciseCompletions.filter((r) => r.completed).length,
    loggedExercises: backup.setLogs.length,
    completedWorkouts: backup.workoutCompletions.length,
    unknownExerciseIds: [...ids].filter((id) => !known.has(id)),
    programMismatch: backup.programName !== program.programName,
  };
}

export async function restoreBackup(repo: SnapshotRepository, backup: Backup): Promise<void> {
  const { exerciseCompletions, workoutCompletions, setLogs, history, settings } = backup;
  await repo.replaceSnapshot({ exerciseCompletions, workoutCompletions, setLogs, history, settings });
}

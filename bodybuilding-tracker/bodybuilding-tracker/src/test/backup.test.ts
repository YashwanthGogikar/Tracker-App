import { describe, expect, it } from 'vitest';
import { TrackerService } from '../domain/trackerService';
import { BackupError, createBackup, parseBackup, restoreBackup } from '../storage/backup';
import { IndexedDbRepository } from '../storage/indexedDbRepository';
import { loadBundledProgram } from '../storage/staticProgramRepository';
import { freshDbName } from './setup';

const program = loadBundledProgram();
const ids = program.weeks[2].workouts[1].exercises.map((e) => e.exerciseId);

async function seeded() {
  const repo = new IndexedDbRepository(freshDbName());
  const svc = new TrackerService(repo, program);
  let c = new Set<string>();
  for (const id of ids) c = (await svc.setExerciseCompleted(id, true, c)).completed;
  await svc.saveSets(ids[0], [{ load: '60', reps: '10' }, { load: '62.5', reps: '9' }]);
  await svc.selectWeek(3);
  return { repo, svc };
}

describe('backup and restore', () => {
  it('round-trips all data into an empty device', async () => {
    const { repo } = await seeded();
    const text = JSON.stringify(await createBackup(repo, program));

    const preview = parseBackup(text, program);
    expect(preview.completedExercises).toBe(ids.length);
    expect(preview.completedWorkouts).toBe(1);
    expect(preview.loggedExercises).toBe(1);
    expect(preview.unknownExerciseIds).toEqual([]);

    const target = new IndexedDbRepository(freshDbName());
    await restoreBackup(target, preview.backup);
    expect(await target.exportSnapshot()).toEqual(await repo.exportSnapshot());
    const st = await new TrackerService(target, program).load();
    expect(st.completed.size).toBe(ids.length);
    expect(st.setLogs.get(ids[0])?.sets[1]).toEqual({ load: '62.5', reps: '9' });
    expect(st.selectedWeek).toBe(3);
  });

  it('replaces existing progress instead of merging', async () => {
    const { repo } = await seeded();
    const backup = await createBackup(new IndexedDbRepository(freshDbName()), program); // empty backup
    await restoreBackup(repo, backup);
    const st = await new TrackerService(repo, program).load();
    expect(st.completed.size).toBe(0);
    expect(st.setLogs.size).toBe(0);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json', program)).toThrow(BackupError);
    expect(() => parseBackup('{"hello":1}', program)).toThrow(/not a tracker backup/);
  });

  it('flags records for unknown exercises', async () => {
    const backup = await createBackup(new IndexedDbRepository(freshDbName()), program);
    backup.exerciseCompletions.push({ exerciseId: 'week-99-workout-1-exercise-1', workoutId: 'week-99-workout-1', weekNumber: 99, exerciseOrder: 1, completed: true, updatedAt: new Date().toISOString() });
    expect(parseBackup(JSON.stringify(backup), program).unknownExerciseIds).toEqual(['week-99-workout-1-exercise-1']);
  });
});

import { describe, expect, it } from 'vitest';
import { TrackerService } from '../domain/trackerService';
import { IndexedDbRepository } from '../storage/indexedDbRepository';
import { loadBundledProgram } from '../storage/staticProgramRepository';
import { freshDbName } from './setup';

const program = loadBundledProgram();
const workout = program.weeks[0].workouts[4]; // Legs, 5 exercises
const ids = workout.exercises.map((e) => e.exerciseId);

describe('IndexedDB persistence', () => {
  it('keeps completion, logs and settings after the database is closed and reopened', async () => {
    const name = freshDbName();
    const repo1 = new IndexedDbRepository(name);
    const s1 = new TrackerService(repo1, program);
    let st = await s1.load();
    await s1.setExerciseCompleted(ids[0], true, st.completed);
    await s1.saveSets(ids[0], [{ load: '100', reps: '8' }]);
    await s1.selectWeek(3);
    await repo1.close();

    const repo2 = new IndexedDbRepository(name);
    st = await new TrackerService(repo2, program).load();
    expect([...st.completed]).toEqual([ids[0]]);
    expect(st.setLogs.get(ids[0])?.sets).toEqual([{ load: '100', reps: '8' }]);
    expect(st.selectedWeek).toBe(3);
    await repo2.close();
  });

  it('records workout completion and history, and clears it on uncheck', async () => {
    const repo = new IndexedDbRepository(freshDbName());
    const svc = new TrackerService(repo, program);
    let completed = (await svc.load()).completed;
    for (const id of ids) completed = (await svc.setExerciseCompleted(id, true, completed)).completed;
    let st = await svc.load();
    expect(st.workoutCompletedAt.has(workout.workoutId)).toBe(true);
    expect(st.history.filter((h) => h.type === 'workout_completed')).toHaveLength(1);

    await svc.setExerciseCompleted(ids[2], false, st.completed);
    st = await svc.load();
    expect(st.completed.has(ids[2])).toBe(false);
    expect(st.workoutCompletedAt.has(workout.workoutId)).toBe(false);
  });

  it('keeps the same exercise in different weeks separate', async () => {
    const repo = new IndexedDbRepository(freshDbName());
    const svc = new TrackerService(repo, program);
    const w1 = program.weeks[0].workouts[0].exercises[0].exerciseId;
    const w2 = program.weeks[1].workouts[0].exercises[0].exerciseId;
    await svc.setExerciseCompleted(w1, true, new Set());
    const st = await svc.load();
    expect(st.completed.has(w1)).toBe(true);
    expect(st.completed.has(w2)).toBe(false);
  });

  it('resets a workout but keeps logged loads', async () => {
    const repo = new IndexedDbRepository(freshDbName());
    const svc = new TrackerService(repo, program);
    let completed = new Set<string>();
    for (const id of ids) completed = (await svc.setExerciseCompleted(id, true, completed)).completed;
    await svc.saveSets(ids[1], [{ load: '50', reps: '12' }]);
    await svc.resetWorkout(workout.workoutId);
    const st = await svc.load();
    expect(st.completed.size).toBe(0);
    expect(st.workoutCompletedAt.size).toBe(0);
    expect(st.setLogs.get(ids[1])?.sets[0].load).toBe('50');
    expect(st.history[0].type).toBe('workout_reset');
  });
});

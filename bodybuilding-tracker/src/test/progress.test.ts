import { describe, expect, it } from 'vitest';
import { overallProgress, percent, weekProgress, workoutProgress } from '../domain/progress';
import { loadBundledProgram } from '../storage/staticProgramRepository';

const program = loadBundledProgram();
const workout = program.weeks[0].workouts[0]; // 7 exercises
const ids = workout.exercises.map((e) => e.exerciseId);

describe('progress calculations', () => {
  it('percent rounds and handles zero', () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 8)).toBe(63);
    expect(percent(1, 3)).toBe(33);
    expect(percent(8, 8)).toBe(100);
  });

  it('counts completed exercises in a workout', () => {
    expect(workoutProgress(workout, new Set())).toMatchObject({ done: 0, total: 7, percent: 0, isComplete: false });
    expect(workoutProgress(workout, new Set(ids.slice(0, 3)))).toMatchObject({ done: 3, total: 7, percent: 43, isComplete: false });
    expect(workoutProgress(workout, new Set(ids))).toMatchObject({ done: 7, percent: 100, isComplete: true });
  });

  it('ignores ids from other workouts and weeks', () => {
    const otherWeek = program.weeks[1].workouts[0].exercises.map((e) => e.exerciseId);
    expect(workoutProgress(workout, new Set(otherWeek)).done).toBe(0);
  });

  it('computes weekly and overall completion', () => {
    const wk = weekProgress(program.weeks[0], new Set(ids));
    expect(wk.workouts).toEqual({ done: 1, total: 5, percent: 20 });
    expect(wk.exercises).toEqual({ done: 7, total: 31, percent: 23 });
    const o = overallProgress(program, new Set(ids));
    expect(o.workouts).toEqual({ done: 1, total: 60, percent: 2 });
    expect(o.exercises.total).toBe(372);
    expect(o.weeks[1].exercises.done).toBe(0);
  });
});

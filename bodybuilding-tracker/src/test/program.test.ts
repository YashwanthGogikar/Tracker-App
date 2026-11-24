import { describe, expect, it } from 'vitest';
import raw from '../data/workouts.json';
import { ProgramSchema } from '../domain/schema';
import { allExerciseIds } from '../domain/progress';
import { loadBundledProgram } from '../storage/staticProgramRepository';

const NAMES = ['Upper (Strength Focus)', 'Lower (Strength Focus)', 'Pull (Hypertrophy Focus)', 'Push (Hypertrophy Focus)', 'Legs (Hypertrophy Focus)'];

describe('imported workbook data (src/data/workouts.json)', () => {
  const program = loadBundledProgram();

  it('passes the Zod schema', () => {
    expect(ProgramSchema.safeParse(raw).success).toBe(true);
  });

  it('has weeks 1-12 in two blocks', () => {
    expect(program.weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(program.weeks.slice(0, 5).every((w) => w.block === 'Foundation Block')).toBe(true);
    expect(program.weeks.slice(5).every((w) => w.block === 'Ramping Block')).toBe(true);
  });

  it('has the five workouts per week in workbook order', () => {
    for (const w of program.weeks) expect(w.workouts.map((x) => x.name)).toEqual(NAMES);
  });

  it('has 60 workouts and 372 uniquely identified exercises', () => {
    expect(program.weeks.flatMap((w) => w.workouts)).toHaveLength(60);
    expect(allExerciseIds(program).size).toBe(372);
  });

  it('keeps exercise order and recovered prescriptions', () => {
    const ex = program.weeks[0].workouts[0].exercises;
    expect(ex.map((e) => e.name).slice(0, 3)).toEqual(['45° Incline Barbell Press', 'Cable Crossover Ladder', 'Wide-Grip Pull-Up']);
    expect(ex[0]).toMatchObject({ warmupSets: '2-3', workingSets: 1, reps: '6-8', lastSetRpe: '~6', rest: '3-5 min' });
    const all = program.weeks.flatMap((w) => w.workouts.flatMap((x) => x.exercises));
    expect(all.some((e) => e.reps.startsWith('RAW:') || e.warmupSets.startsWith('RAW:'))).toBe(false);
  });

  it('gives the same exercise in different weeks different ids', () => {
    const w1 = program.weeks[0].workouts[0].exercises[0];
    const w2 = program.weeks[1].workouts[0].exercises[0];
    expect(w1.name).toBe(w2.name);
    expect(w1.exerciseId).not.toBe(w2.exerciseId);
  });

  it('includes the guide content', () => {
    expect(program.programNotes).toMatch(/^IMPORTANT PROGRAM NOTES/);
    expect(program.warmUpProtocol.map((s) => s.title)).toEqual(['General Warm-Up', 'Exercise-Specific Warm-Up']);
  });
});

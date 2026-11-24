import rawProgram from '../data/workouts.json';
import { ProgramSchema, type Program } from '../domain/schema';
import type { ProgramRepository } from './types';

let cached: Program | null = null;

/** Parses and validates the bundled program once. Throws if the JSON is invalid. */
export function loadBundledProgram(): Program {
  if (!cached) cached = ProgramSchema.parse(rawProgram);
  return cached;
}

export class StaticProgramRepository implements ProgramRepository {
  async getProgram(): Promise<Program> {
    return loadBundledProgram();
  }
}

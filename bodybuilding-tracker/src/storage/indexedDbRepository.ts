import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ExerciseCompletion,
  HistoryEvent,
  SetLog,
  Setting,
  Snapshot,
  WorkoutCompletion,
} from '../domain/schema';
import type { UserDataRepository } from './types';

export const DEFAULT_DB_NAME = 'bodybuilding-tracker';
const DB_VERSION = 1;

interface TrackerDB extends DBSchema {
  exerciseCompletions: { key: string; value: ExerciseCompletion; indexes: { byWorkout: string } };
  workoutCompletions: { key: string; value: WorkoutCompletion };
  setLogs: { key: string; value: SetLog };
  history: { key: string; value: HistoryEvent };
  settings: { key: string; value: Setting };
}

const STORES = ['exerciseCompletions', 'workoutCompletions', 'setLogs', 'history', 'settings'] as const;

export class IndexedDbRepository implements UserDataRepository {
  private dbPromise: Promise<IDBPDatabase<TrackerDB>>;

  constructor(dbName: string = DEFAULT_DB_NAME) {
    this.dbPromise = openDB<TrackerDB>(dbName, DB_VERSION, {
      upgrade(db) {
        const ex = db.createObjectStore('exerciseCompletions', { keyPath: 'exerciseId' });
        ex.createIndex('byWorkout', 'workoutId');
        db.createObjectStore('workoutCompletions', { keyPath: 'workoutId' });
        db.createObjectStore('setLogs', { keyPath: 'exerciseId' });
        db.createObjectStore('history', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }

  async close(): Promise<void> {
    (await this.dbPromise).close();
  }

  async listExerciseCompletions() {
    return (await this.dbPromise).getAll('exerciseCompletions');
  }

  async putExerciseCompletion(record: ExerciseCompletion) {
    await (await this.dbPromise).put('exerciseCompletions', record);
  }

  async clearWorkout(workoutId: string) {
    const db = await this.dbPromise;
    const tx = db.transaction(['exerciseCompletions', 'workoutCompletions'], 'readwrite');
    const now = new Date().toISOString();
    const records = await tx.objectStore('exerciseCompletions').index('byWorkout').getAll(workoutId);
    for (const r of records) {
      await tx.objectStore('exerciseCompletions').put({ ...r, completed: false, updatedAt: now });
    }
    await tx.objectStore('workoutCompletions').delete(workoutId);
    await tx.done;
  }

  async listWorkoutCompletions() {
    return (await this.dbPromise).getAll('workoutCompletions');
  }

  async putWorkoutCompletion(record: WorkoutCompletion) {
    await (await this.dbPromise).put('workoutCompletions', record);
  }

  async deleteWorkoutCompletion(workoutId: string) {
    await (await this.dbPromise).delete('workoutCompletions', workoutId);
  }

  async listSetLogs() {
    return (await this.dbPromise).getAll('setLogs');
  }

  async putSetLog(log: SetLog) {
    await (await this.dbPromise).put('setLogs', log);
  }

  async listHistory() {
    const all = await (await this.dbPromise).getAll('history');
    return all.sort((a, b) => b.at.localeCompare(a.at));
  }

  async addHistory(event: HistoryEvent) {
    await (await this.dbPromise).put('history', event);
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    const row = await (await this.dbPromise).get('settings', key);
    return row?.value as T | undefined;
  }

  async putSetting(key: string, value: unknown) {
    await (await this.dbPromise).put('settings', { key, value });
  }

  async exportSnapshot(): Promise<Snapshot> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORES, 'readonly');
    const [exerciseCompletions, workoutCompletions, setLogs, history, settings] = await Promise.all([
      tx.objectStore('exerciseCompletions').getAll(),
      tx.objectStore('workoutCompletions').getAll(),
      tx.objectStore('setLogs').getAll(),
      tx.objectStore('history').getAll(),
      tx.objectStore('settings').getAll(),
    ]);
    await tx.done;
    return { exerciseCompletions, workoutCompletions, setLogs, history, settings };
  }

  async replaceSnapshot(s: Snapshot) {
    const db = await this.dbPromise;
    const tx = db.transaction(STORES, 'readwrite');
    await Promise.all(STORES.map((name) => tx.objectStore(name).clear()));
    await Promise.all([
      ...s.exerciseCompletions.map((r) => tx.objectStore('exerciseCompletions').put(r)),
      ...s.workoutCompletions.map((r) => tx.objectStore('workoutCompletions').put(r)),
      ...s.setLogs.map((r) => tx.objectStore('setLogs').put(r)),
      ...s.history.map((r) => tx.objectStore('history').put(r)),
      ...s.settings.map((r) => tx.objectStore('settings').put(r)),
    ]);
    await tx.done;
  }
}

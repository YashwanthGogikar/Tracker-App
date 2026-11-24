# Adding a backend later (e.g. EC2)

The app never talks to IndexedDB directly. Components call `useTracker()`, which
calls `TrackerService`, which depends only on the interfaces in
`src/storage/types.ts`:

| Interface | Responsibility | v1 implementation |
|---|---|---|
| `ProgramRepository` | Read-only workout program | `StaticProgramRepository` (bundled `workouts.json`) |
| `CompletionRepository` | Exercise and workout completion | `IndexedDbRepository` |
| `ProgressRepository` | Logged loads/reps, history, settings | `IndexedDbRepository` |
| `SnapshotRepository` | Whole-dataset export/replace (backup) | `IndexedDbRepository` |

## Swapping in a REST API

1. Write `src/storage/restRepository.ts` implementing `UserDataRepository`
   (and optionally `ProgramRepository`). Each method maps to one endpoint:

   | Method | Endpoint |
   |---|---|
   | `listExerciseCompletions()` | `GET /api/completions/exercises` |
   | `putExerciseCompletion(r)` | `PUT /api/completions/exercises/{exerciseId}` |
   | `clearWorkout(id)` | `POST /api/workouts/{workoutId}/reset` |
   | `listWorkoutCompletions()` | `GET /api/completions/workouts` |
   | `putWorkoutCompletion(r)` / `deleteWorkoutCompletion(id)` | `PUT` / `DELETE /api/completions/workouts/{workoutId}` |
   | `listSetLogs()` / `putSetLog(l)` | `GET /api/set-logs`, `PUT /api/set-logs/{exerciseId}` |
   | `listHistory()` / `addHistory(e)` | `GET` / `POST /api/history` |
   | `getSetting(k)` / `putSetting(k, v)` | `GET` / `PUT /api/settings/{key}` |
   | `exportSnapshot()` / `replaceSnapshot(s)` | `GET` / `PUT /api/snapshot` |

   Reuse the Zod schemas in `src/domain/schema.ts` to validate responses, and
   the same record shapes as request bodies.
2. Change the one line in `src/main.tsx` that constructs the repository.
3. Record IDs (`week-N-workout-M-exercise-K`) are already globally unique and
   stable, so they work as server keys. `updatedAt` on every record supports
   last-write-wins merging.

## Keeping offline support

For offline-first sync, keep `IndexedDbRepository` as the local store and add a
`SyncingRepository` wrapper that writes locally first, queues changes in an
`outbox` store, and pushes them when online. The UI stays unchanged because it
still sees the same interface. Authentication would be required before any data
leaves the device; none is implemented in v1.

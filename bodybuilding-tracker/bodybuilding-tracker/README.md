# BTS Tracker — offline workout tracker

A mobile-first, installable PWA for **The Bodybuilding Transformation System (Beginner)**.
The program comes entirely from the Excel workbook; progress is stored on the
device in IndexedDB. No login, cloud, analytics or paid services.

## Requirements

- Node.js 18+ (tested with 22) and npm
- Python 3.10+ with `openpyxl` (`pip install -r requirements.txt`)
  - On Windows, if `python3` is not found, replace it with `py` in the commands
    below and in `package.json`.

## Commands

```bash
npm install                 # 1. install dependencies
pip install -r requirements.txt
npm run import:workbook     # 2. regenerate src/data/workouts.json + reports/ (fails on unresolved data)
npm run test:import         # 3. validate the import (Python tests)
npm test                    # 4. app tests (Vitest)
npm run dev                 # 5. dev server on http://0.0.0.0:5173
```

For using the app on your phone, run the production build instead (smaller, and
the offline cache matches what you install):

```bash
npm run build
npm run preview             # serves dist/ on http://0.0.0.0:4173
```

The importer reads `data/The_Bodybuilding_Transformation_System_-_Beginner.xlsx`.
Pass a different path as the first argument to use another copy.

## Project layout

```
scripts/import_workbook.py      Workbook → JSON importer (openpyxl)
scripts/tests/                  Importer tests (unittest)
reports/import_report.md|json   Import validation report
src/data/workouts.json          Generated program data (do not edit by hand)
src/domain/                     Zod schemas, progress maths, TrackerService
src/storage/                    Repository interfaces, IndexedDB, backup
src/state/                      React context wiring service → UI
src/screens/, src/ui/           Screens and components
docs/FUTURE_BACKEND.md          How a REST/EC2 backend would plug in
```

## Workbook import notes

See `reports/import_report.md`. In short: 12 weeks, 60 workouts, 372 scheduled
exercises. 622 cells in the *Warm-up Sets* and *Reps* columns are stored by Excel
as dates (e.g. `6-8` became 8 June) with the display format `m\-d`. The importer
recovers the displayed text only when that format is present and the result is an
ascending range; otherwise it keeps the raw value prefixed `RAW:` and lists it as
unresolved. All 622 were recovered; the original serials are kept in each
exercise's `rawValues`. Text is otherwise unchanged apart from trimming
whitespace and joining the line break in "Lower (Strength Focus)".

## Data and IDs

- Exercise IDs: `week-{week}-workout-{order}-exercise-{order}`. The same exercise
  in Week 1 and Week 2 has separate records.
- Stored per device in IndexedDB database `bodybuilding-tracker`: exercise
  completions, workout completions, logged loads/reps, workout history, selected week.
- **Resetting a workout** unchecks its exercises; logged loads and reps are kept.
- **Backups are manual.** Settings → Export progress downloads a JSON file;
  Import backup file replaces all progress after confirmation.

## Opening it on your Android phone

1. Phone and computer on the same Wi-Fi.
2. Find the computer's local IP:
   - Windows: `ipconfig` → *IPv4 Address* (e.g. `192.168.1.50`)
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
   Vite also prints it as the *Network* URL when it starts.
3. On the phone, open Chrome and go to `http://192.168.1.50:4173` (preview) or
   `:5173` (dev).
4. If it does not load, allow the port through the computer's firewall
   (Windows will usually prompt for Node.js; choose *Private networks*).

## Installing the PWA on Android

Chrome only enables the service worker (offline mode) and full app install on
**HTTPS or `localhost`**. A plain `http://192.168.x.x` address works for tracking,
but not for offline use or installation. Pick one of these:

**Option A — Chrome flag (Wi-Fi, simplest)**
1. On the phone, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
2. Enable it and enter your address, e.g. `http://192.168.1.50:4173`.
3. Tap *Relaunch*, then open that address.

**Option B — USB port forwarding (no flags)**
1. Enable *Developer options → USB debugging* on the phone, connect by USB.
2. On the computer, open Chrome at `chrome://inspect/#devices`, click
   *Port forwarding*, add `4173` → `localhost:4173`, tick *Enable port forwarding*.
   (Or with Android platform-tools: `adb reverse tcp:4173 tcp:4173`.)
3. On the phone, open `http://localhost:4173`.

Then install: Chrome menu (⋮) → **Install app** (or *Add to Home screen* →
*Install*). Open it once from the home-screen icon while the computer is
running so it caches everything. After that it works with the computer off and
the phone in airplane mode. Settings → *Ask to keep data* makes Android less
likely to clear storage.

**Important:** storage belongs to the exact address. `http://192.168.1.50:4173`,
`http://localhost:4173` and port `5173` each have separate data. If your
computer's IP changes, the installed app keeps working, but opening the new
address in a browser starts empty — use Export/Import to move progress.

## Updating the program

Replace the workbook in `data/`, run `npm run import:workbook`, review
`reports/import_report.md`, run the tests, and rebuild. Progress is matched by
exercise ID (week/workout/position), so reordering exercises in the workbook
would attach old records to different exercises.

## Test checklist (on the phone)

- [ ] **Week selection:** pick Week 7 from the dropdown and with ‹ ›; heading and *Ramping Block* label update.
- [ ] **Workout selection:** five workouts with *Rest Day* after Lower and Legs; open one; exercises match the workbook order.
- [ ] **Exercise checkboxes:** check, uncheck; status changes *To do* ↔ *Done*.
- [ ] **Completion counter:** *Exercises completed: n / total*, percentage and plate bar update instantly; all checked shows *Workout Completed!*; Reset asks first.
- [ ] **Progress persistence:** check some exercises and enter a load, close Chrome / reboot the phone, reopen — everything is still there. Week 1 and Week 2 of the same exercise stay independent.
- [ ] **Offline operation:** after installing and opening once, enable airplane mode and stop the computer's server; the app opens and saves.
- [ ] **Backup and restore:** Export progress → file in Downloads; check another exercise; Import that file → confirmation lists counts → progress returns to the exported state.

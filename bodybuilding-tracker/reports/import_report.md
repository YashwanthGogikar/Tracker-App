# Workbook import report

Source: `The_Bodybuilding_Transformation_System_-_Beginner.xlsx`, sheet `Beginner Program`  
Generated: 2026-11-23T20:01:27+00:00

## Counts

| Item | Count |
|---|---|
| Weeks | 12 |
| Workouts | 60 |
| Exercises (scheduled) | 372 |

| Week | Workouts | Exercises |
|---|---|---|
| 1 | 5 | 31 |
| 2 | 5 | 31 |
| 3 | 5 | 31 |
| 4 | 5 | 31 |
| 5 | 5 | 31 |
| 6 | 5 | 31 |
| 7 | 5 | 31 |
| 8 | 5 | 31 |
| 9 | 5 | 31 |
| 10 | 5 | 31 |
| 11 | 5 | 31 |
| 12 | 5 | 31 |

## Blocks

- **Foundation Block**: Note: Volume may feel low and your workouts may be fast in Weeks 1 and 2 -- that's okay! Work on mastering your technique!
- **Ramping Block**

## Date-formatted cells

622 cells in the Warm-up Sets (E) and Reps (G) columns are stored as Excel date serials with the custom number format `m\-d`. Excel renders these as `<month>-<day>`, i.e. the ranges were typed as text (e.g. `6-8`) and auto-converted by Excel. Evidence:

- Every affected cell uses format `m\-d`; no other date format exists in the sheet.
- Every serial has a zero time component and recovers to an ascending range (low < high).
- Rep values Excel could not turn into a date (month > 12) are stored as plain text in the same column: `15-20`.

Recovered with high confidence: **622 / 622**. The original serial and number format are kept in each exercise's `rawValues` field.

| Recovered value | Cells |
|---|---|
| `reps=10-12` | 143 |
| `reps=10-20` | 5 |
| `reps=12-15` | 80 |
| `reps=6-8` | 25 |
| `reps=8-10` | 105 |
| `warmupSets=1-2` | 144 |
| `warmupSets=2-3` | 72 |
| `warmupSets=2-4` | 48 |

## Missing values

None. Every exercise row has all 11 prescription columns filled.

Tracking Load and Reps columns (H–K) are blank in the workbook by design; they are user input. Pre-filled tracking cells found: 0.

## Normalizations

- Leading/trailing whitespace trimmed on text cells (the workbook has trailing spaces in some notes).
- Line breaks inside workout headings collapsed to a single space:
  - 'Lower \n(Strength Focus)' → 'Lower (Strength Focus)' (12 cells)

## Unresolved data

None.

## Warnings

None.

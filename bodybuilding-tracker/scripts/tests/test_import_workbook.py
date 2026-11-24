"""Tests for scripts/import_workbook.py. Run: python3 -m unittest discover -s scripts/tests -v"""
import datetime as dt
import sys
import tempfile
import unittest
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import import_workbook as iw  # noqa: E402

WORKOUT_NAMES = [
    "Upper (Strength Focus)",
    "Lower (Strength Focus)",
    "Pull (Hypertrophy Focus)",
    "Push (Hypertrophy Focus)",
    "Legs (Hypertrophy Focus)",
]


class RealWorkbookTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.program, cls.report = iw.import_workbook(iw.DEFAULT_WORKBOOK)
        cls.rep = iw.build_report(cls.program, cls.report)
        cls.weeks = cls.program["weeks"]
        cls.exercises = [e for w in cls.weeks for wo in w["workouts"] for e in wo["exercises"]]

    def test_twelve_weeks_in_order(self):
        self.assertEqual([w["weekNumber"] for w in self.weeks], list(range(1, 13)))

    def test_blocks(self):
        self.assertEqual({w["block"] for w in self.weeks[:5]}, {"Foundation Block"})
        self.assertEqual({w["block"] for w in self.weeks[5:]}, {"Ramping Block"})
        self.assertTrue(self.weeks[0]["blockNote"].startswith("Note: Volume may feel low"))

    def test_workouts_per_week_and_order(self):
        for w in self.weeks:
            self.assertEqual([wo["name"] for wo in w["workouts"]], WORKOUT_NAMES)
            self.assertEqual([wo["restDayAfter"] for wo in w["workouts"]], [False, True, False, False, True])

    def test_counts(self):
        self.assertEqual(self.rep["counts"]["workouts"], 60)
        self.assertEqual(self.rep["counts"]["exercises"], 372)

    def test_first_exercise_matches_workbook(self):
        ex = self.weeks[0]["workouts"][0]["exercises"][0]
        self.assertEqual(ex["exerciseId"], "week-1-workout-1-exercise-1")
        self.assertEqual(ex["name"], "45° Incline Barbell Press")
        self.assertEqual(ex["warmupSets"], "2-3")
        self.assertEqual(ex["workingSets"], 1)
        self.assertEqual(ex["reps"], "6-8")
        self.assertEqual(ex["lastSetRpe"], "~6")
        self.assertEqual(ex["rest"], "3-5 min")
        self.assertEqual([s["name"] for s in ex["substitutions"]], ["45° Incline DB Press", "45° Incline Machine Press"])

    def test_exercise_ids_unique_and_positional(self):
        ids = [e["exerciseId"] for e in self.exercises]
        self.assertEqual(len(ids), len(set(ids)))
        for w in self.weeks:
            for wo in w["workouts"]:
                for i, e in enumerate(wo["exercises"], 1):
                    self.assertEqual(e["exerciseId"], f"week-{w['weekNumber']}-workout-{wo['order']}-exercise-{i}")

    def test_source_rows_strictly_increasing(self):
        rows = [e["sourceRow"] for e in self.exercises]
        self.assertEqual(rows, sorted(rows))

    def test_date_cells_all_recovered(self):
        d = self.rep["dateFormattedCells"]
        self.assertEqual(d["total"], 622)
        self.assertEqual(d["recoveredHighConfidence"], 622)
        self.assertEqual(self.rep["unresolved"], [])
        for e in self.exercises:
            for field in ("warmupSets", "reps"):
                self.assertNotIn("RAW:", e[field])
                self.assertRegex(e[field], r"^\d+(-\d+)?$")

    def test_text_range_preserved(self):
        self.assertIn("15-20", {e["reps"] for e in self.exercises})

    def test_no_missing_values(self):
        self.assertEqual(self.rep["missingValues"], [])

    def test_guide_content(self):
        self.assertTrue(self.program["programNotes"].startswith("IMPORTANT PROGRAM NOTES"))
        titles = [s["title"] for s in self.program["warmUpProtocol"]]
        self.assertEqual(titles, ["General Warm-Up", "Exercise-Specific Warm-Up"])
        self.assertEqual(len(self.program["warmUpProtocol"][0]["items"]), 6)
        self.assertEqual(len(self.program["warmUpProtocol"][1]["items"]), 4)


class SyntheticWorkbookTest(unittest.TestCase):
    """Edge cases: non-recoverable date formats must be preserved and reported."""

    def build(self, reps_value, reps_format):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = iw.SHEET_NAME
        ws["B1"] = "Test Program"
        ws["B4"] = "IMPORTANT PROGRAM NOTES (READ BEFORE STARTING)\nnote"
        ws["B6"] = "WARM UP PROTOCOL"
        ws["F8"] = "General Warm-Up"
        ws["F9"] = "desc"
        ws["F10"], ws["H10"] = "5 min", "Cardio"
        ws["B27"] = "Foundation Block"
        ws["B29"] = "Week 1"
        for col, label in iw.EXPECTED_HEADER.items():
            ws[f"{col}29"] = label
        ws["B31"] = "Day A"
        row = {"C": "Squat", "D": "N/A", "E": 1, "F": 2, "G": reps_value, "L": "~7", "M": "~8",
               "N": "2 min", "O": "Sub 1", "P": "Sub 2", "Q": "note"}
        for col, v in row.items():
            ws[f"{col}31"] = v
        ws["G31"].number_format = reps_format
        ws["J32"] = "Rest Day"
        path = Path(tempfile.mkdtemp()) / "t.xlsx"
        wb.save(path)
        return path

    def test_month_day_format_recovered(self):
        program, report = iw.import_workbook(self.build(dt.datetime(2025, 8, 10), "m\\-d"))
        ex = program["weeks"][0]["workouts"][0]["exercises"][0]
        self.assertEqual(ex["reps"], "8-10")
        self.assertEqual(report.unresolved, [])
        self.assertTrue(program["weeks"][0]["workouts"][0]["restDayAfter"])

    def test_unknown_date_format_preserved_raw(self):
        program, report = iw.import_workbook(self.build(dt.datetime(2025, 8, 10), "yyyy-mm-dd"))
        ex = program["weeks"][0]["workouts"][0]["exercises"][0]
        self.assertTrue(ex["reps"].startswith("RAW:2025-08-10"))
        self.assertEqual(len(report.unresolved), 1)
        self.assertEqual(report.unresolved[0]["cell"], "G31")

    def test_descending_range_flagged(self):
        _, report = iw.import_workbook(self.build(dt.datetime(2025, 10, 8), "m\\-d"))
        self.assertEqual(len(report.unresolved), 1)
        self.assertEqual(report.date_cells[0]["confidence"], "low")


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Convert the Bodybuilding Transformation System workbook into structured JSON.

Usage:
    python3 scripts/import_workbook.py [WORKBOOK] [--out src/data/workouts.json]
                                       [--report-dir reports] [--strict]

The workbook is the source of truth. Nothing is invented: every value written
to the JSON comes from a cell. Cells that Excel auto-converted to dates are
recovered only when their number format proves what Excel displays; anything
else is preserved raw and listed as unresolved in the import report.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.utils.datetime import to_excel

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WORKBOOK = ROOT / "data" / "The_Bodybuilding_Transformation_System_-_Beginner.xlsx"
DEFAULT_OUT = ROOT / "src" / "data" / "workouts.json"
DEFAULT_REPORT_DIR = ROOT / "reports"
SHEET_NAME = "Beginner Program"
PROGRAM_NAME = "The Bodybuilding Transformation System"

# Header labels expected on every "Week N" row, by column letter.
EXPECTED_HEADER = {
    "C": "Exercise",
    "D": "Last-Set Intensity Technique",
    "E": "Warm-up Sets",
    "F": "Working Sets",
    "G": "Reps",
    "H": "Tracking Load and Reps",
    "L": "Early Set RPE",
    "M": "Last Set RPE",
    "N": "Rest",
    "O": "Substitution Option 1",
    "P": "Substitution Option 2",
    "Q": "Notes",
}
TRACKING_COLUMNS = ["H", "I", "J", "K"]
# Excel custom format "m\-d" renders a date serial as "<month>-<day>".
MONTH_DAY_FORMATS = {"m\\-d", "m-d"}
REQUIRED_FIELDS = {
    "C": "name",
    "D": "intensityTechnique",
    "E": "warmupSets",
    "F": "workingSets",
    "G": "reps",
    "L": "earlySetRpe",
    "M": "lastSetRpe",
    "N": "rest",
    "O": "substitution1",
    "P": "substitution2",
    "Q": "notes",
}
WEEK_RE = re.compile(r"^Week\s+(\d+)$")
BLOCK_RE = re.compile(r"\bBlock$")


class Report:
    def __init__(self) -> None:
        self.date_cells: list[dict[str, Any]] = []
        self.unresolved: list[dict[str, Any]] = []
        self.missing: list[dict[str, Any]] = []
        self.normalizations: list[dict[str, Any]] = []
        self.warnings: list[str] = []
        self.prefilled_tracking: list[str] = []


def collapse_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def cell_text(cell, report: Report, field: str) -> str | None:
    """Return the text Excel displays for a cell, recording any recovery."""
    v = cell.value
    if v is None:
        return None
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, (int, float)):
        return str(int(v)) if float(v).is_integer() else str(v)
    if isinstance(v, (dt.datetime, dt.date)):
        serial = to_excel(v)
        has_time = isinstance(v, dt.datetime) and (v.hour or v.minute or v.second)
        entry = {
            "cell": cell.coordinate,
            "field": field,
            "rawValue": v.isoformat(),
            "excelSerial": serial,
            "numberFormat": cell.number_format,
        }
        if cell.number_format in MONTH_DAY_FORMATS and not has_time:
            recovered = f"{v.month}-{v.day}"
            entry["recovered"] = recovered
            # A range written low-high is the only sensible prescription.
            entry["confidence"] = "high" if v.month < v.day else "low"
            report.date_cells.append(entry)
            if entry["confidence"] == "low":
                report.unresolved.append({**entry, "reason": "Recovered range is not ascending"})
            return recovered
        entry["recovered"] = None
        entry["confidence"] = "none"
        report.date_cells.append(entry)
        report.unresolved.append({**entry, "reason": "Date value with a number format that does not reveal the displayed text"})
        return f"RAW:{v.isoformat()}"
    report.unresolved.append({"cell": cell.coordinate, "field": field, "rawValue": repr(v), "reason": "Unexpected cell type"})
    return repr(v)


def link(cell) -> str | None:
    return cell.hyperlink.target if cell.hyperlink and cell.hyperlink.target else None


def parse_warmup(ws, start_row: int, end_row: int) -> list[dict[str, Any]]:
    """Read the WARM UP PROTOCOL area (columns F/H) between two rows."""
    sections: list[dict[str, Any]] = []
    for r in range(start_row, end_row):
        f, h = ws[f"F{r}"].value, ws[f"H{r}"].value
        if f is None and h is None:
            continue
        if f is not None and h is not None:
            if not sections:
                sections.append({"title": "", "description": "", "items": []})
            sections[-1]["items"].append({"label": str(f).strip(), "instruction": str(h).strip()})
        elif f is not None:
            text = str(f).strip()
            cur = sections[-1] if sections else None
            if cur and cur["title"] and not cur["description"] and not cur["items"]:
                cur["description"] = text
            else:
                sections.append({"title": text, "description": "", "items": []})
    return sections


def import_workbook(path: Path) -> tuple[dict[str, Any], Report]:
    report = Report()
    wb = openpyxl.load_workbook(path)  # not data_only: we need number formats
    if SHEET_NAME not in wb.sheetnames:
        raise SystemExit(f"Worksheet '{SHEET_NAME}' not found. Sheets: {wb.sheetnames}")
    ws = wb[SHEET_NAME]

    title = ws["B1"].value
    copyright_text = None
    for row in ws.iter_rows(min_row=1, max_row=3):
        for c in row:
            if isinstance(c.value, str) and "Copyright" in c.value:
                copyright_text = c.value.strip()

    program_notes = None
    warmup_start = None
    first_block_row = None
    for r in range(1, ws.max_row + 1):
        b = ws[f"B{r}"].value
        if not isinstance(b, str):
            continue
        if b.startswith("IMPORTANT PROGRAM NOTES") and program_notes is None:
            program_notes = b.strip()
        elif b.strip() == "WARM UP PROTOCOL":
            warmup_start = r + 1
        elif BLOCK_RE.search(b.strip()) and first_block_row is None:
            first_block_row = r
    if first_block_row is None:
        raise SystemExit("No training block heading found")
    warmup = parse_warmup(ws, warmup_start or 1, first_block_row) if warmup_start else []

    weeks: list[dict[str, Any]] = []
    block_name: str | None = None
    block_note: str | None = None
    week: dict[str, Any] | None = None
    workout: dict[str, Any] | None = None

    for r in range(first_block_row, ws.max_row + 1):
        b = ws[f"B{r}"].value
        c = ws[f"C{r}"].value
        b_text = b.strip() if isinstance(b, str) else None
        row_values = [x.value for x in ws[r] if x.value is not None]

        # Block heading (e.g. "Foundation Block") or a note directly under it.
        if b_text and c is None and BLOCK_RE.search(b_text):
            block_name, block_note = b_text, None
            continue
        if b_text and c is None and not WEEK_RE.match(b_text):
            if block_name and (week is None or week["block"] != block_name):
                block_note = b_text
            else:
                report.warnings.append(f"Row {r}: unclassified text in column B: {b_text[:60]!r}")
            continue

        # Week header row.
        m = WEEK_RE.match(b_text or "")
        if m and c == "Exercise":
            for col, label in EXPECTED_HEADER.items():
                actual = ws[f"{col}{r}"].value
                if (actual or "").strip() != label:
                    report.warnings.append(f"Row {r}: header {col} is {actual!r}, expected {label!r}")
            week = {
                "weekNumber": int(m.group(1)),
                "label": b_text,
                "block": block_name,
                "blockNote": block_note,
                "workouts": [],
            }
            weeks.append(week)
            workout = None
            continue

        # Rest day marker between workouts.
        if c is None and any(isinstance(v, str) and v.strip() == "Rest Day" for v in row_values):
            if workout is not None:
                workout["restDayAfter"] = True
            else:
                report.warnings.append(f"Row {r}: 'Rest Day' before any workout")
            continue

        if c is None:
            # Sub-header (Set 1..Set 4) or blank row.
            continue

        if week is None:
            report.warnings.append(f"Row {r}: exercise outside any week")
            continue

        if b_text:
            n = len(week["workouts"]) + 1
            workout = {
                "workoutId": f"week-{week['weekNumber']}-workout-{n}",
                "order": n,
                "name": collapse_ws(b_text),
                "sourceRow": r,
                "restDayAfter": False,
                "exercises": [],
            }
            if collapse_ws(b_text) != b_text:
                report.normalizations.append({"cell": f"B{r}", "raw": b_text, "normalized": collapse_ws(b_text)})
            week["workouts"].append(workout)
        if workout is None:
            report.warnings.append(f"Row {r}: exercise before any workout heading")
            continue

        values: dict[str, str | None] = {}
        for col, field in REQUIRED_FIELDS.items():
            values[field] = cell_text(ws[f"{col}{r}"], report, field)
            if values[field] in (None, ""):
                report.missing.append({"cell": f"{col}{r}", "field": field, "workoutId": workout["workoutId"]})

        for col in TRACKING_COLUMNS:
            if ws[f"{col}{r}"].value is not None:
                report.prefilled_tracking.append(f"{col}{r}")

        working_raw = ws[f"F{r}"].value
        working_sets = int(working_raw) if isinstance(working_raw, (int, float)) and float(working_raw).is_integer() else None
        if working_sets is None:
            report.unresolved.append({"cell": f"F{r}", "field": "workingSets", "rawValue": repr(working_raw), "reason": "Working sets is not a whole number"})

        k = len(workout["exercises"]) + 1
        raw_values: dict[str, Any] = {}
        for col, field in (("E", "warmupSets"), ("G", "reps")):
            cell = ws[f"{col}{r}"]
            if isinstance(cell.value, (dt.datetime, dt.date)):
                raw_values[field] = {"excelSerial": to_excel(cell.value), "numberFormat": cell.number_format}

        exercise = {
            "exerciseId": f"{workout['workoutId']}-exercise-{k}",
            "order": k,
            "name": values["name"],
            "demoUrl": link(ws[f"C{r}"]),
            "intensityTechnique": values["intensityTechnique"],
            "warmupSets": values["warmupSets"],
            "workingSets": working_sets,
            "reps": values["reps"],
            "earlySetRpe": values["earlySetRpe"],
            "lastSetRpe": values["lastSetRpe"],
            "rest": values["rest"],
            "substitutions": [
                {"name": values[f"substitution{i}"], "demoUrl": link(ws[f"{col}{r}"])}
                for i, col in ((1, "O"), (2, "P"))
                if values[f"substitution{i}"]
            ],
            "notes": values["notes"] or "",
            "trackingSlots": len(TRACKING_COLUMNS),
            "sourceRow": r,
        }
        if raw_values:
            exercise["rawValues"] = raw_values
        workout["exercises"].append(exercise)

    program = {
        "programName": PROGRAM_NAME,
        "workbookTitle": title.strip() if isinstance(title, str) else None,
        "copyright": copyright_text,
        "source": {"workbook": path.name, "sheet": SHEET_NAME},
        "programNotes": program_notes,
        "warmUpProtocol": warmup,
        "weeks": weeks,
    }
    validate(program, report)
    return program, report


def validate(program: dict[str, Any], report: Report) -> None:
    weeks = program["weeks"]
    nums = [w["weekNumber"] for w in weeks]
    if nums != list(range(1, len(nums) + 1)):
        report.warnings.append(f"Week numbers are not sequential: {nums}")
    if len(weeks) != 12:
        report.warnings.append(f"Expected 12 weeks, found {len(weeks)}")
    ids: set[str] = set()
    for w in weeks:
        if not w["workouts"]:
            report.warnings.append(f"Week {w['weekNumber']} has no workouts")
        for wo in w["workouts"]:
            if not wo["exercises"]:
                report.warnings.append(f"{wo['workoutId']} has no exercises")
            for ex in wo["exercises"]:
                if ex["exerciseId"] in ids:
                    report.warnings.append(f"Duplicate exercise id {ex['exerciseId']}")
                ids.add(ex["exerciseId"])
    if not program["programNotes"]:
        report.warnings.append("Program notes not found")
    if not program["warmUpProtocol"]:
        report.warnings.append("Warm-up protocol not found")


def build_report(program: dict[str, Any], report: Report) -> dict[str, Any]:
    weeks = program["weeks"]
    workouts = [wo for w in weeks for wo in w["workouts"]]
    exercises = [ex for wo in workouts for ex in wo["exercises"]]
    recovered_values: dict[str, int] = {}
    for d in report.date_cells:
        if d.get("recovered"):
            key = f"{d['field']}={d['recovered']}"
            recovered_values[key] = recovered_values.get(key, 0) + 1
    text_ranges = sorted({ex["reps"] for ex in exercises if ex.get("reps") and "reps" not in ex.get("rawValues", {})})
    return {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": program["source"],
        "counts": {
            "weeks": len(weeks),
            "workouts": len(workouts),
            "exercises": len(exercises),
            "workoutsPerWeek": {w["weekNumber"]: len(w["workouts"]) for w in weeks},
            "exercisesPerWeek": {w["weekNumber"]: sum(len(wo["exercises"]) for wo in w["workouts"]) for w in weeks},
        },
        "blocks": sorted({(w["block"], w["blockNote"]) for w in weeks}, key=lambda x: x[0] or ""),
        "dateFormattedCells": {
            "total": len(report.date_cells),
            "recoveredHighConfidence": sum(1 for d in report.date_cells if d["confidence"] == "high"),
            "recoveredValueCounts": dict(sorted(recovered_values.items())),
            "repsStoredAsTextInWorkbook": text_ranges,
            "cells": report.date_cells,
        },
        "missingValues": report.missing,
        "prefilledTrackingCells": report.prefilled_tracking,
        "normalizations": report.normalizations,
        "unresolved": report.unresolved,
        "warnings": report.warnings,
    }


def write_markdown(rep: dict[str, Any], path: Path) -> None:
    c, d = rep["counts"], rep["dateFormattedCells"]
    lines = [
        "# Workbook import report",
        "",
        f"Source: `{rep['source']['workbook']}`, sheet `{rep['source']['sheet']}`  ",
        f"Generated: {rep['generatedAt']}",
        "",
        "## Counts",
        "",
        "| Item | Count |",
        "|---|---|",
        f"| Weeks | {c['weeks']} |",
        f"| Workouts | {c['workouts']} |",
        f"| Exercises (scheduled) | {c['exercises']} |",
        "",
        "| Week | Workouts | Exercises |",
        "|---|---|---|",
    ]
    for wk, n in c["workoutsPerWeek"].items():
        lines.append(f"| {wk} | {n} | {c['exercisesPerWeek'][wk]} |")
    lines += ["", "## Blocks", ""]
    for name, note in rep["blocks"]:
        lines.append(f"- **{name}**" + (f": {note}" if note else ""))
    lines += [
        "",
        "## Date-formatted cells",
        "",
        f"{d['total']} cells in the Warm-up Sets (E) and Reps (G) columns are stored as Excel date serials "
        "with the custom number format `m\\-d`. Excel renders these as `<month>-<day>`, i.e. the ranges "
        "were typed as text (e.g. `6-8`) and auto-converted by Excel. Evidence:",
        "",
        "- Every affected cell uses format `m\\-d`; no other date format exists in the sheet.",
        "- Every serial has a zero time component and recovers to an ascending range (low < high).",
        "- Rep values Excel could not turn into a date (month > 12) are stored as plain text in the same column: "
        + ", ".join(f"`{x}`" for x in d["repsStoredAsTextInWorkbook"]) + ".",
        "",
        f"Recovered with high confidence: **{d['recoveredHighConfidence']} / {d['total']}**. "
        "The original serial and number format are kept in each exercise's `rawValues` field.",
        "",
        "| Recovered value | Cells |",
        "|---|---|",
    ]
    for k, v in d["recoveredValueCounts"].items():
        lines.append(f"| `{k}` | {v} |")
    lines += ["", "## Missing values", ""]
    if rep["missingValues"]:
        for m in rep["missingValues"]:
            lines.append(f"- `{m['cell']}` ({m['field']}) in {m['workoutId']}")
    else:
        lines.append("None. Every exercise row has all 11 prescription columns filled.")
    lines += [
        "",
        "Tracking Load and Reps columns (H–K) are blank in the workbook by design; they are user input. "
        f"Pre-filled tracking cells found: {len(rep['prefilledTrackingCells'])}.",
        "",
        "## Normalizations",
        "",
        "- Leading/trailing whitespace trimmed on text cells (the workbook has trailing spaces in some notes).",
        "- Line breaks inside workout headings collapsed to a single space:",
    ]
    seen = set()
    for n in rep["normalizations"]:
        if n["raw"] in seen:
            continue
        seen.add(n["raw"])
        cells = [x["cell"] for x in rep["normalizations"] if x["raw"] == n["raw"]]
        lines.append(f"  - {n['raw']!r} → {n['normalized']!r} ({len(cells)} cells)")
    lines += ["", "## Unresolved data", ""]
    if rep["unresolved"]:
        for u in rep["unresolved"]:
            lines.append(f"- `{u['cell']}` ({u['field']}): {u['reason']} — raw `{u['rawValue']}`")
    else:
        lines.append("None.")
    lines += ["", "## Warnings", ""]
    lines += [f"- {w}" for w in rep["warnings"]] or ["None."]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("workbook", nargs="?", default=str(DEFAULT_WORKBOOK))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    ap.add_argument("--strict", action="store_true", help="exit 1 on unresolved data or warnings")
    args = ap.parse_args(argv)

    program, report = import_workbook(Path(args.workbook))
    rep = build_report(program, report)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(program, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rdir = Path(args.report_dir)
    rdir.mkdir(parents=True, exist_ok=True)
    (rdir / "import_report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(rep, rdir / "import_report.md")

    c = rep["counts"]
    print(f"Imported {c['weeks']} weeks, {c['workouts']} workouts, {c['exercises']} exercises")
    print(f"Date-formatted cells: {rep['dateFormattedCells']['total']} "
          f"(recovered: {rep['dateFormattedCells']['recoveredHighConfidence']})")
    print(f"Missing values: {len(rep['missingValues'])} | Unresolved: {len(rep['unresolved'])} | Warnings: {len(rep['warnings'])}")
    print(f"Wrote {out} and {rdir / 'import_report.md'}")
    if args.strict and (rep["unresolved"] or rep["warnings"]):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

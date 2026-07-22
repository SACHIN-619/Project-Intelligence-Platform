"""
tests/test_parsers.py
======================
Tests for CSV / Excel parser and PDF parser.
Uses in-memory bytes — no disk I/O needed.
"""

import io
import pytest
from app.services.parser.csv_parser import ScheduleParser, ParseResult
from app.services.parser.pdf_parser import PDFParser


# ── CSV helpers ───────────────────────────────────────────────────────────────

def _csv(rows: list[dict], headers: list[str] | None = None) -> bytes:
    """Build a CSV bytes object from a list of dicts."""
    import csv, io
    headers = headers or (list(rows[0].keys()) if rows else [])
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=headers)
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue().encode()


STANDARD_TASKS = [
    {"Task": "Site Prep",   "Duration": "5",  "DependsOn": "",          "Status": "Completed", "Completion%": "100"},
    {"Task": "Electrical",  "Duration": "7",  "DependsOn": "Site Prep", "Status": "Completed", "Completion%": "100"},
    {"Task": "Cooling",     "Duration": "10", "DependsOn": "Electrical","Status": "Delayed",   "Completion%": "50"},
    {"Task": "Testing",     "Duration": "5",  "DependsOn": "Cooling",   "Status": "Pending",   "Completion%": "0"},
]

ALIAS_TASKS = [
    {"Activity": "Site Prep",  "Days": "5",  "Follows": "",           "State": "Done"},
    {"Activity": "Electrical", "Days": "7",  "Follows": "Site Prep",  "State": "Done"},
    {"Activity": "Cooling",    "Days": "10", "Follows": "Electrical", "State": "Late"},
]

VENDOR_ROWS = [
    {"Vendor": "ABB",     "Equipment": "Switchgear", "LeadTimeDays": "45", "DeliveryStatus": "Delayed"},
    {"Vendor": "Cummins", "Equipment": "Generators", "LeadTimeDays": "60", "DeliveryStatus": "At Risk"},
]


# ─────────────────────────────────────────────────────────────────────────────
# Standard CSV
# ─────────────────────────────────────────────────────────────────────────────

class TestCSVParser:

    def test_parses_standard_headers(self):
        content = _csv(STANDARD_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        assert len(result.tasks) == 4

    def test_task_names_correct(self):
        content = _csv(STANDARD_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        names = [t.task_name for t in result.tasks]
        assert "Site Prep" in names
        assert "Cooling" in names

    def test_status_normalised(self):
        content = _csv(STANDARD_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        statuses = {t.task_name: t.status for t in result.tasks}
        assert statuses["Site Prep"] == "completed"
        assert statuses["Cooling"] == "delayed"
        assert statuses["Testing"] == "pending"

    def test_dependencies_parsed(self):
        content = _csv(STANDARD_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        cooling = next(t for t in result.tasks if t.task_name == "Cooling")
        assert "Electrical" in cooling.depends_on

    def test_completion_parsed_as_int(self):
        content = _csv(STANDARD_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        site = next(t for t in result.tasks if t.task_name == "Site Prep")
        assert site.completion == 100

    def test_quality_score_above_50_for_good_data(self):
        content = _csv(STANDARD_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        assert result.quality_score >= 50.0

    def test_alias_headers_mapped(self):
        """'Activity', 'Days', 'Follows', 'State' should all map."""
        content = _csv(ALIAS_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        assert len(result.tasks) == 3
        assert result.tasks[0].task_name == "Site Prep"

    def test_empty_file_returns_empty_result(self):
        result = ScheduleParser().parse(b"", "empty.csv")
        assert result.tasks == [] or result.row_count == 0

    def test_missing_duration_inferred_from_start_end(self):
        rows = [{"Task": "X", "Start": "1", "End": "8", "Status": "Pending"}]
        content = _csv(rows)
        result = ScheduleParser().parse(content, "x.csv")
        if result.tasks:
            assert result.tasks[0].duration == 7   # 8 - 1

    def test_extra_columns_stored_in_extra(self):
        rows = [{"Task": "A", "Duration": "5", "Status": "Pending", "CarbonScore": "42"}]
        content = _csv(rows)
        result = ScheduleParser().parse(content, "a.csv")
        assert result.tasks[0].extra.get("CarbonScore") is not None

    def test_vendor_sheet_detected(self):
        content = _csv(VENDOR_ROWS)
        result = ScheduleParser().parse(content, "vendors.csv")
        assert len(result.vendors) == 2
        assert result.tasks == []

    def test_duplicate_tasks_no_crash(self):
        rows = STANDARD_TASKS + STANDARD_TASKS   # duplicate rows
        content = _csv(rows)
        result = ScheduleParser().parse(content, "dup.csv")
        assert len(result.tasks) >= 4   # at least original 4

    def test_unicode_task_names(self):
        rows = [{"Task": "施工准备", "Duration": "5", "Status": "Pending"}]
        content = _csv(rows)
        result = ScheduleParser().parse(content, "unicode.csv")
        if result.tasks:
            assert result.tasks[0].task_name == "施工准备"

    def test_row_count_matches(self):
        content = _csv(STANDARD_TASKS)
        result = ScheduleParser().parse(content, "schedule.csv")
        assert result.row_count == len(STANDARD_TASKS)

    def test_cycle_warning_generated(self):
        rows = [
            {"Task": "A", "Duration": "5", "DependsOn": "B", "Status": "Pending"},
            {"Task": "B", "Duration": "5", "DependsOn": "A", "Status": "Pending"},
        ]
        content = _csv(rows)
        result = ScheduleParser().parse(content, "cycle.csv")
        # Parser should warn, not crash
        cycle_warnings = [w for w in result.warnings if "circular" in w.lower() or "cycle" in w.lower()]
        assert len(cycle_warnings) > 0


# ─────────────────────────────────────────────────────────────────────────────
# PDF Parser
# ─────────────────────────────────────────────────────────────────────────────

class TestPDFParser:

    def test_plain_text_fallback(self):
        """PDFParser should not crash on non-PDF bytes."""
        parser = PDFParser()
        result = parser.parse(b"not a pdf", "fake.pdf")
        # Should either return empty chunks or a warning, never raise
        assert isinstance(result.chunks, list)

    def test_chunk_text_not_empty_for_real_content(self):
        """
        We can't ship a real PDF in tests, so we test the chunker directly.
        """
        parser = PDFParser()
        pages = ["This is page one with lots of important words about generators and cooling."]
        chunks = parser._chunk_pages(pages)
        assert len(chunks) > 0
        assert all(len(c.text) > 0 for c in chunks)

    def test_doc_type_detection_schedule(self):
        parser = PDFParser()
        pages = ["Project schedule milestone wbs baseline gantt chart"]
        assert parser._detect_doc_type(pages, "schedule.pdf") == "schedule"

    def test_doc_type_detection_spec(self):
        parser = PDFParser()
        pages = ["Technical specification shall comply with TIA-942"]
        assert parser._detect_doc_type(pages, "spec.pdf") == "spec"

    def test_doc_type_detection_rfi(self):
        parser = PDFParser()
        pages = ["Request for Information RFI-047 clarification"]
        assert parser._detect_doc_type(pages, "rfi.pdf") == "rfi"

    def test_chunk_overlap(self):
        """Adjacent chunks should have overlapping content."""
        parser = PDFParser()
        long_page = " ".join([f"word{i}" for i in range(1000)])
        chunks = parser._chunk_pages([long_page])
        if len(chunks) > 1:
            # Last words of chunk[0] should appear in start of chunk[1]
            words_end = set(chunks[0].text.split()[-20:])
            words_start = set(chunks[1].text.split()[:20])
            assert len(words_end & words_start) > 0

    def test_classify_chunk_types(self):
        parser = PDFParser()
        assert parser._classify_chunk("shall comply with requirement specification") == "spec"
        assert parser._classify_chunk("Request for Information RFI clarification") == "rfi"
        assert parser._classify_chunk("A normal sentence about construction progress.") == "text"

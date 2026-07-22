"""
synthetic/generate_data.py
============================
Generates realistic EPC data-centre project datasets for demo / testing.

Run:
    python synthetic/generate_data.py

Outputs (in synthetic/data/):
    schedule.csv       — 25-task DC construction schedule
    procurement.csv    — 10 vendor / equipment records
    project_notes.txt  — plain-text RFI / status notes for RAG
"""

import csv
import os
import random
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_DIR.mkdir(exist_ok=True)

random.seed(42)


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULE
# ─────────────────────────────────────────────────────────────────────────────
TASKS = [
    # (name, duration_days, depends_on, status, completion, delay_days)
    ("Site Preparation",           5,  [],                          "Completed", 100, 0),
    ("Civil Foundation",           12, ["Site Preparation"],        "Completed", 100, 0),
    ("Structural Steel Erection",  10, ["Civil Foundation"],        "Completed", 100, 0),
    ("Roofing & Cladding",          8, ["Structural Steel Erection"], "Completed", 100, 0),
    ("HV Switchgear Installation", 14, ["Structural Steel Erection"], "Delayed",   60, 5),
    ("MV Distribution Setup",      10, ["HV Switchgear Installation"], "Pending",   0, 0),
    ("UPS System Installation",    12, ["MV Distribution Setup"],   "Pending",    0, 0),
    ("Generator Sets Installation",10, ["Civil Foundation"],        "Delayed",   40, 8),
    ("Fuel Storage & Pipework",     6, ["Generator Sets Installation"], "Pending", 0, 0),
    ("Cooling Tower Installation", 15, ["Civil Foundation"],        "Delayed",   50, 6),
    ("CRAC Units Setup",           10, ["Cooling Tower Installation"], "Pending",  0, 0),
    ("Chiller Plant Commissioning", 7, ["CRAC Units Setup"],        "Pending",    0, 0),
    ("IT Room Sub-floor",           5, ["Roofing & Cladding"],      "Completed", 100, 0),
    ("Cable Tray Installation",     8, ["IT Room Sub-floor"],       "Running",   55, 0),
    ("Electrical Cabling Works",   12, ["Cable Tray Installation", "MV Distribution Setup"], "Pending", 0, 0),
    ("BMS Cabling & Panels",        7, ["Electrical Cabling Works"], "Pending",   0, 0),
    ("Fire Suppression System",     9, ["IT Room Sub-floor"],       "Running",   30, 0),
    ("Security & Access Control",   5, ["BMS Cabling & Panels"],   "Pending",    0, 0),
    ("Network Infrastructure",      8, ["Electrical Cabling Works"], "Pending",   0, 0),
    ("Server Rack Installation",   10, ["Network Infrastructure"],  "Pending",    0, 0),
    ("Integrated System Testing",  14, ["UPS System Installation","Chiller Plant Commissioning","Server Rack Installation"], "Pending", 0, 0),
    ("Power-On Sequence Test",      5, ["Integrated System Testing"], "Pending",  0, 0),
    ("Load Bank Testing",           7, ["Power-On Sequence Test"],  "Pending",    0, 0),
    ("Tier III Audit & Certification",10,["Load Bank Testing","Fire Suppression System","Security & Access Control"], "Pending", 0, 0),
    ("Facility Handover",           3, ["Tier III Audit & Certification"], "Pending", 0, 0),
]

SCHEDULE_HEADERS = ["Task", "DependsOn", "Duration", "Status", "Completion%", "DelayDays", "Owner"]
OWNERS = ["Rajesh Kumar", "Priya Nair", "Arjun Singh", "Deepa Menon", "Vikram Patel", "Sunita Rao"]


def generate_schedule():
    path = OUTPUT_DIR / "schedule.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=SCHEDULE_HEADERS)
        writer.writeheader()
        for name, dur, deps, status, comp, delay in TASKS:
            writer.writerow({
                "Task": name,
                "DependsOn": "; ".join(deps) if deps else "-",
                "Duration": dur,
                "Status": status,
                "Completion%": comp,
                "DelayDays": delay,
                "Owner": random.choice(OWNERS),
            })
    print(f"✅  schedule.csv   — {len(TASKS)} tasks")


# ─────────────────────────────────────────────────────────────────────────────
# PROCUREMENT
# ─────────────────────────────────────────────────────────────────────────────
VENDORS = [
    ("ABB India Ltd",        "HV Switchgear",         45, "Delayed",  0.72, 52),
    ("Cummins India",        "Generator Sets",         60, "At Risk",  0.68, 68),
    ("Emerson Network",      "UPS Systems",            35, "On Track", 0.95, 28),
    ("Stulz GmbH",           "CRAC Units",             50, "Delayed",  0.70, 58),
    ("Thermax Ltd",          "Cooling Towers",         40, "Delayed",  0.65, 46),
    ("Schneider Electric",   "MV Panels",              30, "On Track", 0.90, 32),
    ("Legrand India",        "Cable Trays & Conduits", 20, "On Track", 0.92, 22),
    ("Honeywell India",      "BMS Hardware",           25, "At Risk",  0.75, 30),
    ("Tyco / Johnson Ctrl",  "Fire Suppression",       28, "On Track", 0.88, 30),
    ("Bosch Security",       "Access Control System",  22, "On Track", 0.91, 24),
]

VENDOR_HEADERS = ["Vendor", "Equipment", "LeadTimeDays", "DeliveryStatus", "ReliabilityScore", "ExpectedArrivalDay"]


def generate_procurement():
    path = OUTPUT_DIR / "procurement.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=VENDOR_HEADERS)
        writer.writeheader()
        for name, equip, lead, status, rel, arrival in VENDORS:
            writer.writerow({
                "Vendor": name,
                "Equipment": equip,
                "LeadTimeDays": lead,
                "DeliveryStatus": status,
                "ReliabilityScore": rel,
                "ExpectedArrivalDay": arrival,
            })
    print(f"✅  procurement.csv — {len(VENDORS)} vendors")


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT NOTES (plain text for RAG)
# ─────────────────────────────────────────────────────────────────────────────
NOTES = """
PROJECT STATUS UPDATE — Bangalore Hyperscale DC (Phase 1)
Date: Week 18
Prepared by: Project Management Office

EXECUTIVE SUMMARY
Construction is progressing with significant delays in the power and cooling workstreams.
The HV Switchgear supply from ABB India has been pushed back by 5 days due to factory
scheduling conflicts. Generator sets from Cummins India are now 8 days late owing to
customs clearance delays at Nhava Sheva port.

CRITICAL PATH ITEMS
The Cooling Tower installation from Thermax Ltd is 6 days behind schedule. This directly
impacts the CRAC unit setup and downstream chiller commissioning, which are prerequisites
for the Integrated System Testing sequence. Immediate escalation to Thermax senior
management has been recommended.

RFI LOG
RFI-047: Clarification on grounding requirements for MV panels — Resolved.
  Response: Follow IS 3043:2018 standard. Copper earth bar 50x6mm minimum.

RFI-052: Generator paralleling scheme — Open.
  Query: Confirm synchronisation relay model for 2N+1 redundancy configuration.
  Expected response: 5 working days.

RFI-055: UPS battery room ventilation rate — Resolved.
  Response: Minimum 6 air changes per hour per battery manufacturer specification.

VENDOR PERFORMANCE NOTES
ABB India: Historical on-time delivery rate 72%. Current shipment delayed.
  Backup option identified: C&S Electric Ltd (15-day lead time, 88% reliability).

Cummins India: Customs clearance issue expected to resolve within 3 days.
  Recommend no backup action at this stage — monitor daily.

Thermax Ltd: Cooling tower delay is most critical. Backup supplier Paharpur Cooling
  Towers has been pre-qualified and can deliver in 12 days if order placed immediately.

QUALITY & COMPLIANCE
Structural inspections completed for all civil works — no NCRs raised.
Electrical installation to be verified against TIA-942 Tier III requirements
before integrated testing commences. BICSI TDMM 14th edition to be referenced
for cabling standards compliance. Uptime Institute audit scheduled for week 28.

WEATHER IMPACT
Monsoon onset expected week 22. All external civil works must be completed by week 21.
Internal works can continue through monsoon season without impact.

RISK REGISTER HIGHLIGHTS
Risk 1 (HIGH): Cooling tower delay → cascading impact on commissioning → 9+ day project delay.
Risk 2 (HIGH): Generator customs clearance → power redundancy testing delay.
Risk 3 (MEDIUM): RFI-052 unresolved → may delay generator paralleling installation.
Risk 4 (LOW): Monsoon onset — external works tracking to complete on time.

RECOMMENDED ACTIONS
1. Immediately activate backup cooling tower supplier (Paharpur) — saves 9 days.
2. Escalate generator customs clearance through freight forwarder — target 3-day resolution.
3. Close RFI-052 within 2 days to unblock generator installation team.
4. Review IST sequence — consider parallel start of BMS commissioning.
"""


def generate_notes():
    path = OUTPUT_DIR / "project_notes.txt"
    path.write_text(NOTES.strip())
    print(f"✅  project_notes.txt — {len(NOTES.split())} words")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n📦 Generating synthetic EPC project dataset...\n")
    generate_schedule()
    generate_procurement()
    generate_notes()
    print(f"\n✅  All files written to: {OUTPUT_DIR.resolve()}\n")
    print("Next step:")
    print("  python -m uvicorn app.main:app --reload")
    print("  Then POST /api/v1/auth/demo-login to get a token")
    print("  Then POST /api/v1/projects to create a project")
    print("  Then POST /api/v1/upload/commit with schedule.csv\n")

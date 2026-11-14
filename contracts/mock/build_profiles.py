#!/usr/bin/env python3
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))

from project_integrity import SCENARIOS, expected_users  # noqa: E402

AS_OF = "2026-11-01"

PROFILES = {
    "startup": {
        "name": "Receipt scanner",
        "summary": "A web app where freelancers and small accounting firms upload receipts and invoices; a worker reads the fields and files them for the monthly VAT return.",
        "owner": "Two founders and one contractor",
        "business": {"model": "b2b_saas", "customers": "Freelancers and accounting firms with up to 20 staff, on a monthly plan.",
                     "markets": ["Romania", "Bulgaria"],
                     "critical_flows": ["Upload a receipt and see it read within a minute", "Export the month's VAT file"]},
        "environments": [
            {"name": "prod", "stacks": ["main"], "purpose": "The only environment: releases are tested on production behind a feature flag.",
             "always_on": True, "data": "production", "users": "customers"}],
        "users": {"metric": "monthly_active_users", "definition": "Accounts that uploaded or exported at least once in 30 days.",
                  "current": {"value": 6500, "as_of": AS_OF, "provenance": "synthetic", "source": "hand-written mock"},
                  "peak_concurrent": 420},
        "milestones": {6: "After the marketing campaign", 12: None, 24: None},
    },
    "demo-shop": {
        "name": "Demo shop",
        "summary": "An EU e-commerce company: the storefront and order system, a data platform for recommendations and reporting, and a legacy ERP the finance team still runs on.",
        "owner": "Platform team (6 engineers)",
        "business": {"model": "b2c", "customers": "Shoppers in the EU; finance and warehouse staff use the ERP.",
                     "markets": ["Germany", "Austria", "Romania", "Poland"],
                     "critical_flows": ["Browse, add to cart and check out", "Order reaches the warehouse", "Nightly finance reports"]},
        "environments": [
            {"name": "prod", "stacks": ["shop", "data", "legacy"], "purpose": "Live storefront, data platform and ERP.",
             "always_on": True, "data": "production", "users": "customers and staff"},
            {"name": "staging", "stacks": ["shop"], "purpose": "The shop-staging EKS cluster, inside the shop stack's VPC; 12 nodes kept up between releases.",
             "always_on": True, "data": "synthetic", "users": "QA"},
            {"name": "dev", "stacks": ["dev"], "purpose": "A dev sandbox nobody has cleaned up: jump boxes and NAT gateways.",
             "always_on": True, "data": "none", "users": "engineers"}],
        "users": {"metric": "monthly_active_users", "definition": "Unique signed-in or cookied shoppers in 30 days.",
                  "current": {"value": 1_200_000, "as_of": AS_OF, "provenance": "synthetic", "source": "hand-written mock"},
                  "peak_concurrent": 14_000},
        "milestones": {6: "After the marketplace launch", 12: None, 24: None, 36: None},
    },
    "clinic-booking": {
        "name": "Clinic booking",
        "summary": "A booking platform for private clinics: patients find a doctor and book a slot online, clinic staff manage calendars and patient files, and reminders go out by SMS and e-mail.",
        "owner": "Booking team (9 engineers)",
        "business": {"model": "b2b_saas", "customers": "Private clinic chains pay per doctor; their patients book for free.",
                     "markets": ["Romania"],
                     "critical_flows": ["Search for a free slot and book it", "Clinic staff open a patient file",
                                        "Reminder sent 24 h before the visit"]},
        "environments": [
            {"name": "prod", "stacks": ["prod"], "purpose": "Live booking API, patient database and reminders.",
             "always_on": True, "data": "production", "users": "patients and clinic staff"},
            {"name": "staging", "stacks": ["staging"], "purpose": "Release candidates; full prod size, restored weekly from a prod snapshot.",
             "always_on": True, "data": "copy_of_production", "users": "QA and two pilot clinics"},
            {"name": "dev", "stacks": ["dev"], "purpose": "Shared dev database and the self-hosted CI runner.",
             "always_on": True, "data": "synthetic", "users": "engineers"}],
        "users": {"metric": "monthly_active_users", "definition": "Patients who booked or changed a visit plus clinic staff who signed in, in 30 days.",
                  "current": {"value": 41_000, "as_of": AS_OF, "provenance": "synthetic", "source": "hand-written mock"},
                  "peak_concurrent": 1900},
        "milestones": {6: None, 9: "Hungary launch", 12: None, 24: None},
    },
    "fleet-telemetry": {
        "name": "Fleet telemetry",
        "summary": "GPS tracking for courier vans: every van sends its position every few seconds, dispatchers watch a live map and get alerts when a delivery runs late or a van leaves its zone.",
        "owner": "Telemetry team (5 engineers)",
        "business": {"model": "b2b_saas", "customers": "Courier and delivery companies pay per van; dispatchers and drivers use it.",
                     "markets": ["Romania", "Hungary", "Czechia"],
                     "critical_flows": ["A van's position shows on the live map within two seconds",
                                        "Late-delivery alert reaches the dispatcher"]},
        "environments": [
            {"name": "prod", "stacks": ["prod"], "purpose": "Ingest pipeline, live map API and customer accounts.",
             "always_on": True, "data": "production", "users": "dispatchers and drivers"},
            {"name": "dev", "stacks": ["dev"], "purpose": "A dev stream fed by a trace replay box; no staging, releases go from dev to prod.",
             "always_on": True, "data": "copy_of_production", "users": "engineers"}],
        "users": {"metric": "daily_active_users", "definition": "Dispatchers signed in to the map plus drivers with the app open, per day.",
                  "current": {"value": 3200, "as_of": AS_OF, "provenance": "synthetic", "source": "hand-written mock"},
                  "peak_concurrent": 2100,
                  "note": "About 6,000 vans send positions today; vans are devices, not users."},
        "milestones": {4: "Two courier networks onboard", 6: None, 12: None, 18: None},
    },
}


def forecast_of(project):
    return json.loads((HERE / f"{project}.forecast.json").read_text())


def expected_rows(current, forecast, milestones):
    rows = []
    for month, note in milestones.items():
        row = {"month": month, **{s: expected_users(current, forecast, month, s) for s in SCENARIOS}}
        if note:
            row["note"] = note
        rows.append(row)
    return rows


def profile(project):
    spec, forecast = PROFILES[project], forecast_of(project)
    users = {**spec["users"], "expected": expected_rows(spec["users"]["current"]["value"], forecast, spec["milestones"])}
    return {"schema_version": "1.0", "project": project, "name": spec["name"], "summary": spec["summary"], "owner": spec["owner"],
            "business": spec["business"], "forecast_id": forecast["id"], "environments": spec["environments"], "users": users}


if __name__ == "__main__":
    for project in sys.argv[1:] or PROFILES:
        path = HERE / f"{project}.project.json"
        path.write_text(json.dumps(profile(project), indent=2, ensure_ascii=False) + "\n")
        print(f"wrote {path.name}")

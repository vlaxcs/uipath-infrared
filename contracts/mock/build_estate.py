#!/usr/bin/env python3
"""Build the Northwind estate: one company infrastructure holding ten applications.

Reuses the components and edges of the four mock companies and clones some of
them into four more applications. Ownership is planted the way a real company
has it (mostly Project and Environment tags, one CloudFormation stack, one
Kubernetes namespace, one application named only by its resources, a NAT shared
by two applications, a dev sandbox nobody tagged), and the extractor's own
resolver turns it into stacks, so a mock run sees what a real extraction gives.

    python contracts/mock/build_estate.py
"""

import copy
import json
import sys
from pathlib import Path

MOCK = Path(__file__).resolve().parent
REPO = MOCK.parents[1]
sys.path.insert(0, str(REPO / "apps" / "extractor"))

from extractor.domain.ownership import resolve_ownership  # noqa: E402
from extractor.domain.stacks import stack_entries  # noqa: E402

ESTATE = "northwind"


def load(name):
    return json.loads((MOCK / f"{name}.infra.json").read_text(encoding="utf-8"))


SOURCES = {name: load(name) for name in ("demo-shop", "startup", "clinic-booking", "fleet-telemetry")}


def demo_project(component):
    return {"shop": "storefront", "data": "data-platform", "legacy": "erp", "dev": None}[component["stack"]]


def environment_of(component, source):
    if source == "demo-shop":
        return "staging" if "staging" in component["id"] else ("dev" if component["stack"] == "dev" else "prod")
    if source == "startup":
        return "prod"
    return component["stack"]


SIGNAL = {
    "storefront": "tag", "receipts": "tag", "clinic-booking": "tag", "hr-portal": "tag", "payments": "tag",
    "support-assistant": "tag", "marketing-site": "tag", "data-platform": "cloudformation", "fleet": "namespace", "erp": "name",
}

PROJECTS = [
    ("storefront", "Storefront", "The online shop customers order from: web fleet, Kubernetes, orders database, sessions cache.", "monthly_active_users", 1200000, [(36, 2010400, 3427000, 6894600)]),
    ("data-platform", "Data platform", "Clickstream ingestion, the data lake and the analysts' Spark jobs.", "internal_users", 120, [(36, 130, 160, 220)]),
    ("erp", "ERP", "The legacy ERP: orders API, invoices, admin portal and reports.", "internal_users", 380, [(36, 380, 400, 430)]),
    ("receipts", "Receipt scanner", "The receipt-scanning app sold to freelancers and small accounting firms.", "monthly_active_users", 6500, [(24, 8500, 13600, 21700), (36, 9500, 17000, 30000)]),
    ("clinic-booking", "Clinic booking", "Patients book a doctor online; clinic staff manage calendars and patient files.", "monthly_active_users", 41000, [(24, 70300, 112500, 178500), (36, 80000, 140000, 230000)]),
    ("fleet", "Fleet telemetry", "GPS tracking and alerts for courier vans.", "daily_active_users", 3200, [(18, 6900, 10700, 16400), (36, 8000, 15000, 26000)]),
    ("payments", "Payments API", "Card payments for the storefront and partner shops.", "monthly_active_users", 52000, [(24, 90000, 150000, 240000), (36, 100000, 190000, 320000)]),
    ("hr-portal", "HR portal", "Internal tool: leave, payslips and onboarding for employees.", "internal_users", 900, [(24, 1000, 1300, 1700), (36, 1050, 1450, 1900)]),
    ("support-assistant", "Support assistant", "AI chat that answers customer questions, on GPU nodes.", "monthly_active_users", 15000, [(12, 30000, 60000, 110000), (36, 40000, 95000, 180000)]),
    ("marketing-site", "Marketing site", "Public website and landing pages.", "monthly_visitors", 300000, [(12, 330000, 450000, 650000), (36, 360000, 560000, 900000)]),
]

CLONES = {
    "payments": ("clinic-booking", ["prod-alb", "prod-api", "prod-db", "prod-reminders"]),
    "hr-portal": ("startup", ["web-server", "app-db", "uploads"]),
    "support-assistant": ("demo-shop", ["ng-data-gpu", "q-orders", "s3-uploads"]),
    "marketing-site": ("startup", ["uploads", "worker"]),
}


def ownership_tags(project, environment):
    signal = SIGNAL[project]
    if signal == "tag":
        return {"Project": project, "Environment": environment}
    if signal == "cloudformation":
        return {"aws:cloudformation:stack-name": f"{project}-{environment}"}
    if signal == "namespace":
        return {"kubernetes.io/namespace": f"{project}-{environment}"}
    return {}


def placed(component, project, environment, new_id):
    found = copy.deepcopy(component)
    found["id"] = new_id
    found["name"] = new_id
    tags = {k: v for k, v in (found.get("tags") or {}).items()}
    if project:
        tags.update(ownership_tags(project, environment))
    found["tags"] = tags
    if not found["tags"]:
        found.pop("tags")
    return found


def build():
    components, edges, renamed = [], [], {}

    def add(source, component, project, environment):
        owner = project or ("egress" if component["kind"] == "nat" and source == "startup" else "sandbox")
        new_id = f"{owner}-{component['id']}".replace(f"{owner}-{owner}-", f"{owner}-")
        renamed[(source, component["id"])] = new_id
        components.append(placed(component, project, environment, new_id))

    for component in SOURCES["demo-shop"]["components"]:
        add("demo-shop", component, demo_project(component), environment_of(component, "demo-shop"))
    for component in SOURCES["startup"]["components"]:
        project = None if component["kind"] == "nat" else "receipts"
        add("startup", component, project, "prod")
    for component in SOURCES["clinic-booking"]["components"]:
        add("clinic-booking", component, "clinic-booking", environment_of(component, "clinic-booking"))
    for component in SOURCES["fleet-telemetry"]["components"]:
        add("fleet-telemetry", component, "fleet", environment_of(component, "fleet-telemetry"))

    for source, edges_of in SOURCES.items():
        for edge in edges_of["edges"]:
            moved = copy.deepcopy(edge)
            moved["id"] = f"{source}-{edge['id']}"
            moved["from"], moved["to"] = renamed[(source, edge["from"])], renamed[(source, edge["to"])]
            edges.append(moved)

    for project, (source, ids) in CLONES.items():
        originals = {c["id"]: c for c in SOURCES[source]["components"]}
        clone_ids = {}
        for original in ids:
            new_id = f"{project}-{original.replace('prod-', '')}"
            clone_ids[original] = new_id
            components.append(placed(originals[original], project, "prod", new_id))
        for edge in SOURCES[source]["edges"]:
            if edge["from"] in clone_ids and edge["to"] in clone_ids:
                moved = copy.deepcopy(edge)
                moved["id"] = f"{project}-{edge['id']}"
                moved["from"], moved["to"] = clone_ids[edge["from"]], clone_ids[edge["to"]]
                edges.append(moved)

    shared_nat = renamed[("startup", "nat")]
    edges.append({"id": "shared-nat-storefront", "from": renamed[("demo-shop", "vm-batch")], "to": shared_nat, "kind": "network",
                  "evidence": "declared", "note": "The storefront's batch jobs reach the internet through the receipts team's NAT."})

    components = resolve_ownership(components, edges, known_projects=[p[0] for p in PROJECTS])

    stay_together = []
    for group in SOURCES["demo-shop"].get("stay_together", []):
        moved = copy.deepcopy(group)
        moved["members"] = [renamed[("demo-shop", member)] for member in group["members"]]
        stay_together.append(moved)

    demo = SOURCES["demo-shop"]
    infra = {
        "schema_version": demo["schema_version"],
        "project": ESTATE,
        "source": {**demo["source"], "notes": "Hand-written estate built by contracts/mock/build_estate.py from the four mock companies; ownership planted as tags, a CloudFormation stack, a namespace and names, resolved by the extractor."},
        "stacks": stack_entries(components),
        "controls": demo["controls"],
        "components": components,
        "edges": edges,
        "stay_together": stay_together,
    }

    stacks_of = {}
    for component in components:
        owner = component["x_ownership"]["project"]
        if owner:
            stacks_of.setdefault(owner, set()).add(component["stack"])

    forecast = json.loads((REPO / "contracts" / "forecast.example.json").read_text(encoding="utf-8"))
    forecast["id"] = f"{ESTATE}-2027-plan"
    forecast["description"] = "Northwind: ten applications in one estate, each scaling on its own users."
    forecast["hard_constraints"]["budget"]["max_monthly_run_cost_eur"] = 320000
    forecast["hard_constraints"]["min_availability_pct"] = 99.5
    forecast["hard_constraints"]["budget"]["max_one_off_migration_cost_eur"] = 300000
    forecast["hard_constraints"]["max_migration_effort_hours"] = 2600
    forecast["hard_constraints"]["allowed_providers"] = ["aws", "supabase", "neon", "hetzner", "fly", "cloudflare", "backblaze", "runpod", "onprem"]
    forecast["business"]["downtime_cost_by_stack"] = {stack["id"]: 0 for stack in infra["stacks"] if stack["environment"] in ("dev", "staging")}
    forecast["business"]["downtime_cost_by_stack"].update({stack: 800 for stack in stacks_of.get("erp", ())})
    forecast.pop("events", None)
    forecast["projects"] = [
        {
            "id": project, "name": name, "stacks": sorted(stacks_of[project]),
            "users": {"metric": metric, "current": current,
                      "expected": [{"month": month, "low": low, "base": base, "high": high} for month, low, base, high in expected]},
        }
        for project, name, _, metric, current, expected in PROJECTS
    ]

    profiles = [{"id": p[0], "name": p[1], "summary": p[2]} for p in PROJECTS]
    return infra, forecast, profiles


def main():
    infra, forecast, profiles = build()
    (MOCK / f"{ESTATE}.infra.json").write_text(json.dumps(infra, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (MOCK / f"{ESTATE}.forecast.json").write_text(json.dumps(forecast, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (MOCK / f"{ESTATE}.projects.json").write_text(json.dumps({"estate": ESTATE, "projects": profiles}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    sources = {}
    for component in infra["components"]:
        sources[component["x_ownership"]["source"]] = sources.get(component["x_ownership"]["source"], 0) + 1
    print(f"{ESTATE}: {len(infra['components'])} components, {len(infra['edges'])} edges, {len(infra['stacks'])} stacks, {len(forecast['projects'])} projects; ownership by {sources}")


if __name__ == "__main__":
    main()

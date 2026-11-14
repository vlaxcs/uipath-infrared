#!/usr/bin/env python3
"""Derive the infrastructure snapshot at every state of a migration.

Reads a winning candidate's ordered actions from a sample ``result.json`` and
the baseline ``infra.json``, applies each action in turn, and writes the estate
as it exists after every step.  The component shape matches the dashboard's
``Component`` type so the two views can share one model:

    {id, kind, stack, status, quantity, zones, monthlyEur, securityIssue,
     typeLabel, facts:[{label, value}]}

Standard library only.  Usage (from anywhere):

    python3 apps/state-view/builder/build_states.py
    python3 apps/state-view/builder/build_states.py --out /tmp/states.json
    python3 apps/state-view/builder/build_states.py --layout managed_services --out /tmp/managed.json

By default the result's winner is built; ``--layout <candidate id>`` builds any
other candidate, feasible or not.  A candidate with no actions yields a single
state, so its target is the current estate.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = APP_ROOT / "data" / "states.json"

INFRA_PATH = REPO_ROOT / "contracts" / "mock" / "demo-shop.infra.json"
RESULT_PATH = APP_ROOT / "data" / "result.demo-shop.json"

LAYOUT_LABELS = {
    "move_to_onprem": "Move to on-prem",
    "cleanup_orphans": "Clean up orphans",
}


class LayoutError(ValueError):
    """The requested layout is not a candidate in the result."""

STAGE_ORDER = [
    "security_remediation",
    "cleanup_orphans",
    "rightsize_in_place",
    "high_availability",
    "managed_services",
    "move_to_onprem",
    "consolidate",
    "data_residency",
    "review",
]

STAGE_META = {
    "security_remediation": ("Secure", "Close public data stores and turn on backups"),
    "cleanup_orphans": ("Clean up", "Delete orphans and stale capacity"),
    "rightsize_in_place": ("Rightsize", "Fit pools to p95 demand"),
    "high_availability": ("Harden", "Spread critical tiers across zones"),
    "managed_services": ("Move to managed", "Hand eligible resources to managed services"),
    "move_to_onprem": ("Move on-prem", "Return workloads to the private estate"),
    "consolidate": ("Consolidate", "Fold overlapping capacity into shared resources"),
    "data_residency": ("Fix residency", "Move regulated data into the required region"),
    "review": ("Review", "Flag issues that need a human decision"),
}

ACTION_VERBS = {
    "remediate": "Secure",
    "delete": "Delete",
    "stop": "Stop",
    "resize": "Resize",
    "scale": "Scale",
    "move": "Move",
    "flag": "Flag",
    "autoscale": "Autoscale",
}

CHANGE_KINDS = {
    "remediate": "remediated",
    "delete": "removed",
    "stop": "removed",
    "move": "moved",
    "resize": "resized",
    "scale": "scaled",
    "flag": "flagged",
    "autoscale": "scaled",
}

KIND_TIER = {
    "load_balancer": "edge",
    "cdn": "edge",
    "dns": "edge",
    "kubernetes_cluster": "compute",
    "node_group": "compute",
    "container": "compute",
    "virtual_machine": "compute",
    "function": "compute",
    "postgres": "data",
    "nosql": "data",
    "cache": "data",
    "queue": "messaging",
    "stream": "messaging",
    "object_storage": "storage",
    "block_storage": "storage",
    "file_system": "storage",
    "nat": "network",
    "other": "identity",
}

KIND_LABEL = {
    "load_balancer": "ALB",
    "cdn": "CDN",
    "dns": "DNS",
    "kubernetes_cluster": "EKS",
    "node_group": "Node group",
    "container": "ECS",
    "virtual_machine": "EC2",
    "function": "Lambda",
    "postgres": "RDS",
    "nosql": "DynamoDB",
    "cache": "Cache",
    "queue": "SQS",
    "stream": "Kinesis",
    "object_storage": "S3",
    "block_storage": "EBS",
    "file_system": "EFS",
    "nat": "NAT",
    "other": "Other",
}

TIER_LABELS = {
    "edge": "Edge & DNS",
    "compute": "Compute",
    "data": "Data",
    "messaging": "Messaging",
    "storage": "Storage",
    "network": "Network",
    "identity": "Identity & registry",
}

CLOUD_PROVIDERS = {"aws", "gcp", "azure", "onprem", "on-prem"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def metric_value(block) -> float | None:
    if isinstance(block, dict):
        value = block.get("value")
    else:
        value = block
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def component_cost(component: dict) -> float:
    return metric_value((component.get("cost") or {}).get("monthly_eur")) or 0.0


def as_int(value) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(round(value))


def fmt_eur(value: float) -> str:
    return f"€{int(round(value)):,}"


def candidate_ids(result: dict) -> list[str]:
    return [c.get("id") for c in result.get("candidates") or [] if c.get("id")]


def find_candidate(result: dict, layout: str | None = None) -> dict:
    """The candidate named ``layout``, or the winner when ``layout`` is None."""
    wanted = layout if layout is not None else result.get("winner")
    for candidate in result.get("candidates") or []:
        if candidate.get("id") == wanted:
            return candidate
    available = ", ".join(candidate_ids(result)) or "none"
    if layout is None:
        raise LayoutError(f"winner candidate {wanted!r} not found in result (candidates: {available})")
    raise LayoutError(f"unknown layout {wanted!r}; candidates in this result: {available}")


def find_winner(result: dict) -> dict:
    return find_candidate(result, None)


def project_title(project) -> str:
    words = str(project or "").replace("-", " ").replace("_", " ").strip()
    return words[:1].upper() + words[1:] if words else "Estate"


def layout_label(layout_id: str) -> str:
    if layout_id in LAYOUT_LABELS:
        return LAYOUT_LABELS[layout_id]
    words = str(layout_id).replace("-", " ").replace("_", " ").strip()
    return words[:1].upper() + words[1:] if words else "Layout"


# ---------------------------------------------------------------------------
# Stage ordering
# ---------------------------------------------------------------------------


def infer_stage(action: dict) -> str:
    layer = action.get("layer")
    if layer:
        return layer
    verb = (action.get("action") or "").lower()
    if verb == "remediate":
        return "security_remediation"
    if verb in ("delete", "stop"):
        return "cleanup_orphans"
    if verb == "resize":
        return "rightsize_in_place"
    if verb in ("scale", "autoscale"):
        return "high_availability"
    if verb == "move":
        if action.get("signal") == "data_residency":
            return "data_residency"
        return "managed_services"
    if verb == "flag":
        return "review"
    return "review"


def stage_rank(stage_id: str) -> int:
    try:
        return STAGE_ORDER.index(stage_id)
    except ValueError:
        return len(STAGE_ORDER)


def order_actions(actions: list[dict]) -> list[tuple[str, dict]]:
    seen: list[str] = []
    for action in actions:
        stage_id = infer_stage(action)
        if stage_id not in seen:
            seen.append(stage_id)
    ordered: list[tuple[str, dict]] = []
    for stage_id in sorted(seen, key=stage_rank):
        for action in actions:
            if infer_stage(action) == stage_id:
                ordered.append((stage_id, action))
    return ordered


def stage_meta(stage_id: str) -> tuple[str, str]:
    if stage_id in STAGE_META:
        return STAGE_META[stage_id]
    words = stage_id.replace("-", " ").replace("_", " ").strip()
    return (words[:1].upper() + words[1:] if words else "Other", "Additional migration work")


# ---------------------------------------------------------------------------
# Action application
# ---------------------------------------------------------------------------


def parse_resize_target(raw) -> dict:
    if not isinstance(raw, str):
        return {}
    text = raw.strip()
    if not text or text.lower() in ("nothing", "none"):
        return {}
    match = re.match(r"^(\d+)\s*[x×]\s*(.+)$", text)
    if match:
        return {"quantity": int(match.group(1)), "sku": match.group(2).strip()}
    size = re.match(r"^(\d+)\s*(GB|GiB|TB)\s*(.*)$", text, re.IGNORECASE)
    if size:
        parsed = {"size_value": int(size.group(1)), "size_unit": size.group(2)}
        if size.group(3):
            parsed["sku"] = size.group(3).strip()
        return parsed
    return {"sku": text}


def apply_resize(component: dict, raw) -> None:
    parsed = parse_resize_target(raw)
    quantity = parsed.get("quantity")
    if quantity is not None:
        component["quantity"] = quantity
        scaling = component.get("scaling")
        if isinstance(scaling, dict):
            scaling["desired"] = quantity
            if scaling.get("autoscaling_enabled"):
                if isinstance(scaling.get("min"), int):
                    scaling["min"] = min(scaling["min"], quantity)
                if isinstance(scaling.get("max"), int):
                    scaling["max"] = max(scaling["max"], quantity)
            else:
                scaling["min"] = quantity
                scaling["max"] = quantity
    sku = parsed.get("sku")
    if sku:
        component["sku"] = sku
    if parsed.get("size_value") is not None:
        config = component.get("config")
        if not isinstance(config, dict):
            config = {}
            component["config"] = config
        config["size_gb"] = parsed["size_value"]
    if sku == "bursting":
        config = component.get("config")
        if not isinstance(config, dict):
            config = {}
            component["config"] = config
        config["throughput_mode"] = "bursting"


def apply_scale(component: dict, raw) -> None:
    if not isinstance(raw, str):
        return
    match = re.search(r"(\d+)\s*zones?", raw, re.IGNORECASE)
    if match:
        component["zones"] = int(match.group(1))


def looks_like_region(token: str) -> bool:
    return bool(re.match(r"^[a-z]{2}(?:-[a-z]+)+-\d+$", token))


def parse_move_target(raw) -> dict:
    if not isinstance(raw, str):
        return {}
    text = raw.strip()
    if not text or text.lower() in ("nothing", "none"):
        return {}
    shared = "(shared)" in text.lower()
    text = re.sub(r"\([^)]*\)", "", text).strip()
    parts = [part.strip() for part in text.split(",") if part.strip()]
    parsed: dict = {"shared": shared}
    head = parts[0] if parts else text
    tokens = head.split()
    if tokens:
        parsed["target"] = tokens[0]
        for token in tokens[1:]:
            if looks_like_region(token):
                parsed["region"] = token
    for part in parts[1:]:
        zone_match = re.match(r"^(\d+)\s*zones?$", part, re.IGNORECASE)
        if zone_match:
            parsed["zones"] = int(zone_match.group(1))
        elif looks_like_region(part):
            parsed["region"] = part
    return parsed


def apply_move(component: dict, raw) -> None:
    parsed = parse_move_target(raw)
    target = parsed.get("target")
    if target:
        if "-" in target:
            prefix, rest = target.split("-", 1)
            if prefix in CLOUD_PROVIDERS and rest:
                component["provider"] = "onprem" if prefix == "on-prem" else prefix
                component["service"] = rest
            else:
                component["service"] = target
        else:
            component["service"] = target
    if parsed.get("region"):
        component["region"] = parsed["region"]
    if parsed.get("zones") is not None:
        component["zones"] = parsed["zones"]
    if parsed.get("shared"):
        config = component.get("config")
        if not isinstance(config, dict):
            config = {}
            component["config"] = config
        config["deployment_mode"] = "shared"


def apply_remediate(component: dict, action: dict) -> None:
    security = component.get("security")
    if not isinstance(security, dict):
        security = {}
        component["security"] = security
    config = component.get("config")
    if isinstance(config, dict) and "anonymous_put_allowed" in config:
        config["anonymous_put_allowed"] = False
        config["public_access_blocked"] = True
    signal = action.get("signal") or ""
    if signal == "public_datastore":
        security["public_exposure"] = "vpc_only"
        security["world_open_ports"] = []
        security["encryption_at_rest"] = True
        if "backup_retention_days" in security:
            security["backup_retention_days"] = max(security.get("backup_retention_days") or 0, 14)
    elif signal == "unencrypted":
        security["encryption_at_rest"] = True
        security["world_open_ports"] = []
        if "backup_retention_days" in security:
            security["backup_retention_days"] = max(security.get("backup_retention_days") or 0, 7)
    else:
        security["encryption_at_rest"] = True
        if security.get("public_exposure") == "internet":
            security["public_exposure"] = "vpc_only"
        security["world_open_ports"] = []
        if "backup_retention_days" in security:
            security["backup_retention_days"] = max(security.get("backup_retention_days") or 0, 7)


def apply_autoscale(component: dict) -> None:
    scaling = component.get("scaling")
    if not isinstance(scaling, dict):
        quantity = component.get("quantity")
        quantity = quantity if isinstance(quantity, int) and quantity > 0 else 1
        scaling = {"min": quantity, "max": quantity * 2, "desired": quantity, "autoscaling_enabled": True}
        component["scaling"] = scaling
    scaling["autoscaling_enabled"] = True


def apply_action(components: list[dict], action: dict, change: dict) -> dict | None:
    """Mutate ``components`` in place; return a removal record when applicable."""
    component_id = change["component"]
    verb = change["action"] or ""
    index = next((i for i, component in enumerate(components) if component.get("id") == component_id), None)
    if index is None:
        return None

    component = components[index]
    if verb in ("delete", "stop"):
        removal = {
            "id": component.get("id"),
            "kind": component.get("kind"),
            "stack": component.get("stack", "shared"),
            "typeLabel": KIND_LABEL.get(component.get("kind"), component.get("kind")),
            "tier": KIND_TIER.get(component.get("kind"), "identity"),
            "monthlyEur": int(round(component_cost(component))),
            "action": verb,
            "reason": action.get("reason"),
            "atState": None,
            "atIndex": None,
        }
        del components[index]
        return removal

    if verb == "resize":
        apply_resize(component, action.get("to"))
    elif verb == "scale":
        apply_scale(component, action.get("to"))
    elif verb == "move":
        apply_move(component, action.get("to"))
    elif verb == "remediate":
        apply_remediate(component, action)
    elif verb == "autoscale":
        apply_autoscale(component)
    # flag leaves the resource in place; the change record is the output.

    component["x_change"] = {
        "kind": change["kind"],
        "action": verb or None,
        "reason": action.get("reason"),
        "from": action.get("from"),
        "to": action.get("to"),
    }
    return None


def adjust_cost(component: dict, saving: float) -> None:
    """Move this component's monthly cost by its share of the step's saving."""
    block = component.setdefault("cost", {}).setdefault("monthly_eur", {})
    current = metric_value(block) or 0.0
    block["value"] = int(round(current - saving))
    if isinstance(block, dict):
        block["provenance"] = "modelled"


# ---------------------------------------------------------------------------
# Public component shape (matches the dashboard's Component type)
# ---------------------------------------------------------------------------


def size_fact(component: dict) -> str:
    kind = component.get("kind")
    config = component.get("config") or {}
    quantity = component.get("quantity") or 1
    capacity = component.get("capacity") or {}

    def cap(key: str) -> float | None:
        return metric_value(capacity.get(key))

    if kind == "kubernetes_cluster":
        return f"{component.get('zones') or 1} zones · {'public' if config.get('endpoint_public') else 'private'} endpoint"
    sku = component.get("sku")
    if kind == "node_group":
        vcpu = cap("vcpu")
        tail = sku or (f"{int(vcpu)} vCPU each" if vcpu is not None else "")
        return f"{quantity} nodes" + (f" · {tail}" if tail else "")
    if kind == "virtual_machine":
        vcpu = cap("vcpu")
        tail = sku or (f"{int(vcpu)} vCPU each" if vcpu is not None else "")
        return f"{quantity} instances" + (f" · {tail}" if tail else "")
    if kind == "container":
        vcpu = cap("vcpu")
        tail = sku or (f"{int(vcpu)} vCPU each" if vcpu is not None else "")
        return f"{quantity} tasks" + (f" · {tail}" if tail else "")
    if kind in ("postgres", "cache"):
        parts = []
        if cap("vcpu") is not None:
            parts.append(f"{int(cap('vcpu'))} vCPU")
        if cap("memory_gb") is not None:
            parts.append(f"{int(cap('memory_gb'))} GB")
        if sku:
            parts.append(str(sku))
        return " · ".join(parts) or f"{quantity} node"
    if kind == "object_storage":
        objects = cap("object_count")
        versioning = "versioned" if config.get("versioning") else "no versioning"
        count = f"{int(objects):,} objects" if objects is not None else "objects"
        return f"{count} · {versioning}"
    if kind == "block_storage":
        size = cap("storage_gb") or config.get("size_gb_each") or 0
        attached = "unattached" if config.get("attached") is False else "attached"
        return f"{quantity} × {int(size)} GB · {attached}"
    if kind == "file_system":
        mode = config.get("throughput_mode")
        return f"{int(cap('throughput_mibps') or 0)} MiB/s" + (f" · {mode}" if mode else "")
    if kind == "nosql":
        return f"{int(cap('provisioned_rcu') or 0)} RCU · {int(cap('provisioned_wcu') or 0)} WCU"
    if kind == "queue":
        return f"{config.get('retention_days') or 0}d retention · {'DLQ' if config.get('dlq') else 'no DLQ'}"
    if kind == "function":
        return f"{cap('memory_gb') or 0} GB · {cap('timeout_s') or 0}s"
    if kind == "stream":
        return f"{int(cap('shards') or 0)} shards"
    if kind == "nat":
        return f"{quantity} gateways"
    if kind == "load_balancer":
        listeners = config.get("listeners") or ["listener"]
        if isinstance(listeners, list):
            listeners = ", ".join(str(item) for item in listeners)
        return f"{listeners} · {quantity} ×"
    return f"{quantity} ×"


PLACEMENT_LABEL = {"moved": "Placement"}


def facts_of(component: dict) -> list[dict]:
    change = component.get("x_change") or {}
    kind = change.get("kind")
    if kind in PLACEMENT_LABEL and change.get("to"):
        size = {"label": PLACEMENT_LABEL[kind], "value": str(change["to"])}
    else:
        size = {"label": "Size", "value": size_fact(component)}
    return [size, {"label": "Cost", "value": f"{fmt_eur(component_cost(component))}/mo"}]


def security_issue(component: dict) -> str | None:
    security = component.get("security") or {}
    if security.get("public_exposure") == "internet":
        return "public"
    config = component.get("config") or {}
    if config.get("anonymous_put_allowed") is True:
        return "public"
    if security.get("encryption_at_rest") is False:
        return "unencrypted"
    return None


def public_component(component: dict) -> dict:
    return {
        "id": component.get("id"),
        "kind": component.get("kind"),
        "tier": KIND_TIER.get(component.get("kind"), "identity"),
        "stack": component.get("stack", "shared"),
        "status": component.get("status")
        if component.get("status") in ("idle", "orphan")
        else "active",
        "quantity": component.get("quantity") or 1,
        "zones": component.get("zones"),
        "monthlyEur": int(round(component_cost(component))),
        "securityIssue": security_issue(component),
        "typeLabel": KIND_LABEL.get(component.get("kind"), component.get("kind")),
        "facts": facts_of(component),
        "provider": component.get("provider"),
        "region": component.get("region"),
        "service": component.get("service"),
        "sku": component.get("sku"),
    }


def public_edges(edges: list[dict], ids: set[str]) -> list[dict]:
    out = []
    for edge in edges:
        if edge.get("from") in ids and edge.get("to") in ids:
            out.append(
                {
                    "from": edge.get("from"),
                    "to": edge.get("to"),
                    "kind": edge.get("kind"),
                    "note": edge.get("note"),
                }
            )
    return out


# ---------------------------------------------------------------------------
# Cost model
# ---------------------------------------------------------------------------


def scaled_deltas(actions: list[dict], base: float, end: float) -> list[int]:
    """Per-action savings scaled so the cumulative total lands on ``base - end``."""
    count = len(actions)
    if count == 0:
        return []
    raw = [float(action.get("saving_eur_month") or 0) for action in actions]
    total_saving = base - end
    raw_total = sum(raw)
    if raw_total == 0:
        deltas = [int(round(total_saving / count))] * count
    else:
        scale = total_saving / raw_total
        deltas = [int(round(value * scale)) for value in raw]
    deltas[-1] += int(round(total_saving)) - sum(deltas)
    return deltas


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------


def change_of(action: dict) -> dict:
    verb = (action.get("action") or "").lower()
    return {
        "component": action.get("component"),
        "kind": CHANGE_KINDS.get(verb, verb or "changed"),
        "action": verb or None,
        "verb": ACTION_VERBS.get(verb, verb.capitalize() or "Change"),
        "reason": action.get("reason"),
        "from": action.get("from"),
        "to": action.get("to"),
        "saving_eur": as_int(action.get("saving_eur_month")) or 0,
        "effort_hours": as_int(action.get("effort_hours")) or 0,
    }


def build_dataset(
    layout: str | None = None,
    infra_path: Path | str | None = None,
    result_path: Path | str | None = None,
) -> dict:
    """States for one candidate: the winner when ``layout`` is None."""
    infra_path = Path(infra_path) if infra_path else INFRA_PATH
    result_path = Path(result_path) if result_path else RESULT_PATH
    infra = load_json(infra_path)
    result = load_json(result_path)
    # "winner" below is the chosen candidate, not necessarily the engine's winner.
    winner = find_candidate(result, layout)

    ordered = order_actions(winner.get("actions") or [])
    actions = [action for _, action in ordered]
    changes = [change_of(action) for action in actions]

    base = as_int((result.get("baseline") or {}).get("monthly_eur"))
    if base is None:
        base = int(round(sum(component_cost(c) for c in infra.get("components") or [])))
    winner_cost = winner.get("cost") or {}
    end = as_int(winner_cost.get("run_eur_month_now"))
    if end is None:
        end = base - int(round(sum(float(a.get("saving_eur_month") or 0) for a in actions)))
    deltas = scaled_deltas(actions, base, end)

    baseline_components = copy.deepcopy(infra.get("components") or [])
    baseline_edges = copy.deepcopy(infra.get("edges") or [])
    stacks = [
        {
            "id": stack["id"],
            "name": stack.get("name", stack["id"]),
            "environment": stack.get("environment"),
        }
        for stack in infra.get("stacks") or []
    ]

    working = copy.deepcopy(baseline_components)
    removed: list[dict] = []
    states: list[dict] = []
    previous_monthly = base
    stages: list[dict] = []
    stage_index: dict[str, int] = {}

    def snapshot(state_id: str, index: int, change: dict | None = None, **fields) -> dict:
        ids = {component.get("id") for component in working}
        components = [public_component(component) for component in working]
        for component in components:
            is_current = bool(change) and component["id"] == change.get("component")
            component["changed"] = change.get("kind") if is_current else None
            component["changedAction"] = change.get("action") if is_current else None
        return {
            "id": state_id,
            "index": index,
            "infra": {
                "project": infra.get("project", ""),
                "stacks": copy.deepcopy(stacks),
                "components": components,
                "edges": public_edges(copy.deepcopy(baseline_edges), ids),
            },
            **fields,
        }

    states.append(
        snapshot(
            "state-0",
            0,
            label="Current estate",
            shortLabel="Current estate",
            stageId="baseline",
            step=0,
            reason="The estate as the extractor found it. Every later state starts from here.",
            cost_source="observed",
            availability_pct=(result.get("baseline") or {}).get("availability_pct"),
            availability_source="observed",
            summary={
                "monthly_eur": base,
                "delta_eur": 0,
                "cumulative_saving_eur": 0,
                "availability_pct": (result.get("baseline") or {}).get("availability_pct"),
                "availability_source": "observed",
                "components": len(working),
                "changed": 0,
                "removed_total": 0,
            },
            changes=[],
            removed=[],
        )
    )

    for index, (stage_id, action) in enumerate(ordered):
        state_id = f"state-{index + 1}"
        change = changes[index]
        if stage_id not in stage_index:
            stage_index[stage_id] = len(stages)
            label, blurb = stage_meta(stage_id)
            stages.append(
                {
                    "id": stage_id,
                    "label": label,
                    "blurb": blurb,
                    "index": len(stages),
                    "stateIds": [],
                    "firstStateIndex": index + 1,
                    "lastStateIndex": index + 1,
                    "stepCount": 0,
                }
            )
        stage = stages[stage_index[stage_id]]
        stage["stateIds"].append(state_id)
        stage["lastStateIndex"] = index + 1
        stage["stepCount"] += 1

        removal = apply_action(working, action, change)
        saving = deltas[index]
        if removal is None:
            target = next((c for c in working if c.get("id") == change["component"]), None)
            if target is not None:
                adjust_cost(target, saving)
        else:
            removal["atState"] = state_id
            removal["atIndex"] = index + 1
            removed.append(removal)

        monthly = base - sum(deltas[: index + 1])
        final = index == len(actions) - 1
        verb = change["verb"]
        component_id = change["component"]
        short_label = f"{verb} {component_id}"
        label = "Target estate" if final else f"After {short_label[:1].lower()}{short_label[1:]}"
        delta = monthly - previous_monthly
        previous_monthly = monthly

        states.append(
            snapshot(
                state_id,
                index + 1,
                label=label,
                shortLabel="Target estate" if final else short_label,
                stageId=stage_id,
                step=index + 1,
                change=change,
                reason=(
                    "All steps applied. Target cost and availability come from the engine candidate."
                    if final
                    else change.get("reason") or ""
                ),
                cost_source="engine" if final else "modelled",
                availability_pct=winner.get("availability_pct") if final else None,
                availability_source="engine" if final else None,
                summary={
                    "monthly_eur": monthly,
                    "delta_eur": delta,
                    "cumulative_saving_eur": base - monthly,
                    "availability_pct": winner.get("availability_pct") if final else None,
                    "availability_source": "engine" if final else None,
                    "components": len(working),
                    "changed": 1,
                    "removed_total": len(removed),
                },
                changes=[change],
                removed=copy.deepcopy(removed),
            )
        )

    target_state = states[-1]
    baseline_block = {
        "monthly_eur": base,
        "availability_pct": (result.get("baseline") or {}).get("availability_pct"),
        "components": len(baseline_components),
        "stacks": len(stacks),
    }
    target_block = {
        "monthly_eur": end,
        "availability_pct": winner.get("availability_pct"),
        "components": target_state["summary"]["components"],
        "stacks": len(stacks),
        "effort_hours": as_int(winner.get("effort_hours")),
        "migration_eur": as_int(winner_cost.get("migration_eur")),
        "payback_months": winner.get("payback_months"),
    }

    return {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "project": infra.get("project", ""),
        "title": project_title(infra.get("project")),
        "subtitle": f"Sample plan · {len(stacks)} stacks · {len(baseline_components)} resources",
        "source": {
            "infra": relative(infra_path),
            "result": relative(result_path),
            "candidate": winner.get("id"),
            "sample": True,
        },
        "layout": {
            "id": winner.get("id"),
            "label": layout_label(winner.get("id")),
            "feasible": winner.get("feasible"),
            "winner": winner.get("id") == result.get("winner"),
            "rank": winner.get("rank"),
        },
        "stages": stages,
        "tiers": [{"id": tier, "label": label} for tier, label in TIER_LABELS.items()],
        "stepCount": len(actions),
        "baseline": baseline_block,
        "target": target_block,
        "states": states,
    }


def build_document(
    layout: str | None = None,
    infra_path: Path | str | None = None,
    result_path: Path | str | None = None,
) -> dict:
    return {"dataset": build_dataset(layout, infra_path, result_path)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate the estate-state snapshots.")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help=f"output path (default: {relative(DEFAULT_OUT)})")
    parser.add_argument("--layout", default=None, help="candidate id to build (default: the result's winner)")
    parser.add_argument("--result", default=None, help=f"engine result (default: {relative(RESULT_PATH)})")
    parser.add_argument("--infra", default=None, help=f"baseline infra (default: {relative(INFRA_PATH)})")
    args = parser.parse_args(argv)

    try:
        document = build_document(args.layout, args.infra, args.result)
    except LayoutError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = (Path.cwd() / out_path).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    dataset = document["dataset"]
    print(f"{dataset['title']}: {len(dataset['states'])} states, {len(dataset['stages'])} stages")
    print(f"wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

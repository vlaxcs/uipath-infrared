from typing import Any, Mapping

from engine.domain.model import (
    KINDS, Component, Edge, Infra, Metric, Scaling, Stack, StayTogether, Usage,
)
from engine.domain.provenance import Provenance

SUPPORTED_MAJOR = "1"


class UnsupportedSchemaVersion(ValueError):
    pass


def require_supported_version(document: Mapping[str, Any], label: str) -> str:
    version = str(document.get("schema_version", ""))
    if version.split(".")[0] != SUPPORTED_MAJOR:
        raise UnsupportedSchemaVersion(f"{label}: schema_version {version!r} is not 1.x")
    return version


def infra_from_document(document: Mapping[str, Any]) -> Infra:
    version = require_supported_version(document, "infra")
    components = tuple(sorted(
        (_component(raw) for raw in document["components"]), key=lambda c: c.id
    ))
    edges = tuple(_edge(raw, index) for index, raw in enumerate(document["edges"]))
    return Infra(
        schema_version=version,
        project=document["project"],
        is_mock=bool(document.get("source", {}).get("is_mock", False)),
        stacks={s["id"]: Stack(s["id"], s.get("environment", "unknown")) for s in document.get("stacks", [])},
        controls=dict(document.get("controls", {})),
        components=components,
        edges=edges,
        stay_together=tuple(
            StayTogether(g["id"], tuple(g["members"]), g.get("scope", "region"))
            for g in document.get("stay_together", [])
        ),
    )


def _component(raw: Mapping[str, Any]) -> Component:
    engine = raw.get("engine") or {}
    features = raw.get("features_used")
    return Component(
        id=raw["id"],
        kind=raw["kind"] if raw["kind"] in KINDS else "other",
        provider=raw["provider"],
        service=raw["service"],
        quantity=int(raw["quantity"]),
        region=raw["region"],
        zones=raw.get("zones"),
        status=raw["status"],
        stateful=bool(raw["stateful"]),
        stack=raw.get("stack"),
        parent=raw.get("parent"),
        sku=raw.get("sku"),
        engine_name=engine.get("name"),
        engine_version=engine.get("version"),
        features_used=None if features is None else frozenset(features),
        data_gb=_metric("data_gb", raw.get("data_gb")),
        data_classification=raw.get("data_classification", "unknown"),
        capacity=_metrics(raw.get("capacity")),
        usage=_usages(raw.get("usage")),
        scaling=_scaling(raw.get("scaling")),
        security=dict(raw.get("security") or {}),
        config=dict(raw.get("config") or {}),
        reported_cost=_metric("cost.monthly_eur", (raw.get("cost") or {}).get("monthly_eur")),
    )


def _metric(name: str, raw: Mapping[str, Any] | None) -> Metric | None:
    if not raw or raw.get("value") is None:
        return None
    return Metric(name, float(raw["value"]), raw.get("unit"), Provenance.parse(raw["provenance"]))


def _metrics(raw: Mapping[str, Any] | None) -> dict[str, Metric]:
    metrics = {key: _metric(key, value) for key, value in (raw or {}).items()}
    return {key: metric for key, metric in metrics.items() if metric is not None}


def _usages(raw: Mapping[str, Any] | None) -> dict[str, Usage]:
    return {
        key: Usage(
            name=key,
            unit=value.get("unit"),
            window_days=float(value.get("window_days") or 0),
            provenance=Provenance.parse(value["provenance"]),
            avg=value.get("avg"),
            min=value.get("min"),
            p50=value.get("p50"),
            p95=value.get("p95"),
            max=value.get("max"),
            sum=value.get("sum"),
        )
        for key, value in (raw or {}).items()
    }


def _scaling(raw: Mapping[str, Any] | None) -> Scaling | None:
    if not raw:
        return None
    return Scaling(raw.get("min"), raw.get("max"), raw.get("desired"), raw.get("autoscaling_enabled"))


def _edge(raw: Mapping[str, Any], index: int) -> Edge:
    return Edge(
        id=raw.get("id") or f"edge-{index}",
        source=raw["from"],
        target=raw["to"],
        kind=raw["kind"],
        evidence=raw["evidence"],
        gb_month=_metric("gb_month", raw.get("gb_month")),
        latency_sensitive=bool(raw.get("latency_sensitive", False)),
    )

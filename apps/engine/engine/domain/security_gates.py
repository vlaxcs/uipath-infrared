from engine.domain.end_state import EndState
from engine.domain.forecast import SecurityGates
from engine.domain.model import Component, Infra
from engine.domain.violation import Violation

PUBLIC_EXPOSURE = "internet"
ADMIN_PORTS = frozenset({22, 3389})
ALL_PORTS = -1
MIN_BACKUP_RETENTION_DAYS = 7
AUDIT_LOGGING_CONTROL = "audit_logging_enabled"
CONSTRAINT = "security_gates"


def check_security_gates(end_state: EndState, infra: Infra, gates: SecurityGates) -> tuple[Violation, ...]:
    components = [p.component for p in end_state.live()]
    violations: list[Violation] = []
    if gates.forbid_public_datastores:
        violations += [
            _gate("forbid_public_datastores", c.id, "datastore exposed to the internet")
            for c in components if c.stateful and c.security.get("public_exposure") == PUBLIC_EXPOSURE
        ]
    if gates.require_encryption_at_rest:
        violations += [
            _gate("require_encryption_at_rest", c.id, "datastore not encrypted at rest")
            for c in components if c.stateful and c.security.get("encryption_at_rest") is False
        ]
    if gates.forbid_world_open_admin_ports:
        violations += [
            _gate("forbid_world_open_admin_ports", c.id, f"open to the world: {_ports_text(ports)}")
            for c in components if (ports := _world_open_admin_ports(c))
        ]
    if gates.require_audit_logging and infra.controls.get(AUDIT_LOGGING_CONTROL) is False:
        violations.append(_gate("require_audit_logging", None, "audit logging is off for the account"))
    if gates.require_backups:
        violations += [
            _gate("require_backups", c.id, f"backup retention {days:g} days, under {MIN_BACKUP_RETENTION_DAYS}")
            for c in components if (days := _short_retention(c)) is not None
        ]
    return tuple(violations)


def _gate(rule: str, component: str | None, detail: str) -> Violation:
    return Violation(CONSTRAINT, component, detail, rule=rule)


def _world_open_admin_ports(component: Component) -> list[int]:
    ports = component.security.get("world_open_ports") or []
    return sorted(port for port in ports if port in ADMIN_PORTS or port == ALL_PORTS)


def _ports_text(ports: list[int]) -> str:
    return ", ".join("all ports" if port == ALL_PORTS else str(port) for port in ports)


def _short_retention(component: Component) -> float | None:
    days = component.security.get("backup_retention_days")
    if not component.stateful or days is None or days >= MIN_BACKUP_RETENTION_DAYS:
        return None
    return float(days)

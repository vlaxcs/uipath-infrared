from engine.domain.end_state import EndState
from engine.domain.forecast import SecurityGates
from engine.domain.model import Component, Infra
from engine.domain.violation import Violation

PUBLIC_EXPOSURE = "internet"
ADMIN_PORTS = frozenset({22, 3389})
ALL_PORTS = -1
MIN_BACKUP_RETENTION_DAYS = 7
AUDIT_LOGGING_CONTROL = "audit_logging_enabled"
AUDIT_LOGGING_GATE = "require_audit_logging"
CONSTRAINT_PREFIX = "security."


def check_security_gates(end_state: EndState, infra: Infra, gates: SecurityGates) -> tuple[Violation, ...]:
    violations = [
        Violation(CONSTRAINT_PREFIX + gate, placement.component.id, detail)
        for gate, finding in COMPONENT_GATES
        if getattr(gates, gate)
        for placement in end_state.live()
        if gate not in placement.remediated and (detail := finding(placement.component)) is not None
    ]
    audit_fixed = AUDIT_LOGGING_GATE in end_state.remediated_controls
    if gates.require_audit_logging and not audit_fixed and infra.controls.get(AUDIT_LOGGING_CONTROL) is False:
        violations.append(Violation(
            CONSTRAINT_PREFIX + AUDIT_LOGGING_GATE, None, "audit logging is off for the account",
        ))
    return tuple(violations)


def gate_of(violation: Violation) -> str | None:
    if not violation.constraint.startswith(CONSTRAINT_PREFIX):
        return None
    return violation.constraint.removeprefix(CONSTRAINT_PREFIX)


def _public_datastore(component: Component) -> str | None:
    exposed = component.stateful and component.security.get("public_exposure") == PUBLIC_EXPOSURE
    return "datastore exposed to the internet" if exposed else None


def _unencrypted(component: Component) -> str | None:
    unencrypted = component.stateful and component.security.get("encryption_at_rest") is False
    return "datastore not encrypted at rest" if unencrypted else None


def _open_admin_ports(component: Component) -> str | None:
    ports = component.security.get("world_open_ports") or []
    admin = sorted(port for port in ports if port in ADMIN_PORTS or port == ALL_PORTS)
    if not admin:
        return None
    return "open to the world: " + ", ".join("all ports" if port == ALL_PORTS else str(port) for port in admin)


def _no_backups(component: Component) -> str | None:
    days = component.security.get("backup_retention_days")
    if not component.stateful or days is None or days >= MIN_BACKUP_RETENTION_DAYS:
        return None
    return f"backup retention {days:g} days, under {MIN_BACKUP_RETENTION_DAYS}"


COMPONENT_GATES = (
    ("forbid_public_datastores", _public_datastore),
    ("require_encryption_at_rest", _unencrypted),
    ("forbid_world_open_admin_ports", _open_admin_ports),
    ("require_backups", _no_backups),
)

from engine.domain.candidate import ACCOUNT_SCOPE, Action, ActionKind
from engine.domain.end_state import EndState
from engine.domain.forecast import Forecast
from engine.domain.model import Infra
from engine.domain.security_gates import MIN_BACKUP_RETENTION_DAYS, check_security_gates, gate_of

MAKE_PRIVATE_HOURS = 4.0
ENCRYPT_AT_REST_HOURS = 8.0
CLOSE_ADMIN_PORTS_HOURS = 1.0
ENABLE_BACKUPS_HOURS = 1.0
ENABLE_AUDIT_LOGGING_HOURS = 2.0

EFFORT_HOURS_BY_GATE = {
    "forbid_public_datastores": MAKE_PRIVATE_HOURS,
    "require_encryption_at_rest": ENCRYPT_AT_REST_HOURS,
    "forbid_world_open_admin_ports": CLOSE_ADMIN_PORTS_HOURS,
    "require_backups": ENABLE_BACKUPS_HOURS,
    "require_audit_logging": ENABLE_AUDIT_LOGGING_HOURS,
}

FIX_BY_GATE = {
    "forbid_public_datastores": "remove public access",
    "require_encryption_at_rest": "encrypt at rest",
    "forbid_world_open_admin_ports": "close the admin ports to the world",
    "require_backups": f"enable backups with {MIN_BACKUP_RETENTION_DAYS} days of retention",
    "require_audit_logging": "turn on audit logging for the account",
}


def remediation_actions(end_state: EndState, infra: Infra, forecast: Forecast) -> tuple[Action, ...]:
    violations = check_security_gates(end_state, infra, forecast.constraints.security_gates)
    actions = [
        Action(
            component=violation.component or ACCOUNT_SCOPE,
            kind=ActionKind.REMEDIATE,
            reason=f"{FIX_BY_GATE[gate_of(violation)]}: {violation.detail}",
            signal=gate_of(violation),
        )
        for violation in violations
    ]
    return tuple(sorted(actions, key=lambda action: (action.component, action.signal)))


def remediation_effort_hours(actions: tuple[Action, ...]) -> float:
    return sum(
        EFFORT_HOURS_BY_GATE[action.signal] for action in actions if action.kind == ActionKind.REMEDIATE
    )

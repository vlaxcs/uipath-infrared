def mfa_enforced(iam):
    users = iam.user_names()
    if not users:
        return None
    return all(iam.mfa_devices(user) for user in users)


def collect_controls(context):
    api, guard = context.aws.controls, context.warnings.guard
    return {
        "audit_logging_enabled": guard("cloudtrail", lambda: bool(api.trails())),
        "threat_detection_enabled": guard("guardduty", lambda: bool(api.threat_detectors())),
        "config_recording_enabled": guard("config", lambda: bool(api.configuration_recorders())),
        "backup_plans_exist": guard("backup", lambda: bool(api.backup_plans())),
        "vpc_flow_logs_enabled": guard("flow logs", lambda: bool(context.aws.ec2.flow_logs())),
        "mfa_enforced": guard("mfa", lambda: mfa_enforced(context.aws.iam)),
    }

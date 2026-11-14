from collections import Counter

ENVIRONMENTS = ("dev", "staging", "prod")
SCENARIOS = ("low", "base", "high")


def expected_users(current, forecast, month, scenario):
    users = current * forecast["scenarios"][scenario]["monthly_multiplier"]["traffic"] ** month
    for event in forecast.get("events", []):
        if event["month"] <= month:
            users *= event.get("traffic_multiplier", 1)
    return int(users / 100 + 0.5) * 100


def project_integrity_errors(profile, infra=None, forecast=None):
    errors = [*_environment_errors(profile, infra)]
    if infra is not None and infra["project"] != profile["project"]:
        errors.append(f"project {profile['project']} but the infra is for {infra['project']}")
    if forecast is not None:
        errors.extend(_users_errors(profile, forecast))
    return errors


def _environment_errors(profile, infra):
    errors = []
    names = [env["name"] for env in profile["environments"]]
    errors.extend(f"environment {name} listed {n} times" for name, n in Counter(names).items() if n > 1)
    if infra is None:
        return errors
    stacks = {stack["id"]: stack.get("environment", "unknown") for stack in infra.get("stacks", [])}
    listed = {env["name"]: set(env["stacks"]) for env in profile["environments"]}
    for env in profile["environments"]:
        errors.extend(f"environment {env['name']}: stack {s} is not in the infra" for s in env["stacks"] if s not in stacks)
    for stack, environment in stacks.items():
        if environment in ENVIRONMENTS and stack not in listed.get(environment, set()):
            errors.append(f"stack {stack} is {environment} in the infra but not listed under environment {environment}")
    return errors


def _users_errors(profile, forecast):
    errors = []
    if profile["forecast_id"] != forecast["id"]:
        errors.append(f"forecast_id {profile['forecast_id']} but the forecast is {forecast['id']}")
    rows = profile["users"]["expected"]
    months = [row["month"] for row in rows]
    if months != sorted(set(months)):
        errors.append(f"expected months {months} are not strictly increasing")
    if months and months[-1] != forecast["horizon_months"]:
        errors.append(f"last expected month is {months[-1]}, the forecast horizon is {forecast['horizon_months']}")
    current = profile["users"]["current"]["value"]
    for row in rows:
        for scenario in SCENARIOS:
            want = expected_users(current, forecast, row["month"], scenario)
            if row[scenario] != want:
                errors.append(f"expected users at month {row['month']} ({scenario}) is {row[scenario]}, the forecast gives {want}")
    return errors

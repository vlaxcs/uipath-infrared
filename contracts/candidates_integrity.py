from collections import Counter
from fnmatch import fnmatch

ACCOUNT_SCOPE = "account"


def candidates_integrity_errors(doc, strategies, infra=None, catalog=None):
    components = _components_of(doc, infra)
    options = {option["id"]: option for option in catalog["options"]} if catalog else None
    errors = [*_id_errors(doc, strategies)]
    for candidate in doc["candidates"]:
        errors.extend(_action_errors(candidate, components, options))
    return errors


def _components_of(doc, infra):
    if infra is None or infra["project"] != doc["project"]:
        return None
    return {component["id"]: component for component in infra["components"]}


def _id_errors(doc, strategies):
    errors = []
    ids = [candidate["id"] for candidate in doc["candidates"]]
    errors.extend(f"duplicate candidate id {cid}" for cid, n in Counter(ids).items() if n > 1)
    seen = set()
    for candidate in doc["candidates"]:
        cid = candidate["id"]
        if cid in strategies:
            errors.append(f"{cid}: is the name of an engine strategy")
        parent = candidate["builds_on"]
        if parent is not None and parent not in strategies and parent not in seen:
            errors.append(f"{cid}: builds_on {parent} is neither an engine strategy nor an earlier candidate")
        if "revises" in candidate and doc["revision"] == 0:
            errors.append(f"{cid}: revises {candidate['revises']} at revision 0")
        seen.add(cid)
    return errors


def _action_errors(candidate, components, options):
    cid = candidate["id"]
    errors = [
        f"{cid}: more than one action on {component}"
        for component, n in Counter(action["component"] for action in candidate["actions"]).items()
        if n > 1
    ]
    for action in candidate["actions"]:
        component_id = action["component"]
        if component_id == ACCOUNT_SCOPE:
            if action["action"] != "remediate":
                errors.append(f"{cid}: only remediate applies to {ACCOUNT_SCOPE}")
            continue
        if components is None:
            continue
        component = components.get(component_id)
        if component is None:
            errors.append(f"{cid}: component {component_id} is not in the infra")
        elif options is not None and "to" in action:
            errors.extend(f"{cid}: {component_id}: {e}" for e in _target_errors(action, component, options))
    return errors


def _target_errors(action, component, options):
    target = action["to"]
    if "option" not in target:
        if "tier" in target and not any(target["tier"] in _tiers(o) for o in options.values() if o["kind"] == component["kind"]):
            return [f"tier {target['tier']} is not offered for kind {component['kind']}"]
        return []
    option = options.get(target["option"])
    if option is None:
        return [f"option {target['option']} is not in the catalog"]
    errors = []
    if option["kind"] != component["kind"]:
        errors.append(f"option {option['id']} is for {option['kind']}, the component is {component['kind']}")
    if "region" in target and not any(fnmatch(target["region"], pattern) for pattern in option.get("regions", [])):
        errors.append(f"option {option['id']} does not run in {target['region']}")
    if "tier" in target and target["tier"] not in _tiers(option):
        errors.append(f"option {option['id']} has no tier {target['tier']}")
    return errors


def _tiers(option):
    return {tier["id"] for tier in option["pricing"].get("tiers", [])}

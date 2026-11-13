from extractor.domain.db_stats import TABLE_LIMIT, db_stats, split_endpoint, truncated


def components_by_id(context):
    return {c["id"]: c for c in context.inventory.components}


def extract_db_stats(context, postgres):
    if postgres is None:
        context.warnings.note("postgres stats skipped: RDS_STATS_PASSWORD is empty")
        return
    components = components_by_id(context)
    for component_id, login in context.references.database_logins.items():
        if not login["endpoint"] or component_id not in components:
            continue
        host, port = split_endpoint(login["endpoint"])
        label = f"postgres stats {component_id} at {login['endpoint']}"
        result = context.warnings.guard(label, lambda: postgres.read(host, port, login["user"], login["database"]))
        if result is None:
            continue
        rows, index_count = result
        if truncated(rows):
            context.warnings.note(f"{label}: kept the {TABLE_LIMIT} most active of {len(rows)} tables")
        components[component_id]["db_stats"] = db_stats(rows, index_count, f"{login['endpoint']}/{login['database']}")

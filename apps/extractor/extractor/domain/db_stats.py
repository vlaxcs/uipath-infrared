TABLE_LIMIT = 100
COUNTERS = ("seq_scans", "idx_scans", "n_tup_ins", "n_tup_upd", "n_tup_del")


def split_endpoint(endpoint):
    host, _, port = endpoint.rpartition(":")
    return host, int(port)


def activity(row):
    return sum(row.get(c) or 0 for c in COUNTERS)


def table_entry(row):
    entry = {"schema": row["schema"], "table": row["table"], "size_bytes": max(0, int(row["size_bytes"] or 0))}
    if row.get("live_rows") is not None:
        entry["row_estimate"] = max(0, int(row["live_rows"]))
    for counter in COUNTERS:
        if row.get(counter) is not None:
            entry[counter] = int(row[counter])
    entry["provenance"] = "observed"
    return entry


def db_stats(rows, index_count, connection):
    ranked = sorted(rows, key=lambda r: (-activity(r), r["schema"], r["table"]))
    return {"tables": [table_entry(r) for r in ranked[:TABLE_LIMIT]], "indexes": int(index_count), "connection": connection}


def truncated(rows):
    return len(rows) > TABLE_LIMIT

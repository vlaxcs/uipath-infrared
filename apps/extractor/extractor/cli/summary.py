from collections import Counter

SHOWN_WARNINGS = 15


def summary_lines(path, document):
    components, edges, warnings = document["components"], document["edges"], document["x_extraction_warnings"]
    kinds = dict(sorted(Counter(c["kind"] for c in components).items()))
    statuses = {s: sum(1 for c in components if c["status"] == s) for s in ("active", "idle", "orphan")}
    lines = [f"wrote {path}", f"  {len(components)} components {kinds}", f"  {len(edges)} edges, status {statuses}", f"  {len(warnings)} warnings"]
    lines += [f"   - {w}" for w in warnings[:SHOWN_WARNINGS]]
    if "x_projects" in document:
        lines.append(f"  roadmap projects ({len(document['x_unassigned'])} components unassigned):")
        lines += [f"   - {project}: {len(found['components'])} components ({found['by_tag']} by tag, {found['by_name']} by name)"
                  for project, found in document["x_projects"].items()]
    return lines

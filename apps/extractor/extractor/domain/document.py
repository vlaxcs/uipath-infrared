from extractor.domain.stacks import stack_entries

EXTRACTOR_NAME = "infrared-floci-extractor"
EXTRACTOR_VERSION = "0.1"
SCHEMA_VERSION = "1.0"
EXTENDED_SCHEMA_VERSION = "1.1"
SOURCE_NOTES = ("Extracted from a live Floci emulator. Config fields are observed. Usage series are SYNTHETIC (Floci has no telemetry; they are injected by synth/metrics.py). "
                "Costs are ESTIMATES from approximate list prices. Stacks are derived from VPC/name prefixes (no tags exist). "
                "features_used is omitted: Postgres extensions are not visible through the RDS API. Edges are declared by configuration only (no flow logs). "
                "The extractor never read ground_truth/.")


def timestamp(moment):
    return moment.isoformat(timespec="seconds").replace("+00:00", "Z")


def infra_document(project, endpoint, region, generated_at, controls, inventory, warnings, extended=None):
    document = {
        "schema_version": EXTENDED_SCHEMA_VERSION if extended is not None else SCHEMA_VERSION, "project": project,
        "source": {"extractor": EXTRACTOR_NAME, "extractor_version": EXTRACTOR_VERSION, "generated_at": timestamp(generated_at),
                   "endpoint": endpoint, "regions_scanned": [region], "is_mock": False, "notes": SOURCE_NOTES},
        "stacks": stack_entries(inventory.components),
        "controls": controls, "components": inventory.components, "edges": inventory.edges,
    }
    document.update({k: v for k, v in (extended or {}).items() if v is not None})
    document["x_extraction_warnings"] = warnings
    return document

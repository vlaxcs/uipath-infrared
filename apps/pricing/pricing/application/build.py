from pricing.adapters.catalog_files import catalog_text, read_skeleton, validate_catalog
from pricing.adapters.config_files import load_bindings
from pricing.adapters.snapshot_store import SnapshotStore
from pricing.application.paths import Paths
from pricing.domain.catalog_build import BuiltCatalog, build_catalog


def build(paths: Paths) -> tuple[BuiltCatalog, str]:
    store = SnapshotStore(paths.snapshots)
    bindings, descriptions = load_bindings(paths.config)
    built = build_catalog(read_skeleton(paths.skeleton), bindings, descriptions, store.snapshots(), store.fx())
    validate_catalog(built.document, paths.schema)
    return built, catalog_text(built.document)

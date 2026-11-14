from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from extractor.application.build_edges import build_edges
from extractor.application.collect_controls import collect_controls
from extractor.application.context import ExtractionContext
from extractor.application.extensions import run_extensions
from extractor.application.load_network import load_network
from extractor.application.sections import SECTIONS
from extractor.application.series_reader import SeriesReader
from extractor.application.warnings import Warnings
from extractor.domain.document import infra_document
from extractor.domain.inventory import Inventory
from extractor.domain.projects import belongs, is_scoped, scope_to_project, tag_name
from extractor.domain.provenance import metric_provenance
from extractor.domain.status import apply_status


@dataclass(frozen=True)
class ExtractionRequest:
    endpoint: str
    region: str
    project: str
    window_days: int


def run_extraction(request, aws, extension_sources=None):
    now = datetime.now(timezone.utc)
    warnings, provenance = Warnings(), metric_provenance(request.endpoint)
    series = SeriesReader(aws.cloudwatch, warnings, now - timedelta(days=request.window_days), now + timedelta(minutes=1),
                          request.window_days, provenance)
    context = ExtractionContext(aws=aws, warnings=warnings, series=series, region=request.region, window_days=request.window_days,
                                metric_provenance=provenance, inventory=Inventory(request.region))
    load_network(context)
    context.eks_cluster_names = warnings.guard("eks list", aws.eks.cluster_names, [])
    context.volumes = warnings.guard("volumes", aws.ec2.volumes, [])
    if is_scoped(request.project):
        context.volumes = [v for v in context.volumes if belongs(tag_name(v), request.project)]
    for label, section in SECTIONS:
        warnings.guard(label, lambda: section(context))
    build_edges(context)
    apply_status(context.inventory.components, context.inventory.edges)
    scope_to_project(context.inventory, request.project)
    controls = collect_controls(context)
    extended = run_extensions(context, extension_sources, now) if extension_sources else None
    return infra_document(request.project, request.endpoint, request.region, now, controls, context.inventory, warnings.messages, extended)

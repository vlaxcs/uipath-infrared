from dataclasses import dataclass, field

from extractor.domain.inventory import Inventory
from extractor.domain.network import NetworkFacts
from extractor.domain.references import References
from extractor.domain.slugs import SlugRegistry


@dataclass
class ExtractionContext:
    aws: object
    warnings: object
    series: object
    region: str
    window_days: int
    metric_provenance: str
    inventory: Inventory
    slugs: SlugRegistry = field(default_factory=SlugRegistry)
    references: References = field(default_factory=References)
    network: NetworkFacts = field(default_factory=NetworkFacts)
    eks_cluster_names: list = field(default_factory=list)
    volumes: list = field(default_factory=list)
    topic_subscriptions: dict = field(default_factory=dict)

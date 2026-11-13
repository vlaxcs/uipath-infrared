from dataclasses import dataclass
from pathlib import Path

from engine.adapters.contracts import validate
from engine.adapters.json_files import read_json
from engine.domain.catalog import Catalog, catalog_from_document
from engine.domain.forecast import Forecast, forecast_from_document
from engine.domain.model import Infra
from engine.domain.normalise import infra_from_document


@dataclass(frozen=True)
class Inputs:
    infra: Infra
    catalog: Catalog
    forecast: Forecast | None = None


def load_infra(path: Path) -> Infra:
    document = read_json(path)
    validate(document, "infra.schema.json", Path(path).name)
    return infra_from_document(document)


def load_catalog(path: Path) -> Catalog:
    document = read_json(path)
    validate(document, "catalog.schema.json", Path(path).name)
    return catalog_from_document(document)


def load_forecast(path: Path) -> Forecast:
    document = read_json(path)
    validate(document, "forecast.schema.json", Path(path).name)
    return forecast_from_document(document)


def load_inputs(infra: Path, catalog: Path, forecast: Path | None = None) -> Inputs:
    return Inputs(
        infra=load_infra(infra),
        catalog=load_catalog(catalog),
        forecast=load_forecast(forecast) if forecast else None,
    )

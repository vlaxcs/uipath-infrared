from pathlib import Path

import pytest

from engine.adapters.inputs import load_catalog, load_forecast, load_infra

CONTRACTS = Path(__file__).resolve().parents[3] / "contracts"
MOCK_INFRA = CONTRACTS / "mock" / "demo-shop.infra.json"
REAL_INFRA = CONTRACTS / "real" / "floci-estate.infra.json"
CATALOG = CONTRACTS / "catalog.example.json"
FORECAST = CONTRACTS / "forecast.example.json"


@pytest.fixture(scope="session")
def mock_infra():
    return load_infra(MOCK_INFRA)


@pytest.fixture(scope="session")
def real_infra():
    return load_infra(REAL_INFRA)


@pytest.fixture(scope="session")
def catalog():
    return load_catalog(CATALOG)


@pytest.fixture(scope="session")
def forecast():
    return load_forecast(FORECAST)

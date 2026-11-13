# Engine

The deterministic part of Infrared: it reads `infra.json`, `forecast.json` and `catalog.json`, prices and checks candidate plans, and writes `result.json`. No model touches a number. Design: `docs/decision-engine.md`.

## Run

```bash
python3 -m venv .venv && .venv/bin/pip install -r apps/engine/requirements.txt
cd apps/engine
../../.venv/bin/python -m pytest -q
../../.venv/bin/python -m engine baseline ../../contracts/mock/demo-shop.infra.json ../../contracts/catalog.example.json
```

Exit code 2 means an input broke its schema; the reason is on stderr.

## Layout

| Path | Layer | Holds |
| --- | --- | --- |
| `engine/cli.py`, `engine/__main__.py` | entry point | argument parsing, exit codes |
| `engine/application/` | application | one use case per file: load, run the domain, hand back a document |
| `engine/domain/` | domain | pure, deterministic logic; never imports `adapters`, `application` or `cli` (enforced by `tests/test_layers.py`) |
| `engine/adapters/` | adapters | JSON files, schema validation against `contracts/`, domain-to-document mapping |

Domain modules:

| Module | Does |
| --- | --- |
| `model.py`, `normalise.py` | `infra.json` as frozen dataclasses: 1.x accepted, unknown kinds become `other`, capacity and usage per unit, unknown stays `None` |
| `forecast.py`, `catalog.py` | the other two inputs |
| `provenance.py` | `Evidence`, weakest provenance, `confidence_of` with the reason naming the weakest input |
| `candidate.py` | `Action`, `ActionKind`, `Candidate` (cumulative layers through `extend`) |
| `end_state.py` | applies a candidate's actions to the estate: one `Placement` per component |
| `tiers.py`, `demand.py`, `pricing.py` | catalog price of one placement, line by line, with gaps listed |
| `costing.py` | which price a placement gets (rule below) |
| `baseline.py` | the current estate priced and cross-checked |

## Pricing rule

- An unchanged component costs its reported `cost.monthly_eur`; that is what the client pays today. Without one, the catalog prices it. Without either, it costs 0 and is flagged `unpriced`.
- A changed component (resized, scaled, moved, stopped) is priced from the catalog.
- Every component the catalog can price completely is cross-checked against its reported cost. Differences above 15% are listed, because a saving on that component carries the catalog's error.
- A tier is matched by SKU first. Otherwise the smallest single tier covering vCPU, memory and GPUs is used. Only when no single tier covers it is the component priced as the cheapest multiple of one tier.

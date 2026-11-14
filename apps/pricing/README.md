# pricing

Collects real prices offline and builds `catalog.json` from them, so the engine never looks a price up during a run. A run stays reproducible: the orchestrator records the catalog's sha256, and the same snapshots always build the same catalog.

```bash
cd apps/pricing
../../.venv/bin/python -m pricing refresh            # fetch every source, rewrite snapshots/ (about 20 s; EC2 is a 280 MB stream)
../../.venv/bin/python -m pricing build              # snapshots + contracts/catalog.example.json -> contracts/real/catalog.json, offline
../../.venv/bin/python -m pricing build --check      # fails if the committed catalog differs from a fresh build
../../.venv/bin/python -m pricing status             # age of every snapshot; fails past 30 days or when a vendor quote vanished
../../.venv/bin/python -m pytest -q
```

Refresh, review the diff, and open a pull request: the snapshots and the catalog are committed, so git history is the price history. Nothing here needs a secret or a setting; every source is public.

## Sources

| Source | Snapshot | What it holds |
|---|---|---|
| [AWS Price List bulk API](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-the-aws-price-list-bulk-api.html), one CSV per service for `eu-west-1` (`AmazonEC2`, `AmazonECR`, `AmazonECS`, `AmazonRDS`, `AmazonS3`, `AmazonDynamoDB`, `AWSDataTransfer`, `AmazonElastiCache`, `AmazonEKS`, `AmazonEFS`, `AmazonKinesis`, `AmazonKinesisFirehose`, `AmazonSNS`, `AWSLambda`, `AmazonVPC`, `AWSQueueService`) | `snapshots/aws-<Offer>.json` | only the rows `config/sources.json` asks for, with the SKU, the price list version and its URL |
| [ECB euro reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) | `snapshots/ecb-fx.json` | the USD rate and its date |
| Vendor pages with no price API (Supabase, Neon, and the Route53 hosted zone, which the `AmazonRoute53` price list no longer carries) | `snapshots/manual.json` | the prices typed into `config/manual.json`, kept only while their quote is still on the page |

## Rules

- **One row per price.** Each AWS price has a selector (columns and values) that must match exactly one on-demand row. Zero or two matches fail the refresh, naming every selector at fault, so a changed price list never picks a wrong row silently. Selectors use the `EU-` usage-type prefix of `eu-west-1`.
- **Vendor prices are typed in, then checked.** Each entry in `config/manual.json` has the price, the URL, the date it was read and a quote: the exact text on the page that shows the price. Refresh fetches the page and keeps the price only if the quote is still there (spaces and markup ignored). When it vanishes, the price drops out, the catalog keeps the skeleton's value, and `status` fails until someone re-reads the page.
- **Bindings map prices onto the catalog.** `config/bindings.json` says which snapshot price fills which catalog field: `tier:<id>` (monthly), `per_unit:<driver>` or `pricing:<field>`. `per: hour` multiplies by the catalog's `hours_per_month`; `multiplier` scales a unit price to a size (Neon: CU-hours times the CUs of the tier). A binding whose unit does not match the price fails the build.
- **Conversion:** USD to EUR at the ECB rate of the snapshot, rounded to 6 significant digits.
- **What the catalog says about itself:** `x_price_sources` lists every sourced price with its SKU or URL, version and fetch date; `x_unsourced` lists every money field still illustrative, with the reason; `illustrative` stays `true` until that list is empty.

## Layout

| Path | Does |
|---|---|
| `pricing/cli/main.py` | the `refresh`, `build` and `status` commands |
| `pricing/application/` | refresh every source, build and validate the catalog, report ages; `paths.py` holds the default locations |
| `pricing/domain/` | selection of one row per price, bindings, the catalog build, staleness, rounding; no I/O |
| `pricing/adapters/` | HTTP, the AWS CSV format, the ECB XML, page text, snapshot and config files, schema validation |
| `config/` | `sources.json` (what to fetch), `bindings.json` (where each price goes), `manual.json` (vendor prices and their quotes) |
| `snapshots/` | the stored prices, rewritten by `refresh` |

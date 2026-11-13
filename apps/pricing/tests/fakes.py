from typing import Iterator, Mapping


class FakeFetcher:
    def __init__(self, pages: Mapping[str, str]) -> None:
        self.pages = dict(pages)
        self.requested: list[str] = []

    def lines(self, url: str) -> Iterator[str]:
        self.requested.append(url)
        yield from self.pages[url].splitlines(keepends=True)

    def text(self, url: str) -> str:
        self.requested.append(url)
        return self.pages[url]


def aws_csv(offer: str, version: str, rows: list[dict[str, str]]) -> str:
    columns = ["SKU", "TermType", "PriceDescription", "Unit", "PricePerUnit", "Currency", "usageType", "Instance Type", "StartingRange"]
    head = [
        '"FormatVersion","v1.0"', '"Disclaimer","for tests"', '"Publication Date","2026-11-13T21:52:33Z"',
        f'"Version","{version}"', f'"OfferCode","{offer}"', ",".join(f'"{c}"' for c in columns),
    ]
    body = [",".join(f'"{row.get(c, "")}"' for c in columns) for row in rows]
    return "\n".join(head + body) + "\n"


def ecb_xml(day: str, usd: str) -> str:
    return (
        "<gesmes:Envelope><Cube><Cube time='" + day + "'>"
        "<Cube currency='JPY' rate='170.1'/><Cube currency='USD' rate='" + usd + "'/></Cube></Cube></gesmes:Envelope>"
    )

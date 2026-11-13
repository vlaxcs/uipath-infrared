from typing import Iterator, Protocol


class Fetcher(Protocol):
    def lines(self, url: str) -> Iterator[str]: ...

    def text(self, url: str) -> str: ...

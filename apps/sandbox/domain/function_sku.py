import re
from dataclasses import dataclass

DEFAULT_RUNTIME = "python3.12"
DEFAULT_MEMORY_MB = 128
RUNTIME_PATTERN = r"(python|nodejs|java|ruby|dotnet|provided|go)[0-9a-z.]*"


@dataclass(frozen=True)
class FunctionSku:
    runtime: str
    memory_mb: int


def parse_function_sku(sku: str) -> FunctionSku:
    runtime_part, _, memory_part = sku.partition("/")
    runtime = runtime_part.strip() if re.fullmatch(RUNTIME_PATTERN, runtime_part.strip()) else DEFAULT_RUNTIME
    memory = re.fullmatch(r"\s*(\d+)\s*MB\s*", memory_part, re.IGNORECASE)
    return FunctionSku(runtime=runtime, memory_mb=int(memory.group(1)) if memory else DEFAULT_MEMORY_MB)

INJECTED = "synthetic"
COUNTS = ("input_tokens", "output_tokens")


class InvalidConsumption(ValueError):
    pass


def model_entry(item, window_days):
    if not item.get("model") or not item.get("provider"):
        raise InvalidConsumption("every entry needs model and provider")
    entry = {"model": str(item["model"]), "provider": str(item["provider"])}
    for count in COUNTS:
        if item.get(count) is not None:
            entry[count] = max(0, int(item[count]))
    if item.get("cost_usd") is not None:
        entry["cost_usd"] = max(0.0, float(item["cost_usd"]))
    entry["window_days"] = window_days
    entry["provenance"] = INJECTED
    return entry


def ai_consumption(document):
    window_days = int(document.get("window_days", 0))
    if window_days < 1:
        raise InvalidConsumption("window_days must be a positive integer")
    return {"tokens_by_model": [model_entry(item, window_days) for item in document.get("models", [])]}

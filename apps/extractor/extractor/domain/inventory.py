EMPTY = (None, {}, [])


class Inventory:
    def __init__(self, region):
        self.region = region
        self.components = []
        self.edges = []

    def add(self, component):
        component.setdefault("provider", "aws")
        component.setdefault("region", self.region)
        component.setdefault("quantity", 1)
        component.setdefault("status", "active")
        for key in [k for k, v in component.items() if v in EMPTY and k != "quantity"]:
            del component[key]
        self.components.append(component)
        return component

    def connect(self, source, target, kind, note=None, evidence="declared"):
        if not source or not target or source == target:
            return
        if any(e["from"] == source and e["to"] == target and e["kind"] == kind for e in self.edges):
            return
        edge = {"from": source, "to": target, "kind": kind, "evidence": evidence}
        if note:
            edge["note"] = note
        self.edges.append(edge)

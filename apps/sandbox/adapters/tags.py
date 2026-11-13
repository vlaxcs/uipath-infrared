from typing import Dict, List


def name_tags(resource_type: str, name: str) -> List[Dict]:
    return [{"ResourceType": resource_type, "Tags": [{"Key": "Name", "Value": name}]}]


def name_of(tags) -> str:
    return next((tag["Value"] for tag in tags or [] if tag["Key"] == "Name"), "")

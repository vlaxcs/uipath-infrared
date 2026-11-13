ECR_ID = "ecr-repositories"


def container_registries(repositories):
    return {"id": ECR_ID, "name": f"{len(repositories)} ECR repositories", "kind": "other", "service": "ecr",
            "quantity": len(repositories), "stateful": True,
            "config": {"repositories": [{"name": r["repositoryName"], "mutable_tags": r.get("imageTagMutability") == "MUTABLE",
                                         "scan_on_push": (r.get("imageScanningConfiguration") or {}).get("scanOnPush")}
                                        for r in repositories]}}

def as_list(value):
    return value if isinstance(value, list) else [value]


def has_admin_managed_policy(attached_policies):
    return any(p["PolicyName"] == "AdministratorAccess" for p in attached_policies)


def document_grants_admin(document):
    for statement in as_list(document["Statement"]):
        if statement.get("Effect") == "Allow" and "*" in as_list(statement.get("Action")) \
                and "*" in as_list(statement.get("Resource")):
            return True
    return False

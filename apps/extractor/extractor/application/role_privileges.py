from extractor.domain.admin_policy import document_grants_admin, has_admin_managed_policy


def role_is_admin(context, role_arn):
    if not role_arn:
        return None
    iam, warnings, role = context.aws.iam, context.warnings, role_arn.split("/")[-1]
    attached = warnings.guard(f"iam attached {role}", lambda: iam.attached_policies(role))
    inline_names = warnings.guard(f"iam inline {role}", lambda: iam.inline_policy_names(role), [])
    if attached is None:
        return None
    if has_admin_managed_policy(attached):
        return True
    for policy_name in inline_names:
        document = warnings.guard(f"iam inline doc {role}/{policy_name}", lambda: iam.inline_policy(role, policy_name))
        if document and document_grants_admin(document):
            return True
    return False

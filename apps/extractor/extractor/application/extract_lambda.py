from extractor.application.role_privileges import role_is_admin
from extractor.domain.components.function import function_environment, lambda_function


def extract_lambda(context):
    series, refs = context.series, context.references
    for function in context.warnings.guard("lambda", context.aws.lambdas.functions, []):
        name = function["FunctionName"]
        dimensions = {"FunctionName": name}
        component_id = context.slugs.make(name, "fn-")
        refs.function_arns[function["FunctionArn"]] = component_id
        refs.environments[component_id] = function_environment(function)
        invocations = series.read("AWS/Lambda", "Invocations", dimensions, "count", "Sum")
        duration = series.read("AWS/Lambda", "Duration", dimensions, "ms")
        errors = series.read("AWS/Lambda", "Errors", dimensions, "count", "Sum")
        admin = role_is_admin(context, function.get("Role"))
        context.inventory.add(lambda_function(component_id, function, context.network, admin, invocations, duration, errors))
